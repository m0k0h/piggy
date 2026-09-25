import { useState } from 'react'
import { euros, matchDate, percent, plural } from '../lib/format'
import { navigate } from '../lib/router'
import { useAppState } from '../lib/store'
import {
  allPlayers,
  allServes,
  fineAmount,
  playedMatches,
  servesOfMatch,
  tally,
  tallyByPlayer,
} from '../lib/stats'
import { Avatar, Empty, PlayerName, RatioBar, SectionTitle, Stat } from '../ui/bits'
import { ChartIcon } from '../ui/icons'

type Order = 'ratio' | 'errors' | 'attempts'

const ORDERS: { key: Order; label: string }[] = [
  { key: 'ratio', label: 'Mejor %' },
  { key: 'errors', label: 'Más fallos' },
  { key: 'attempts', label: 'Más saques' },
]

export function Stats() {
  const state = useAppState()
  const matches = playedMatches(state)
  const [scope, setScope] = useState('all')
  const [order, setOrder] = useState<Order>('ratio')

  const serves = scope === 'all' ? allServes(state) : servesOfMatch(state, scope)
  const total = tally(serves)
  const fine = fineAmount(state)

  const rows = allPlayers(state)
    .map((player) => ({ player, own: tallyByPlayer(serves, player.id) }))
    .filter((row) => row.own.attempts > 0)
    .sort((a, b) => {
      if (order === 'errors') return b.own.errors - a.own.errors || b.own.attempts - a.own.attempts
      if (order === 'attempts') return b.own.attempts - a.own.attempts
      return (b.own.ratio ?? 0) - (a.own.ratio ?? 0) || b.own.attempts - a.own.attempts
    })

  if (total.attempts === 0) {
    return (
      <>
        <SectionTitle>Estadísticas</SectionTitle>
        <div className="card">
          <Empty icon={<ChartIcon />} title="Todavía no hay saques anotados">
            En cuanto juguéis un partido aparecerán aquí los ratios de acierto.
          </Empty>
          <button className="btn block" onClick={() => navigate('partidos')}>
            Ir a los partidos
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <SectionTitle>Estadísticas</SectionTitle>

      {matches.length > 0 ? (
        <div className="field">
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="all">Toda la temporada</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.home ? 'vs' : '@'} {match.opponent} · {matchDate(match.date)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="stat-row">
        <Stat value={total.attempts} label="Saques" />
        <Stat value={percent(total.ratio)} label="Dentro" tone="good" />
        <Stat value={total.errors} label="Fallos" tone="bad" />
      </div>
      <div className="stat-row">
        <Stat value={total.aces} label="Aces" />
        <Stat value={total.in} label="En juego" />
        <Stat value={euros(total.errors * fine)} label="Hucha" tone="money" />
      </div>
      <RatioBar ratio={total.ratio} />

      <SectionTitle>Jugadoras</SectionTitle>
      <div className="segmented">
        {ORDERS.map((option) => (
          <button
            key={option.key}
            onClick={() => setOrder(option.key)}
            aria-pressed={order === option.key}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="card flush">
        <div className="list">
          {rows.map(({ player, own }) => (
            <div key={player.id} className="row">
              <Avatar name={player.name} number={player.number} />
              <span className="grow">
                <span className="title"><PlayerName player={player} /></span>
                <span className="meta">
                  {plural(own.attempts, 'saque', 'saques')} · {plural(own.errors, 'fallo', 'fallos')} ·{' '}
                  {plural(own.aces, 'ace', 'aces')}
                </span>
                <RatioBar ratio={own.ratio} />
              </span>
              <span className="trail">
                <span className={own.ratio !== null && own.ratio > 0.5 ? 'big good' : 'big'}>
                  {percent(own.ratio)}
                </span>
                <span className="meta">{euros(own.errors * fine)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
