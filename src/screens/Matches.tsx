import { useState } from 'react'
import { defaultMatchDate, euros, matchDate, percent, relativeDay, toInputValue } from '../lib/format'
import { navigate } from '../lib/router'
import { addMatch, removeMatch, updateMatch, useAppState } from '../lib/store'
import {
  fineAmount,
  finishedMatches,
  matchStatus,
  servesOfMatch,
  tally,
  upcomingMatches,
} from '../lib/stats'
import { useRole } from '../lib/sync'
import type { AppState, Match } from '../types'
import { Sheet } from '../ui/Sheet'
import { Empty, Field, SectionTitle } from '../ui/bits'

type Editing = Match | 'new' | null

export function Matches() {
  const state = useAppState()
  const isAdmin = useRole() === 'admin'
  const upcoming = upcomingMatches(state)
  const played = finishedMatches(state)
  const [editing, setEditing] = useState<Editing>(null)

  return (
    <>
      <SectionTitle>Próximos partidos</SectionTitle>
      {upcoming.length === 0 ? (
        <div className="card">
          <Empty glyph="📅" title="Sin partidos pendientes">
            {isAdmin
              ? 'Créalos a mano o tráete el calendario desde Sportagia.'
              : 'Cuando la administradora prepare el próximo, aparecerá aquí.'}
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

      {isAdmin ? (
        <div className="btn-row">
          <button className="btn ghost" onClick={() => navigate('importar')}>
            Importar
          </button>
          <button className="btn" onClick={() => setEditing('new')}>
            Nuevo partido
          </button>
        </div>
      ) : null}

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

      {editing ? (
        <MatchSheet match={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
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

/** Alta y edición del partido: fecha, rival y sitio. Solo la administradora. */
export function MatchSheet({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const [date, setDate] = useState(match ? toInputValue(match.date) : defaultMatchDate())
  const [opponent, setOpponent] = useState(match?.opponent ?? '')
  const [venue, setVenue] = useState(match?.venue ?? '')
  const [home, setHome] = useState(match?.home ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    if (!opponent.trim() || !date) return
    if (match) {
      updateMatch(match.id, { date, opponent: opponent.trim(), venue: venue.trim(), home })
      onClose()
      return
    }
    const created = addMatch({ date, opponent, venue, home })
    onClose()
    navigate(`partido/${created.id}`)
  }

  return (
    <Sheet title={match ? 'Editar partido' : 'Nuevo partido'} onClose={onClose}>
      <div className="form">
        <Field label="Rival">
          <input
            value={opponent}
            onChange={(event) => setOpponent(event.target.value)}
            placeholder="CV Barcelona"
            autoFocus={!match}
            autoComplete="off"
          />
        </Field>
        <Field label="Día y hora">
          <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Pabellón (opcional)">
          <input
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
            placeholder="Municipal de..."
            autoComplete="off"
          />
        </Field>
        <label className="switch">
          <span>Jugamos en casa</span>
          <input type="checkbox" checked={home} onChange={(event) => setHome(event.target.checked)} />
        </label>

        <button className="btn block" onClick={save} disabled={!opponent.trim() || !date}>
          {match ? 'Guardar' : 'Crear partido'}
        </button>

        {match ? (
          confirmDelete ? (
            <div className="stack">
              <p className="small muted center">
                Se borra el partido y los saques anotados en él. Lo que ya se pagó a la hucha no se
                toca.
              </p>
              <div className="btn-row">
                <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    removeMatch(match.id)
                    onClose()
                    navigate('partidos')
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
          ) : (
            <button className="btn quiet" onClick={() => setConfirmDelete(true)}>
              Borrar partido
            </button>
          )
        ) : null}
      </div>
    </Sheet>
  )
}
