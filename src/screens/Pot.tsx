import { useState } from 'react'
import { euros, matchDate, percent, plural, relativeDay } from '../lib/format'
import { navigate } from '../lib/router'
import { potSummary, share } from '../lib/summary'
import { useAppState } from '../lib/store'
import { balances, fineAmount, matchStatus, pot, upcomingMatches } from '../lib/stats'
import type { Balance } from '../lib/stats'
import { Avatar, Empty, SectionTitle } from '../ui/bits'

export function Pot() {
  const state = useAppState()
  const totals = pot(state)
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
        <div className="label">Pendiente en la hucha</div>
        <div className="amount">{euros(totals.pending)}</div>
        <div className="detail">
          {plural(totals.errors, 'saque fallado', 'saques fallados')} a {euros(fineAmount(state))}
        </div>
        <div className="pot-split">
          <div>
            <span className="k">Generado</span>
            <span className="v">{euros(totals.owed)}</span>
          </div>
          <div>
            <span className="k">Ya pagado</span>
            <span className="v">{euros(totals.paid)}</span>
          </div>
        </div>
      </div>

      {next ? (
        <button className="card row" onClick={() => navigate(`partido/${next.id}`)}>
          <span className="grow">
            <span className="meta">
              {matchStatus(state, next.id) === 'live' ? 'Partido en juego' : 'Próximo partido'}
            </span>
            <span className="title">
              {next.home ? 'vs' : '@'} {next.opponent}
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
          <Empty glyph="📅" title="No hay ningún partido a la vista">
            Cuando se prepare el próximo, aparecerá aquí.
          </Empty>
        </div>
      )}

      <SectionTitle aside={withDebt.length > 0 ? <span>{withDebt.length}</span> : null}>
        Quién debe
      </SectionTitle>

      {rows.length === 0 ? (
        <div className="card">
          <Empty glyph="🐷" title="La hucha está vacía">
            En cuanto se anoten saques, aparecerá aquí lo que debe cada una.
          </Empty>
        </div>
      ) : withDebt.length === 0 ? (
        <div className="card">
          <Empty glyph="🎉" title="Todas al día">
            {totals.owed > 0
              ? `Se han pagado ${euros(totals.paid)} en total.`
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
