import { useSyncExternalStore } from 'react'
import {
  TEAM_ROW_ID,
  type AppState,
  type Collection,
  type Lineup,
  type Match,
  type MatchStatus,
  type Payment,
  type Player,
  type Serve,
  type ServeResult,
  type Syncable,
  type Team,
} from '../types'

const STORAGE_KEY = 'piggy.state.v2'
/** Formato anterior, cuando el estado del partido vivía dentro del propio partido. */
const LEGACY_KEY = 'piggy.state.v1'

const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

const defaultTeam = (): Team => ({
  id: TEAM_ROW_ID,
  name: 'Mi equipo',
  fineAmount: 1,
  logo: '',
  createdAt: now(),
  updatedAt: now(),
  deletedAt: null,
})

const empty = (): AppState => ({
  players: {},
  matches: {},
  lineups: {},
  serves: {},
  payments: {},
  team: defaultTeam(),
})

/** Sube un estado del formato v1, donde `status` y `roster` estaban en el partido. */
export function migrate(raw: string): AppState {
  const old = JSON.parse(raw) as Record<string, never>
  const base = empty()
  const oldMatches = (old.matches ?? {}) as Record<string, Match & { status?: MatchStatus; roster?: string[] }>
  const matches: Record<string, Match> = {}
  const lineups: Record<string, Lineup> = {}

  for (const [id, entry] of Object.entries(oldMatches)) {
    const { status, roster, ...match } = entry
    matches[id] = match
    if (status && status !== 'scheduled') {
      lineups[id] = {
        id,
        matchId: id,
        roster: roster ?? [],
        status,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
        deletedAt: null,
      }
    }
  }

  const oldSettings = (old.settings ?? {}) as { teamName?: string; fineAmount?: number }
  return {
    ...base,
    players: (old.players ?? {}) as AppState['players'],
    matches,
    lineups,
    serves: (old.serves ?? {}) as AppState['serves'],
    payments: (old.payments ?? {}) as AppState['payments'],
    team: {
      ...defaultTeam(),
      name: oldSettings.teamName ?? 'Mi equipo',
      fineAmount: typeof oldSettings.fineAmount === 'number' ? oldSettings.fineAmount : 1,
    },
  }
}

/** Queda a true si este arranque vino del formato antiguo. */
let migratedOnLoad = false

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      return {
        ...empty(),
        ...parsed,
        team: { ...defaultTeam(), ...(parsed.team ?? {}) },
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      migratedOnLoad = true
      return migrate(legacy)
    }
  } catch {
    // Un estado corrupto no debe dejar la app en blanco a mitad de partido.
  }
  return empty()
}

let state: AppState = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Cuota llena o modo privado: seguimos en memoria antes que romper el registro.
  }
}

// Guardamos el formato nuevo en cuanto migramos. Si esperásemos al primer
// cambio, un móvil que solo consulta repetiría la conversión en cada arranque.
if (migratedOnLoad) persist()

/** La capa de sync se engancha aquí para subir lo que cambia en local. */
let onLocalChange: ((collection: Collection, rows: Syncable[]) => void) | null = null
export function setSyncPublisher(fn: typeof onLocalChange) {
  onLocalChange = fn
}

function commit(next: AppState) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

export const getState = () => state
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const useAppState = () => useSyncExternalStore(subscribe, getState, getState)

/** Escribe filas en una colección y las publica al sync. */
function write<T extends Syncable>(collection: Collection, rows: T[], publish = true) {
  if (rows.length === 0) return
  if (collection === 'team') {
    commit({ ...state, team: rows[0] as unknown as Team })
  } else {
    const bucket: Record<string, Syncable> = { ...state[collection] }
    for (const row of rows) bucket[row.id] = row
    commit({ ...state, [collection]: bucket })
  }
  if (publish) onLocalChange?.(collection, rows)
}

/** Crea una fila nueva con los campos de sincronización ya puestos. */
function born<T extends Syncable>(fields: Omit<T, keyof Syncable>, id: string = newId()): T {
  const ts = now()
  return { ...fields, id, createdAt: ts, updatedAt: ts, deletedAt: null } as T
}

// --- Equipo ----------------------------------------------------------------

export function updateTeam(patch: Partial<Pick<Team, 'name' | 'fineAmount' | 'logo'>>) {
  write('team', [{ ...state.team, ...patch, updatedAt: now() }])
}

