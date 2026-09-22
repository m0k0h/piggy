import { useState } from 'react'
import { euros, matchDateLong, percent, plural, relativeDay, serveSummary } from '../lib/format'
import { goBack, navigate } from '../lib/router'
import { matchSummary, share } from '../lib/summary'
import { addServe, removeServe, saveLineup, useAppState } from '../lib/store'
import {
  allPlayers,
  allServes,
  currentSet,
  fineAmount,
  matchStatus,
  participants,
  rosterIds,
  rosterOf,
  servesOfMatch,
  tally,
  tallyByPlayer,
} from '../lib/stats'
import type { AppState, Match, Player, Serve, ServeResult } from '../types'
import { Sheet } from '../ui/Sheet'
import {
  Avatar,
  Empty,
  LeagueLink,
  OpponentCrest,
  RatioBar,
  ScreenHeader,
  SectionTitle,
  Stat,
} from '../ui/bits'
import {
  BallIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  HomeIcon,
  PeopleIcon,
  ShrugIcon,
  StarIcon,
  UndoIcon,
  XIcon,
} from '../ui/icons'

export function MatchScreen({ matchId }: { matchId: string }) {
  const state = useAppState()
  const match = state.matches[matchId]

  if (!match || match.deletedAt) {
    return (
      <>
        <ScreenHeader title="Partido" onBack={() => navigate('partidos')} />
        <main>
          <div className="card">
            <Empty icon={<ShrugIcon />} title="Este partido ya no existe" />
            <button className="btn block" onClick={() => navigate('partidos')}>
              Ver los partidos
            </button>
          </div>
        </main>
      </>
    )
  }

  const status = matchStatus(state, matchId)
  if (status === 'live') return <LiveMatch match={match} state={state} />
  if (status === 'finished') return <MatchReport match={match} state={state} />
  return <MatchPreview match={match} state={state} />
}

const titleOf = (match: Match) => `${match.home ? 'vs' : '@'} ${match.opponent || 'Rival'}`

/** Agrupa saques consecutivos del mismo set, para no repetir la etiqueta en cada fila. */
function groupBySet(serves: Serve[]): { set: number; serves: Serve[] }[] {
  const groups: { set: number; serves: Serve[] }[] = []
  for (const serve of serves) {
    const last = groups[groups.length - 1]
    if (last && last.set === serve.set) last.serves.push(serve)
    else groups.push({ set: serve.set, serves: [serve] })
  }
  return groups
}

// --------------------------------------------------------------- programado

/**
 * Antes del pitido inicial. Apuntar a las asistentes e iniciar el partido son
 * dos pasos distintos: la lista se puede ir montando según llega la gente al
 * pabellón, y el partido no arranca hasta que hay alguien para sacar.
 */
function MatchPreview({ match, state }: { match: Match; state: AppState }) {
  const [callUp, setCallUp] = useState(false)
  const attendees = rosterOf(state, match.id)

  if (callUp) {
    return (
      <CallUp
        match={match}
        state={state}
        confirmLabel="Guardar asistentes"
        onCancel={() => setCallUp(false)}
        onConfirm={(roster) => {
          // El partido sigue programado: esto solo apunta quién ha venido.
          saveLineup(match.id, { roster, status: 'scheduled' })
          setCallUp(false)
        }}
      />
    )
  }

  return (
    <>
      <ScreenHeader title={titleOf(match)} subtitle={relativeDay(match.date)} onBack={goBack} />
      <main>
        <div className="card stack">
          <div className="inline wide">
            <OpponentCrest opponent={match.opponent} logo={match.opponentLogo} big />
            <div className="grow">
              <div className="small muted">
                {match.home ? <HomeIcon size={13} className="home-mark" /> : null}
                {match.home ? 'En casa' : 'Fuera'}
              </div>
              <h2>{match.opponent || 'Rival por definir'}</h2>
              <LeagueLink url={match.leagueUrl} />
            </div>
          </div>
          <span className="chip date">
            <CalendarIcon size={14} />
            {matchDateLong(match.date) + (match.venue ? ` · ${match.venue}` : '')}
          </span>
        </div>

        <SectionTitle aside={attendees.length > 0 ? <span>{attendees.length}</span> : null}>
          Asistentes
        </SectionTitle>
        <div className="card stack">
          {attendees.length === 0 ? (
            <p className="small muted center">
              Todavía no ha venido nadie.
              <br />
              Apunta a quien esté en el pabellón.
            </p>
          ) : (
            <div className="attendees">
              {attendees.map((player) => (
                <span key={player.id} className="attendee">
                  <Avatar name={player.name} number={player.number} />
                  {player.name}
                </span>
              ))}
            </div>
          )}
          <button className="btn ghost block" onClick={() => setCallUp(true)}>
            {attendees.length === 0 ? 'Añadir asistentes' : 'Editar asistentes'}
          </button>
        </div>

        <div className="start-group">
          <button className="btn block" onClick={() => saveLineup(match.id, { status: 'live' })} disabled={attendees.length === 0}>
            Iniciar partido
          </button>
          <p className="small accent center">
            {attendees.length === 0
              ? 'Hace falta al menos una asistente para poder anotar saques.'
              : 'Asegúrate de añadir a todas las asistentes.'}
          </p>
        </div>
      </main>
    </>
  )
}

