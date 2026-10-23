import { euros, matchDate, percent, relativeDay, serveTone } from '../lib/format'
import { navigate } from '../lib/router'
import { useAppState } from '../lib/store'
import { fineAmount, finishedMatches, lineupOf, matchStatus, servesOfMatch, tally, upcomingMatches } from '../lib/stats'
import type { AppState, Match } from '../types'
import { Empty, LeagueTag, OpponentCrest, OutcomeTag, SectionTitle } from '../ui/bits'
import { AwayIcon, CalendarIcon, ChevronIcon, HomeIcon, PencilIcon } from '../ui/icons'

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
          <Empty icon={<CalendarIcon />} title="Sin partidos pendientes">
            Cuando se prepare el próximo, aparecerá aquí.
          </Empty>
        </div>
      ) : (
        <div className="card flush">
          <div className="list match-list">
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
            <div className="list match-list">
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

/**
 * Fila de un partido en el calendario. La comparte la administración, que al
 * pulsarla abre la edición en vez de la ficha: ahí la fila lleva un lápiz al
 * final, y el lápiz sustituye a la flecha de los partidos por jugar.
 */
export function MatchRow({ match, state, onOpen }: { match: Match; state: AppState; onOpen?: () => void }) {
  const status = matchStatus(state, match.id)
  const stats = tally(servesOfMatch(state, match.id))
  const fines = stats.errors * fineAmount(state)

  return (
    <button className="row" onClick={onOpen ?? (() => navigate(`partido/${match.id}`))}>
      <OpponentCrest opponent={match.opponent} logo={match.opponentLogo} />
      <span className="grow">
        <span className="row-tags">
          <LeagueTag league={match.league} />
          {status === 'finished' ? <OutcomeTag outcome={lineupOf(state, match.id)?.outcome} /> : null}
        </span>
        <span className="title">
          {match.home ? <HomeIcon size={15} className="home-mark" /> : <AwayIcon size={15} className="home-mark" />}
          <span className="sr-only">{match.home ? 'En casa · ' : 'Fuera · '}</span>
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
            <span className={stats.ratio === null ? 'big' : `big ${serveTone(stats.ratio)}`}>{percent(stats.ratio)}</span>
            <span className="meta">{euros(fines)}</span>
          </>
        ) : onOpen ? null : (
          <span className="chip">
            <ChevronIcon size={12} aria-hidden="true" />
          </span>
        )}
      </span>
      {onOpen ? (
        <span className="edit-mark">
          <PencilIcon size={17} />
          <span className="sr-only">Editar</span>
        </span>
      ) : null}
    </button>
  )
}