// --- Jugadoras -------------------------------------------------------------

export function addPlayer(name: string, number = '', externalId: string | null = null): Player {
  const player = born<Player>({ name: name.trim(), number: number.trim(), externalId })
  write('players', [player])
  return player
}

export function updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'number'>>) {
  const current = state.players[id]
  if (!current) return
  write('players', [{ ...current, ...patch, updatedAt: now() }])
}

export function removePlayer(id: string) {
  const current = state.players[id]
  if (!current) return
  write('players', [{ ...current, deletedAt: now(), updatedAt: now() }])
}

// --- Partidos --------------------------------------------------------------

export interface MatchInput {
  date: string
  opponent: string
  venue?: string
  home?: boolean
  externalId?: string | null
}

export function addMatch(input: MatchInput): Match {
  const match = born<Match>({
    date: input.date,
    opponent: input.opponent.trim(),
    venue: (input.venue ?? '').trim(),
    home: input.home ?? true,
    externalId: input.externalId ?? null,
  })
  write('matches', [match])
  return match
}

export function updateMatch(
  id: string,
  patch: Partial<Pick<Match, 'date' | 'opponent' | 'venue' | 'home'>>,
) {
  const current = state.matches[id]
  if (!current) return
  write('matches', [{ ...current, ...patch, updatedAt: now() }])
}

export function removeMatch(id: string) {
  const current = state.matches[id]
  if (!current) return
  write('matches', [{ ...current, deletedAt: now(), updatedAt: now() }])
}

// --- Convocatoria y estado del acta ----------------------------------------

/** Crea o actualiza la convocatoria de un partido. Su id es el del partido. */
export function saveLineup(matchId: string, patch: Partial<Pick<Lineup, 'roster' | 'status'>>) {
  const current = state.lineups[matchId]
  const next: Lineup = current
    ? { ...current, ...patch, deletedAt: null, updatedAt: now() }
    : born<Lineup>({ matchId, roster: patch.roster ?? [], status: patch.status ?? 'live' }, matchId)
  write('lineups', [next])
}

export const setMatchStatus = (matchId: string, status: MatchStatus) => saveLineup(matchId, { status })

// --- Saques ----------------------------------------------------------------

export function addServe(matchId: string, playerId: string, result: ServeResult, set: number): Serve {
  const serve = born<Serve>({ matchId, playerId, result, set })
  write('serves', [serve])
  return serve
}

export function removeServe(id: string) {
  const current = state.serves[id]
  if (!current) return
  write('serves', [{ ...current, deletedAt: now(), updatedAt: now() }])
}

// --- Pagos -----------------------------------------------------------------

export function addPayment(playerId: string, amount: number, note = ''): Payment {
  const payment = born<Payment>({ playerId, amount, note: note.trim() })
  write('payments', [payment])
  return payment
}

export function removePayment(id: string) {
  const current = state.payments[id]
  if (!current) return
  write('payments', [{ ...current, deletedAt: now(), updatedAt: now() }])
}

// --- Sincronización --------------------------------------------------------

/**
 * Aplica filas que llegan del servidor. Gana la versión con `updatedAt` mayor,
 * y no se republica para no entrar en bucle con el realtime.
 */
export function applyRemote(collection: Collection, rows: Syncable[]) {
  if (collection === 'team') {
    const incoming = rows.find((row) => row.id === TEAM_ROW_ID)
    if (incoming && incoming.updatedAt > state.team.updatedAt) write('team', [incoming], false)
    return
  }
  const bucket = state[collection] as Record<string, Syncable>
  const fresh = rows.filter((row) => {
    const mine = bucket[row.id]
    return !mine || row.updatedAt > mine.updatedAt
  })
  write(collection, fresh, false)
}

/** Todas las filas locales de una colección, para subirlas de golpe. */
export function rowsOf(collection: Collection): Syncable[] {
  return collection === 'team' ? [state.team] : Object.values(state[collection])
}

// --- Copia de seguridad ----------------------------------------------------

export const exportState = () => JSON.stringify(state, null, 2)

export function importState(json: string) {
  const parsed = JSON.parse(json) as Partial<AppState>
  commit({
    ...empty(),
    ...parsed,
    team: { ...defaultTeam(), ...(parsed.team ?? {}) },
  })
}

export function resetState() {
  commit({ ...empty(), team: state.team })
}
