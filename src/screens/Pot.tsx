import { useState } from 'react'
import { euros, matchDate, percent, plural, relativeDay } from '../lib/format'
import { navigate } from '../lib/router'
import { potSummary, share } from '../lib/summary'
import { useAppState } from '../lib/store'
import { allServes, balances, fineAmount, matchStatus, pot, tally, upcomingMatches } from '../lib/stats'
import type { Balance } from '../lib/stats'
import { Avatar, Empty, SectionTitle } from '../ui/bits'
import { CalendarIcon, HomeIcon, PartyIcon, PigIcon, PigLineIcon } from '../ui/icons'

export function Pot() {
  const state = useAppState()
  const totals = pot(state)
  const global = tally(allServes(state))
  const rows = balances(state)
  const next = upcomingMatches(state)[0]
  const [toast, setToast] = useState('')

  const withDebt = rows.filter((row) => row.pending > 0)

  const onShare = async () => {
    const result = await share(potSummary(state))
    if (result === 'copied') setToast('Estado de la hucha copiado')
    else if (result === 'failed') setToast('No se ha podido compartir')
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <>
      <div className="card pot">
        <PigLineIcon size={168} className="hero-mark" />
        <div className="hero-content">
          <div className="label">Total de la hucha</div>
          {/* Siempre el total generado, esté cobrado o no: lo pendiente se ve
              detallado más abajo, en "Pendiente de pagar". */}
          <div className="amount">{euros(totals.owed)}</div>
          <div className="subtitle">
            {totals.errors > 0 ? (
              <>
                <strong>{plural(totals.errors, 'saque fallado', 'saques fallados')}</strong> ·{' '}
                <strong>{euros(fineAmount(state))}</strong>
              </>
            ) : (
              'Ni un saque fallado todavía'
            )}
          </div>
          {global.attempts > 0 ? (
            <div className="accuracy-pill">
              <strong>{percent(global.ratio)}</strong> de acierto del equipo
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
            {totals.owed > 0
              ? `No queda nada por cobrar: los ${euros(totals.paid)} ya están en la hucha.`
              : 'Aún no hay fallos anotados.'}
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

      <button className="btn ghost block" onClick={onShare}>
        Compartir estado de la hucha
      </button>
      {toast ? <div className="banner good">{toast}</div> : null}
    </>
  )
}

/** La hucha se consulta desde aquí; cobrar es cosa de administración. */
function DebtRow({ row }: { row: Balance }) {
  return (
    <div className="row">
      <Avatar name={row.player.name} />
      <span className="grow">
        <span className="title">{row.player.name}</span>
        <span className="meta">
          {plural(row.tally.errors, 'fallo', 'fallos')} · {percent(row.tally.ratio)} dentro
          {row.paid > 0 ? ` · ${euros(row.paid)} pagados` : ''}
        </span>
      </span>
      <span className="trail">
        <span className="big">{euros(row.pending)}</span>
      </span>
    </div>
  )
}
