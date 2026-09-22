import { useState } from 'react'
import { euros, matchDateLong, percent, plural, relativeDay } from '../lib/format'
import { goBack, navigate } from '../lib/router'
import { matchSummary, share } from '../lib/summary'
import { addServe, removeServe, saveLineup, useAppState } from '../lib/store'
import {
  allPlayers,
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
import type { AppState, Match, Player, ServeResult } from '../types'
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

export function MatchScreen({ matchId }: { matchId: string }) {
  const state = useAppState()
  const match = state.matches[matchId]

  if (!match || match.deletedAt) {
    return (
      <>
        <ScreenHeader title="Partido" onBack={() => navigate('partidos')} />
        <main>
          <div className="card">
            <Empty glyph="🤷" title="Este partido ya no existe" />
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

// --------------------------------------------------------------- programado

function MatchPreview({ match, state }: { match: Match; state: AppState }) {
  const [callUp, setCallUp] = useState(false)

  if (callUp) {
    return (
      <CallUp
        match={match}
        state={state}
        onCancel={() => setCallUp(false)}
        onConfirm={(roster) => {
          saveLineup(match.id, { roster, status: 'live' })
          setCallUp(false)
        }}
      />
    )
  }

  return (
    <>
      <ScreenHeader
        title={titleOf(match)}
        subtitle={relativeDay(match.date)}
        onBack={goBack}
      />
      <main>
        <div className="card stack">
          <div className="inline">
            <OpponentCrest opponent={match.opponent} logo={match.opponentLogo} big />
            <div className="grow">
              <div className="small muted">{match.home ? 'En casa' : 'Fuera'}</div>
              <h2>{match.opponent || 'Rival por definir'}</h2>
            </div>
          </div>
          <div className="small muted">
            {matchDateLong(match.date)}
            {match.venue ? ` · ${match.venue}` : ''}
          </div>
          <LeagueLink url={match.leagueUrl} />
          <button className="btn block" onClick={() => setCallUp(true)}>
            Iniciar partido
          </button>
          <p className="small muted center">Primero te preguntará quién ha venido.</p>
        </div>
      </main>
    </>
  )
}

// -------------------------------------------------------------- convocatoria

function CallUp({
  match,
  state,
  onCancel,
  onConfirm,
}: {
  match: Match
  state: AppState
  onCancel: () => void
  onConfirm: (roster: string[]) => void
}) {
  const players = allPlayers(state)
  const [selected, setSelected] = useState<string[]>(() => rosterIds(state, match.id))

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )

  return (
    <>
      <ScreenHeader
        title="Convocatoria"
        subtitle={plural(selected.length, 'convocada', 'convocadas')}
        onBack={onCancel}
      />
      <main>
        {players.length === 0 ? (
          <div className="card">
            <Empty glyph="🏐" title="No hay jugadoras en la plantilla">
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
                  return (
                    <button
                      key={player.id}
                      className="row"
                      onClick={() => toggle(player.id)}
                      aria-pressed={on}
                    >
                      <Avatar name={player.name} on={on} />
                      <span className="grow">
                        <span className="title">{player.name}</span>
                        {player.number ? <span className="meta">Dorsal {player.number}</span> : null}
                      </span>
                      <span className="trail" aria-hidden="true">
                        {on ? '✓' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <button
          className="btn block"
          onClick={() => onConfirm(selected)}
          disabled={selected.length === 0}
        >
          Empezar partido ({selected.length})
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
              Convocatoria
            </button>
          }
        >
          Toca quien saca
        </SectionTitle>

        {roster.length === 0 ? (
          <div className="card">
            <Empty glyph="👥" title="No hay nadie convocada">
              Añade jugadoras a la convocatoria para empezar a anotar.
            </Empty>
            <button className="btn block" onClick={() => setEditingRoster(true)}>
              Editar convocatoria
            </button>
          </div>
        ) : (
          <div className="player-grid">
            {roster.map((player) => {
              const own = tallyByPlayer(serves, player.id)
              return (
                <button key={player.id} className="player-tile" onClick={() => setPicking(player)}>
                  <span className="name">{player.name}</span>
                  {player.number ? <span className="num">#{player.number}</span> : null}
                  <span className="line">
                    <span className={own.errors > 0 ? 'chip bad' : 'chip'}>
                      {plural(own.errors, 'fallo', 'fallos')}
                    </span>
                    <span className="chip good">{percent(own.ratio)}</span>
                  </span>
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
                {recent.map((serve) => {
                  const player = state.players[serve.playerId]
                  return (
                    <div key={serve.id} className="log-item">
                      <span aria-hidden="true">
                        {serve.result === 'error' ? '❌' : serve.result === 'ace' ? '⭐' : '✅'}
                      </span>
                      <span className="grow">{player?.name ?? 'Jugadora'}</span>
                      <span className="muted small">Set {serve.set}</span>
                      <button
                        className="undo"
                        onClick={() => removeServe(serve.id)}
                        aria-label={`Deshacer saque de ${player?.name ?? 'jugadora'}`}
                      >
                        Deshacer
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}
      </main>

      {picking ? (
        <ResultSheet
          player={picking}
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
  fine,
  onPick,
  onClose,
}: {
  player: Player
  fine: number
  onPick: (result: ServeResult) => void
  onClose: () => void
}) {
  return (
    <Sheet title={`Saque de ${player.name}`} onClose={onClose}>
      <div className="result-buttons">
        <button className="err" onClick={() => onPick('error')}>
          <span className="glyph" aria-hidden="true">
            ❌
          </span>
          Fallado
          <span className="note">{euros(fine)}</span>
        </button>
        <button className="ok" onClick={() => onPick('in')}>
          <span className="glyph" aria-hidden="true">
            ✅
          </span>
          Dentro
        </button>
        <button className="ace" onClick={() => onPick('ace')}>
          <span className="glyph" aria-hidden="true">
            ⭐
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
            <Empty glyph="📋" title="No se anotó ningún saque" />
          </div>
        ) : (
          <>
            <SectionTitle>Por jugadora</SectionTitle>
            <div className="card flush">
              <div className="list">
                {rows.map(({ player, own }) => (
                  <div key={player.id} className="row">
                    <Avatar name={player.name} />
                    <span className="grow">
                      <span className="title">{player.name}</span>
                      <span className="meta">
                        {plural(own.attempts, 'saque', 'saques')} · {plural(own.aces, 'ace', 'aces')} ·{' '}
                        {percent(own.ratio)} dentro
                      </span>
                    </span>
                    <span className="trail">
                      <span className={own.errors > 0 ? 'chip bad' : 'chip good'}>
                        {own.errors} ❌
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
