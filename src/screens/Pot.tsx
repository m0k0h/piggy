import { useState, type ReactNode } from 'react'
import { euros, matchDate, percent, relativeDay, serveSummary } from '../lib/format'
import { navigate } from '../lib/router'
import { potSummary, share } from '../lib/summary'
import { useAppState } from '../lib/store'
import { allPayments, allServes, balances, matchStatus, pot, tally, upcomingMatches } from '../lib/stats'
import type { Balance } from '../lib/stats'
import type { AppState, Payment } from '../types'
import { Avatar, Empty, SectionTitle } from '../ui/bits'
import { CalendarIcon, HomeIcon, PigLineIcon, ShareIcon } from '../ui/icons'

export function Pot() {
  const state = useAppState()
  const totals = pot(state)
  const global = tally(allServes(state))
  const rows = balances(state)
  const next = upcomingMatches(state)[0]
  const [toast, setToast] = useState('')

  const withDebt = rows.filter((row) => row.pending > 0)
  const lastPayments = [...allPayments(state)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)

  const onShare = async () => {
    const result = await share(potSummary(state))
    if (result === 'copied') setToast('Estado de la hucha copiado')
    else if (result === 'failed') setToast('No se ha podido compartir')
    setTimeout(() => setToast(''), 2500)
  }

  // Los bloques de pendiente y de últimos pagos solo salen si tienen algo
  // que enseñar: sin deudas o sin pagos, la portada no pinta el hueco vacío.
  const pendingSection: ReactNode =
    withDebt.length > 0 ? (
      <>
        <SectionTitle aside={<span className="chip money">{euros(totals.pending)}</span>}>
          Pendiente de pagar
        </SectionTitle>
        <div className="card flush">
          <div className="list">
            {withDebt.map((row) => (
              <DebtRow key={row.player.id} row={row} />
            ))}
          </div>
        </div>
      </>
    ) : null

  // Lo que la administradora quiere comentar: solo la última noticia, y si no
  // hay ninguna publicada, el bloque no sale.
  const notice = state.team.notice
  const noticeSection: ReactNode = notice ? (
    <>
      <SectionTitle aside={<span>{matchDate(notice.publishedAt)}</span>}>Para comentar</SectionTitle>
      <div className="card notice">
        {notice.image ? <img className="notice-image" src={notice.image} alt="" /> : null}
        {notice.text ? <p className="notice-text">{notice.text}</p> : null}
      </div>
    </>
  ) : null

  const lastPaymentsSection: ReactNode =
    lastPayments.length > 0 ? (
      <>
        <SectionTitle>Últimos pagos</SectionTitle>
        <div className="card flush">
          <div className="list">
            {lastPayments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} state={state} />
            ))}
          </div>
        </div>
      </>
    ) : null

  return (
    <>
      <div className="card pot">
        <PigLineIcon size={168} className="hero-mark" />
        {/* Botón de compartir, flotando abajo a la izquierda. */}
        <button className="hero-share" onClick={onShare} aria-label="Compartir estado de la hucha">
          <ShareIcon size={17} />
        </button>
        <div className="hero-content">
          <div className="label">Total de la hucha</div>
          {/* Si queda algo sin cobrar, un badge apagado en la línea de antes
              lo señala sin competir con la cifra grande. Saldado del todo,
              no aparece. */}
          {totals.pending > 0 ? (
            <div className="pending-badge">
              <strong>{euros(totals.pending)}</strong> pendiente
            </div>
          ) : null}
          {/* Siempre el total generado, esté cobrado o no. */}
          <div className="amount">{euros(totals.owed)}</div>
          {global.attempts > 0 ? (
            <div className="pills">
              <span className={`pill ${global.ratio! >= 0.5 ? 'pill-good' : 'pill-bad'}`}>
                <strong>{percent(global.ratio)}</strong> de acierto del equipo
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {noticeSection}

      {next ? (
        <button className="card row" onClick={() => navigate(`partido/${next.id}`)}>
          <span className="grow">
            <span className="meta">
              {matchStatus(state, next.id) === 'live' ? 'Partido en juego' : 'Próximo partido'}
            </span>
            <span className="title">
              {next.home ? (
                <>
                  <HomeIcon size={15} className="home-mark" />
                  <span className="sr-only">En casa · </span>
                </>
              ) : (
                '@ '
              )}
              {next.opponent}
            </span>
            <span className="meta">
              {matchDate(next.date)} · {relativeDay(next.date)}
            </span>
          </span>
          <span className="trail">
            <span className={matchStatus(state, next.id) === 'live' ? 'chip live' : 'chip money'}>
              {matchStatus(state, next.id) === 'live' ? 'ANOTAR' : 'Iniciar'}
            </span>
          </span>
        </button>
      ) : (
        <div className="card">
          <Empty icon={<CalendarIcon />} title="No hay ningún partido a la vista">
            Cuando se prepare el próximo, aparecerá aquí.
          </Empty>
        </div>
      )}

      {pendingSection}
      {lastPaymentsSection}

      {toast ? <div className="banner good">{toast}</div> : null}
    </>
  )
}

/** La hucha se consulta desde aquí; cobrar es cosa de administración. */
function DebtRow({ row }: { row: Balance }) {
  return (
    <div className="row">
      <Avatar name={row.player.name} number={row.player.number} />
      <span className="grow">
        <span className="title">{row.player.name}</span>
        <span className="meta">
          {serveSummary(row.tally.errors, row.tally.attempts, row.tally.ratio)}
          {row.paid > 0 ? ` · ${euros(row.paid)} pagados` : ''}
        </span>
      </span>
      <span className="trail">
        <span className="big">{euros(row.pending)}</span>
      </span>
    </div>
  )
}

/** Un pago ya registrado: solo lectura, cobrar es cosa de administración. */
function PaymentRow({ payment, state }: { payment: Payment; state: AppState }) {
  const player = state.players[payment.playerId]
  return (
    <div className="row">
      <Avatar name={player?.name ?? 'Jugadora'} number={player?.number} />
      <span className="grow">
        <span className="title">{player?.name ?? 'Jugadora'}</span>
        <span className="meta">
          {payment.note ? `${payment.note} · ` : ''}
          {matchDate(payment.createdAt)}
        </span>
      </span>
      <span className="trail">
        <span className="big good">{euros(payment.amount)}</span>
      </span>
    </div>
  )
}
