import { useState } from 'react'
import { euros, matchDate, percent, plural, relativeDay } from '../lib/format'
import { navigate } from '../lib/router'
import { potSummary, share } from '../lib/summary'
import { addPayment, removePayment, useAppState } from '../lib/store'
import { allPayments, balances, pot, upcomingMatches } from '../lib/stats'
import type { Balance } from '../lib/stats'
import { Sheet } from '../ui/Sheet'
import { Avatar, Empty, SectionTitle } from '../ui/bits'

export function Pot() {
  const state = useAppState()
  const totals = pot(state)
  const rows = balances(state)
  const next = upcomingMatches(state)[0]
  const [paying, setPaying] = useState<Balance | null>(null)
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
          {plural(totals.errors, 'saque fallado', 'saques fallados')} a {euros(state.settings.fineAmount)}
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
              {next.status === 'live' ? 'Partido en juego' : 'Próximo partido'}
            </span>
            <span className="title">
              {next.home ? 'vs' : '@'} {next.opponent}
            </span>
            <span className="meta">
              {matchDate(next.date)} · {relativeDay(next.date)}
            </span>
          </span>
          <span className="trail">
            <span className={next.status === 'live' ? 'chip live' : 'chip money'}>
              {next.status === 'live' ? 'ANOTAR' : 'Iniciar'}
            </span>
          </span>
        </button>
      ) : (
        <div className="card">
          <Empty glyph="📅" title="No hay ningún partido a la vista">
            Crea el próximo para poder anotar los saques.
          </Empty>
          <button className="btn block" onClick={() => navigate('partidos')}>
            Crear partido
          </button>
        </div>
      )}

      <SectionTitle aside={withDebt.length > 0 ? <span>{withDebt.length}</span> : null}>
        Quién debe
      </SectionTitle>

      {rows.length === 0 ? (
        <div className="card">
          <Empty glyph="🐷" title="La hucha está vacía">
            Añade la plantilla y empieza a anotar saques.
          </Empty>
          <button className="btn block" onClick={() => navigate('plantilla')}>
            Ir a la plantilla
          </button>
        </div>
      ) : withDebt.length === 0 ? (
        <div className="card">
          <Empty glyph="🎉" title="Todas al día">
            {totals.owed > 0 ? `Se han pagado ${euros(totals.paid)} en total.` : 'Aún no hay fallos anotados.'}
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <div className="list">
            {withDebt.map((row) => (
              <button key={row.player.id} className="row" onClick={() => setPaying(row)}>
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
                  <span className="meta">cobrar ›</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="btn ghost block" onClick={onShare}>
        Compartir estado de la hucha
      </button>
      {toast ? <div className="banner good">{toast}</div> : null}

      {paying ? <PaymentSheet row={paying} onClose={() => setPaying(null)} /> : null}
    </>
  )
}

function PaymentSheet({ row, onClose }: { row: Balance; onClose: () => void }) {
  const state = useAppState()
  const [amount, setAmount] = useState(String(row.pending))
  const [note, setNote] = useState('')
  const value = Number(amount.replace(',', '.'))
  const history = allPayments(state)
    .filter((payment) => payment.playerId === row.player.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <Sheet title={`Pago de ${row.player.name}`} onClose={onClose}>
      <div className="form">
        <p className="small muted">
          Debe {euros(row.pending)} por {plural(row.tally.errors, 'saque fallado', 'saques fallados')}.
        </p>
        <label className="field">
          <span>Cuánto pone</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Nota (opcional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="En mano, Bizum..."
            autoComplete="off"
          />
        </label>
        <button
          className="btn block"
          disabled={!Number.isFinite(value) || value <= 0}
          onClick={() => {
            addPayment(row.player.id, value, note)
            onClose()
          }}
        >
          Registrar {Number.isFinite(value) && value > 0 ? euros(value) : ''}
        </button>

        {history.length > 0 ? (
          <div className="stack">
            <SectionTitle>Pagos anteriores</SectionTitle>
            <div className="log">
              {history.map((payment) => (
                <div key={payment.id} className="log-item">
                  <span className="grow">
                    {euros(payment.amount)}
                    {payment.note ? ` · ${payment.note}` : ''}
                  </span>
                  <button className="undo" onClick={() => removePayment(payment.id)}>
                    Deshacer
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}
