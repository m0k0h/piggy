import { TEAM_ROW_ID, type AppState, type Lineup, type Match, type MatchStatus, type Payment, type Player, type Serve } from '../types'

const alive = <T extends { deletedAt: string | null }>(rows: Record<string, T>) =>
  Object.values(rows).filter((row) => row.deletedAt === null)

/** Sin dorsal, o con uno que no es un número, la jugadora va al final. */
const dorsalValue = (player: Player): number => {
  const trimmed = player.number.trim()
  if (!trimmed) return Infinity
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : Infinity
}

/** El orden de plantilla: por dorsal, y por nombre si hay empate. */
const byDorsal = (a: Player, b: Player): number =>
  dorsalValue(a) - dorsalValue(b) || a.name.localeCompare(b.name, 'es')

export const allPlayers = (s: AppState): Player[] => alive(s.players).sort(byDorsal)

export const allMatches = (s: AppState): Match[] =>
  alive(s.matches).sort((a, b) => b.date.localeCompare(a.date))

export const allServes = (s: AppState): Serve[] => alive(s.serves)
export const allPayments = (s: AppState): Payment[] => alive(s.payments)

export const fineAmount = (s: AppState): number => s.team.fineAmount
export const teamName = (s: AppState): string => s.team.name

/** Convocatoria de un partido, si ya se inició. */
export const lineupOf = (s: AppState, matchId: string): Lineup | null => {
  const lineup = s.lineups[matchId]
  return lineup && lineup.deletedAt === null ? lineup : null
}

/** Sin convocatoria, el partido sigue simplemente programado. */
export const matchStatus = (s: AppState, matchId: string): MatchStatus =>
  lineupOf(s, matchId)?.status ?? 'scheduled'

export const rosterIds = (s: AppState, matchId: string): string[] => lineupOf(s, matchId)?.roster ?? []

/** Las convocadas que siguen en la plantilla, en el orden en que se muestran. */
export const rosterOf = (s: AppState, matchId: string): Player[] =>
  rosterIds(s, matchId)
    .map((id) => s.players[id])
    .filter((player): player is Player => Boolean(player) && player.deletedAt === null)
    .sort(byDorsal)

/** Partidos aún por jugar o en curso, del más próximo al más lejano. */
export const upcomingMatches = (s: AppState): Match[] =>
  allMatches(s)
    .filter((match) => matchStatus(s, match.id) !== 'finished')
    .sort((a, b) => a.date.localeCompare(b.date))

export const finishedMatches = (s: AppState): Match[] =>
  allMatches(s).filter((match) => matchStatus(s, match.id) === 'finished')

/** Partidos con acta: los que ya tienen algo que contar. */
export const playedMatches = (s: AppState): Match[] =>
  allMatches(s).filter((match) => matchStatus(s, match.id) !== 'scheduled')

/** Lo que ya sabemos de un rival por haberlo jugado antes. */
export interface OpponentInfo {
  leagueUrl: string
  logo: string
}

const sameOpponent = (a: string, b: string) =>
  a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() ===
  b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Busca el enlace y el escudo que ya se pusieron a este rival en otro partido,
 * para no tener que pegarlos cada vez que le toca jugar.
 */
export function knownOpponent(s: AppState, opponent: string, exceptId = ''): OpponentInfo | null {
  if (!opponent.trim()) return null
  for (const match of allMatches(s)) {
    if (match.id === exceptId || !sameOpponent(match.opponent, opponent)) continue
    if (match.leagueUrl || match.opponentLogo) {
      return { leagueUrl: match.leagueUrl ?? '', logo: match.opponentLogo ?? '' }
    }
  }
  return null
}

export const servesOfMatch = (s: AppState, matchId: string): Serve[] =>
  allServes(s)
    .filter((serve) => serve.matchId === matchId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** Quién cuenta en el acta: la convocatoria más cualquiera que llegara a sacar. */
export function participants(s: AppState, matchId: string): Player[] {
  const ids = new Set(rosterIds(s, matchId))
  for (const serve of allServes(s)) {
    if (serve.matchId === matchId) ids.add(serve.playerId)
  }
  return [...ids]
    .map((id) => s.players[id])
    .filter((player): player is Player => Boolean(player))
    .sort(byDorsal)
}

export interface Tally {
  attempts: number
  errors: number
  in: number
  aces: number
  /** Saques que entraron (dentro + aces) sobre el total. `null` si no sacó nunca. */
  ratio: number | null
}

export function tally(serves: Serve[]): Tally {
  let errors = 0
  let inside = 0
  let aces = 0
  for (const serve of serves) {
    if (serve.result === 'error') errors++
    else if (serve.result === 'ace') aces++
    else inside++
  }
  const attempts = serves.length
  return {
    attempts,
    errors,
    in: inside,
    aces,
    ratio: attempts === 0 ? null : (inside + aces) / attempts,
  }
}

export const tallyByPlayer = (serves: Serve[], playerId: string): Tally =>
  tally(serves.filter((serve) => serve.playerId === playerId))

export interface Balance {
  player: Player
  tally: Tally
  /** Euros generados por fallos. */
  owed: number
  paid: number
  /** Lo que queda por poner en la hucha. */
  pending: number
}

/**
 * Cuentas de la hucha por jugadora, en el orden de plantilla (por dorsal).
 *
 * Incluye a quien ya no está en la plantilla pero sigue debiendo, para que la
 * suma de las filas cuadre siempre con el total de la hucha.
 */
export function balances(s: AppState): Balance[] {
  const serves = allServes(s)
  const payments = allPayments(s)
  const active = allPlayers(s)
  const activeIds = new Set(active.map((player) => player.id))
  const departed = Object.values(s.players).filter(
    (player) => !activeIds.has(player.id) && serves.some((serve) => serve.playerId === player.id),
  )

  return [...active, ...departed]
    .map((player) => {
      const own = tallyByPlayer(serves, player.id)
      const owed = own.errors * fineAmount(s)
      const paid = payments
        .filter((payment) => payment.playerId === player.id)
        .reduce((sum, payment) => sum + payment.amount, 0)
      return { player, tally: own, owed, paid, pending: owed - paid }
    })
    .filter((row) => activeIds.has(row.player.id) || row.pending > 0)
    .sort((a, b) => byDorsal(a.player, b.player))
}

export interface Pot {
  owed: number
  paid: number
  pending: number
  errors: number
}

/** Totales de la hucha del equipo. */
export function pot(s: AppState): Pot {
  const errors = tally(allServes(s)).errors
  const owed = errors * fineAmount(s)
  const paid = allPayments(s).reduce((sum, payment) => sum + payment.amount, 0)
  return { owed, paid, pending: owed - paid, errors }
}

/** Número de set más alto registrado en el partido (mínimo 1). */
export function currentSet(serves: Serve[]): number {
  return serves.reduce((max, serve) => Math.max(max, serve.set), 1)
}

export { TEAM_ROW_ID }
