import { useState, type ReactNode } from 'react'
import { euros, matchDate, percent, relativeDay, serveSummary } from '../lib/format'
import { navigate } from '../lib/router'
import { potSummary, share } from '../lib/summary'
import { useAppState } from '../lib/store'
import { allPayments, allServes, balances, matchStatus, pot, tally, upcomingMatches } from '../lib/stats'
import type { Balance } from '../lib/stats'
import type { AppState, Payment } from '../types'
import { Avatar, Empty, SectionTitle } from '../ui/bits'
import { CalendarIcon, CoinsIcon, HomeIcon, PartyIcon, PigIcon, PigLineIcon, ShareIcon } from '../ui/icons'

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

  const pendingSection: ReactNode = (
    <>
      <SectionTitle
        aside={
          totals.pending > 0 ? <span className="chip money">{euros(totals.pending)}</span> : null
        }
      >
        Pendiente de pagar
      </SectionTitle>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon={<PigIcon size={74} />} title="La hucha está vacía" highlight>
            En cuanto se anoten saques, aparecerá aquí lo que debe cada una.
          </Empty>
        </div>
      ) : withDebt.length === 0 ? (
        <div className="card">
          <Empty icon={<PartyIcon />} title="Todas al día">
            {totals.owed > 0 ? (
              <>
                No queda nada por cobrar.
                <br />
                Los {euros(totals.paid)} ya están en la hucha.
              </>
            ) : (
              'Aún no hay fallos anotados.'
            )}
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <div className="list">
            {withDebt.map((row) => (
              <DebtRow key={row.player.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </>
  )

  const lastPaymentsSection: ReactNode = (
    <>
      <SectionTitle>Últimos pagos</SectionTitle>
      {lastPayments.length === 0 ? (
        <div className="card">
          <Empty icon={<CoinsIcon />} title="Todavía no hay pagos">
            Se registran desde administración, en Cobros.
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <div className="list">
            {lastPayments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} state={state} />
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      <div className="card pot">
        <PigLineIcon size={168} className="hero-mark" />
        {/* La esquina de arriba a la derecha es el botón de compartir. */}
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

      {withDebt.length > 0 ? (
        <>
          {pendingSection}
          {lastPaymentsSection}
        </>
      ) : (
        <>
          {lastPaymentsSection}
          {pendingSection}
        </>
      )}

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
        <span className="big">{euros(payment.amount)}</span>
      </span>
    </div>
  )
}