// -------------------------------------------------------------- convocatoria

function CallUp({
  match,
  state,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  match: Match
  state: AppState
  confirmLabel: string
  onCancel: () => void
  onConfirm: (roster: string[]) => void
}) {
  const players = allPlayers(state)
  const seasonServes = allServes(state)
  const [selected, setSelected] = useState<string[]>(() => rosterIds(state, match.id))

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )

  return (
    <>
      <ScreenHeader
        title="Asistentes"
        subtitle={plural(selected.length, 'apuntada', 'apuntadas')}
        onBack={onCancel}
      />
      <main>
        {players.length === 0 ? (
          <div className="card">
            <Empty icon={<BallIcon />} title="No hay jugadoras en la plantilla">
              La administradora todavía no ha dado de alta al equipo.
            </Empty>
          </div>
        ) : (
          <>
            <SectionTitle
              aside={
                <button
                  className="btn quiet small"
                  onClick={() =>
                    setSelected(selected.length === players.length ? [] : players.map((p) => p.id))
                  }
                >
                  {selected.length === players.length ? 'Ninguna' : 'Todas'}
                </button>
              }
            >
              ¿Quién ha venido?
            </SectionTitle>
            <div className="card flush">
              <div className="list">
                {players.map((player) => {
                  const on = selected.includes(player.id)
                  const own = tallyByPlayer(seasonServes, player.id)
                  return (
                    <button
                      key={player.id}
                      className="row"
                      onClick={() => toggle(player.id)}
                      aria-pressed={on}
                    >
                      <Avatar name={player.name} number={player.number} on={on} />
                      <span className="grow">
                        <span className="title">{player.name}</span>
                        <span className="meta">{serveSummary(own.errors, own.attempts, own.ratio)}</span>
                      </span>
                      <span className="trail" aria-hidden="true">
                        {on ? <CheckIcon size={18} /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <button className="btn block" onClick={() => onConfirm(selected)}>
          {confirmLabel} ({selected.length})
        </button>
      </main>
    </>
  )
}

// -------------------------------------------------------------------- en vivo

function LiveMatch({ match, state }: { match: Match; state: AppState }) {
  const serves = servesOfMatch(state, match.id)
  const roster = rosterOf(state, match.id)
  const [set, setSet] = useState(() => currentSet(serves))
  const [picking, setPicking] = useState<Player | null>(null)
  const [editingRoster, setEditingRoster] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const total = tally(serves)
  const fines = total.errors * fineAmount(state)
  const recent = [...serves].reverse().slice(0, 8)

  if (editingRoster) {
    return (
      <CallUp
        match={match}
        state={state}
        confirmLabel="Guardar asistentes"
        onCancel={() => setEditingRoster(false)}
        onConfirm={(next) => {
          saveLineup(match.id, { roster: next })
          setEditingRoster(false)
        }}
      />
    )
  }

  return (
    <>
      <ScreenHeader
        title={titleOf(match)}
        subtitle="En juego"
        onBack={() => navigate('partidos')}
        actions={
          <button className="btn small danger" onClick={() => setConfirmEnd(true)}>
            Finalizar
          </button>
        }
      />
      <main>
        <div className="live-head">
          <div>
            <div className="small muted">Fallos · hucha</div>
            <strong>
              {total.errors} · {euros(fines)}
            </strong>
          </div>
          <div className="set-stepper">
            <button onClick={() => setSet((s) => Math.max(1, s - 1))} aria-label="Set anterior">
              −
            </button>
            <span className="n">Set {set}</span>
            <button onClick={() => setSet((s) => Math.min(9, s + 1))} aria-label="Set siguiente">
              +
            </button>
          </div>
        </div>

        <SectionTitle
          aside={
            <button className="btn quiet small" onClick={() => setEditingRoster(true)}>
              Asistentes
            </button>
          }
        >
          Toca quien saca
        </SectionTitle>

        {roster.length === 0 ? (
          <div className="card">
            <Empty icon={<PeopleIcon />} title="No hay nadie apuntada">
              Añade asistentes para poder anotar sus saques.
            </Empty>
            <button className="btn block" onClick={() => setEditingRoster(true)}>
              Editar asistentes
            </button>
          </div>
        ) : (
          <div className="player-grid">
            {roster.map((player) => {
              const own = tallyByPlayer(serves, player.id)
              return (
                <button key={player.id} className="player-tile" onClick={() => setPicking(player)}>
                  <span className="head">
                    <Avatar name={player.name} number={player.number} />
                    <span className="name">{player.name}</span>
                  </span>
                  {own.attempts > 0 ? (
                    <span className="line">
                      <span className={own.errors > 0 ? 'chip bad' : 'chip'}>
                        {plural(own.errors, 'fallo', 'fallos')}
                      </span>
                      <span className={own.ratio !== null && own.ratio < 0.5 ? 'chip bad' : 'chip good'}>
                        {percent(own.ratio)}
                      </span>
                    </span>
                  ) : (
                    <span className="line muted">No ha sacado</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {recent.length > 0 ? (
          <>
            <SectionTitle>Últimos saques</SectionTitle>
            <div className="card tight">
              <div className="log">
                {groupBySet(recent).map((group) => (
                  <div key={`${group.set}-${group.serves[0].id}`}>
                    <div className="log-set">Set {group.set}</div>
                    {group.serves.map((serve) => {
                      const player = state.players[serve.playerId]
                      return (
                        <div key={serve.id} className="log-item">
                          <span className={`serve-dot ${serve.result}`} aria-hidden="true">
                            {serve.result === 'error' ? (
                              <XIcon size={11} />
                            ) : serve.result === 'ace' ? (
                              <StarIcon size={11} />
                            ) : (
                              <CheckIcon size={11} />
                            )}
                          </span>
                          <Avatar name={player?.name ?? 'Jugadora'} number={player?.number} />
                          <span className="grow">{player?.name ?? 'Jugadora'}</span>
                          <button
                            className="undo"
                            onClick={() => removeServe(serve.id)}
                            aria-label={`Deshacer saque de ${player?.name ?? 'jugadora'}`}
                          >
                            <UndoIcon size={16} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {picking ? (
        <ResultSheet
          player={picking}
          serves={serves}
          fine={fineAmount(state)}
          onPick={(result) => {
            addServe(match.id, picking.id, result, set)
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}

      {confirmEnd ? (
        <Sheet title="¿Finalizar el partido?" onClose={() => setConfirmEnd(false)}>
          <div className="stack">
            <p className="small muted">
              Se cierra el acta con {plural(total.attempts, 'saque', 'saques')} y {euros(fines)} para
              la hucha. Podrás reabrirlo si falta algo.
            </p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setConfirmEnd(false)}>
                Seguir
              </button>
              <button
                className="btn"
                onClick={() => {
                  saveLineup(match.id, { status: 'finished' })
                  setConfirmEnd(false)
                }}
              >
                Finalizar
              </button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  )
}

function ResultSheet({
  player,
  serves,
  fine,
  onPick,
  onClose,
}: {
  player: Player
  serves: Serve[]
  fine: number
  onPick: (result: ServeResult) => void
  onClose: () => void
}) {
  const own = tallyByPlayer(serves, player.id)
  const lastFive = serves
    .filter((serve) => serve.playerId === player.id)
    .slice(-5)
    .reverse()

  return (
    <Sheet title="Resultado del saque" onClose={onClose}>
      <div className="sheet-player">
        <Avatar name={player.name} number={player.number} big />
        <div className="grow">
          <div className="title">{player.name}</div>
          <div className="meta">
            {own.attempts > 0 ? `${percent(own.ratio)} de acierto` : 'Todavía no ha sacado'}
          </div>
        </div>
        {lastFive.length > 0 ? (
          <div className="last-serves" aria-hidden="true">
            {lastFive.map((serve) => (
              <span key={serve.id} className={`serve-dot ${serve.result}`}>
                {serve.result === 'error' ? (
                  <XIcon size={11} />
                ) : serve.result === 'ace' ? (
                  <StarIcon size={11} />
                ) : (
                  <CheckIcon size={11} />
                )}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="result-buttons">
        <button className="err" onClick={() => onPick('error')}>
          <span className="glyph" aria-hidden="true">
            <XIcon size={20} />
          </span>
          Fallado
          <span className="note">{euros(fine)}</span>
        </button>
        <button className="ok" onClick={() => onPick('in')}>
          <span className="glyph" aria-hidden="true">
            <CheckIcon size={20} />
          </span>
          Dentro
        </button>
        <button className="ace" onClick={() => onPick('ace')}>
          <span className="glyph" aria-hidden="true">
            <StarIcon size={20} />
          </span>
          Ace
          <span className="note">punto directo</span>
        </button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ acta final

function MatchReport({ match, state }: { match: Match; state: AppState }) {
  const serves = servesOfMatch(state, match.id)
  const total = tally(serves)
  const fine = fineAmount(state)
  const fines = total.errors * fine
  const [toast, setToast] = useState('')

  const rows = participants(state, match.id)
    .map((player) => ({ player, own: tallyByPlayer(serves, player.id) }))
    .sort((a, b) => b.own.errors - a.own.errors || b.own.attempts - a.own.attempts)

  const onShare = async () => {
    const result = await share(matchSummary(state, match))
    if (result === 'copied') setToast('Resumen copiado al portapapeles')
    else if (result === 'failed') setToast('No se ha podido compartir')
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <>
      <ScreenHeader
        title={titleOf(match)}
        subtitle={matchDateLong(match.date)}
        onBack={() => navigate('partidos')}
      />
      <main>
        <div className="stat-row">
          <Stat value={total.attempts} label="Saques" />
          <Stat value={percent(total.ratio)} label="Dentro" tone="good" />
          <Stat value={euros(fines)} label="Hucha" tone="money" />
        </div>
        <RatioBar ratio={total.ratio} />

        {rows.length === 0 || total.attempts === 0 ? (
          <div className="card">
            <Empty icon={<ClipboardIcon />} title="No se anotó ningún saque" />
          </div>
        ) : (
          <>
            <SectionTitle>Por jugadora</SectionTitle>
            <div className="card flush">
              <div className="list">
                {rows.map(({ player, own }) => (
                  <div key={player.id} className="row">
                    <Avatar name={player.name} number={player.number} />
                    <span className="grow">
                      <span className="title">{player.name}</span>
                      <span className="meta">
                        {plural(own.attempts, 'saque', 'saques')} · {plural(own.aces, 'ace', 'aces')} ·{' '}
                        {percent(own.ratio)} dentro
                      </span>
                    </span>
                    <span className="trail">
                      <span className={own.errors > 0 ? 'chip bad' : 'chip good'}>
                        {own.errors}
                        <XIcon size={11} aria-hidden="true" />
                      </span>
                      <span className="meta">{own.errors > 0 ? euros(own.errors * fine) : '—'}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {match.leagueUrl ? (
          <div className="card tight">
            <LeagueLink url={match.leagueUrl} />
          </div>
        ) : null}

        <button className="btn block" onClick={onShare}>
          Compartir resumen
        </button>
        {toast ? <div className="banner good">{toast}</div> : null}

        <button className="btn quiet" onClick={() => saveLineup(match.id, { status: 'live' })}>
          Reabrir para seguir anotando
        </button>
      </main>
    </>
  )
}
