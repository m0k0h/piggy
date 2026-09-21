import type { AppState, Match, Payment, Player, Serve } from '../types'

const alive = <T extends { deletedAt: string | null }>(rows: Record<string, T>) =>
  Object.values(rows).filter((row) => row.deletedAt === null)

export const allPlayers = (s: AppState): Player[] =>
  alive(s.players).sort((a, b) => a.name.localeCompare(b.name, 'es'))

export const allMatches = (s: AppState): Match[] =>
  alive(s.matches).sort((a, b) => b.date.localeCompare(a.date))

export const allServes = (s: AppState): Serve[] => alive(s.serves)
export const allPayments = (s: AppState): Payment[] => alive(s.payments)

/** Partidos aún por jugar o en curso, del más próximo al más lejano. */
export const upcomingMatches = (s: AppState): Match[] =>
  allMatches(s)
    .filter((m) => m.status !== 'finished')
    .sort((a, b) => a.date.localeCompare(b.date))

export const finishedMatches = (s: AppState): Match[] =>
  allMatches(s).filter((m) => m.status === 'finished')

export const servesOfMatch = (s: AppState, matchId: string): Serve[] =>
  allServes(s)
    .filter((serve) => serve.matchId === matchId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** Quién cuenta en el acta de un partido: la convocatoria más quien llegó a sacar. */
export function participants(s: AppState, matchId: string, roster: string[]) {
  const ids = new Set(roster)
  for (const serve of allServes(s)) {
    if (serve.matchId === matchId) ids.add(serve.playerId)
  }
  return [...ids]
    .map((id) => s.players[id])
    .filter((player): player is Player => Boolean(player))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
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
 * Cuentas de la hucha por jugadora, de más deuda pendiente a menos.
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
      const owed = own.errors * s.settings.fineAmount
      const paid = payments
        .filter((payment) => payment.playerId === player.id)
        .reduce((sum, payment) => sum + payment.amount, 0)
      return { player, tally: own, owed, paid, pending: owed - paid }
    })
    .filter((row) => activeIds.has(row.player.id) || row.pending > 0)
    .sort((a, b) => b.pending - a.pending || b.owed - a.owed)
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
  const owed = errors * s.settings.fineAmount
  const paid = allPayments(s).reduce((sum, payment) => sum + payment.amount, 0)
  return { owed, paid, pending: owed - paid, errors }
}

/** Número de set más alto registrado en el partido (mínimo 1). */
export function currentSet(serves: Serve[]): number {
  return serves.reduce((max, serve) => Math.max(max, serve.set), 1)
}
