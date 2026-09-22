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
        <div className="label">Llevamos ahorrado</div>
        <div className="amount">{euros(totals.paid)}</div>
        {totals.owed > 0 ? (
          <>
            <div className="detail">
              de {euros(totals.owed)} · {plural(totals.errors, 'saque fallado', 'saques fallados')} a{' '}
              {euros(fineAmount(state))}
            </div>
            <div
              className="pot-bar"
              role="img"
              aria-label={`${euros(totals.paid)} cobrados de ${euros(totals.owed)}`}
            >
              {/* Sin nada cobrado no pintamos barra: el mínimo de anchura mentiría. */}
              {totals.paid > 0 ? (
                <i style={{ width: `${Math.round((totals.paid / totals.owed) * 100)}%` }} />
              ) : null}
            </div>
          </>
        ) : (
          <div className="detail">Aún no hay saques fallados. Todo llegará.</div>
        )}
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

      <SectionTitle
        aside={
          totals.pending > 0 ? <span className="chip money">{euros(totals.pending)}</span> : null
        }
      >
        Pendiente de pagar
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
