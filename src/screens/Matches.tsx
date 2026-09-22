import { euros, matchDate, percent, relativeDay } from '../lib/format'
import { navigate } from '../lib/router'
import { useAppState } from '../lib/store'
import { fineAmount, finishedMatches, matchStatus, servesOfMatch, tally, upcomingMatches } from '../lib/stats'
import type { AppState, Match } from '../types'
import { Empty, SectionTitle } from '../ui/bits'

/** El calendario tal como lo ve el equipo: se consulta y se entra a anotar. */
export function Matches() {
  const state = useAppState()
  const upcoming = upcomingMatches(state)
  const played = finishedMatches(state)

  return (
    <>
      <SectionTitle>Próximos partidos</SectionTitle>
      {upcoming.length === 0 ? (
        <div className="card">
          <Empty glyph="📅" title="Sin partidos pendientes">
            Cuando se prepare el próximo, aparecerá aquí.
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <div className="list">
            {upcoming.map((match) => (
              <MatchRow key={match.id} match={match} state={state} />
            ))}
          </div>
        </div>
      )}

      {played.length > 0 ? (
        <>
          <SectionTitle aside={<span>{played.length}</span>}>Jugados</SectionTitle>
          <div className="card flush">
            <div className="list">
              {played.map((match) => (
                <MatchRow key={match.id} match={match} state={state} />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

function MatchRow({ match, state }: { match: Match; state: AppState }) {
  const status = matchStatus(state, match.id)
  const stats = tally(servesOfMatch(state, match.id))
  const fines = stats.errors * fineAmount(state)

  return (
    <button className="row" onClick={() => navigate(`partido/${match.id}`)}>
      <span className="grow">
        <span className="title">
          {match.home ? '' : '@ '}
          {match.opponent || 'Rival por definir'}
        </span>
        <span className="meta">
          {matchDate(match.date)}
          {status === 'finished' ? '' : ` · ${relativeDay(match.date)}`}
          {match.venue ? ` · ${match.venue}` : ''}
        </span>
      </span>
      <span className="trail">
        {status === 'live' ? (
          <span className="chip live">EN JUEGO</span>
        ) : status === 'finished' ? (
          <>
            <span className="big">{percent(stats.ratio)}</span>
            <span className="meta">{euros(fines)}</span>
          </>
        ) : (
          <span className="chip">›</span>
        )}
      </span>
    </button>
  )
}
