import { useSyncExternalStore } from 'react'
import type {
  AppState,
  Collection,
  Match,
  MatchStatus,
  Payment,
  Player,
  Serve,
  ServeResult,
  Settings,
  Syncable,
} from '../types'

const STORAGE_KEY = 'piggy.state.v1'

export const DEFAULT_SETTINGS: Settings = {
  teamName: 'Mi equipo',
  fineAmount: 1,
  teamUrl: 'https://sportagia.voleimasters.cat/#/equip/31',
  teamCode: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
}

const EMPTY: AppState = {
  players: {},
  matches: {},
  serves: {},
  payments: {},
  settings: DEFAULT_SETTINGS,
}

export const newId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...EMPTY,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    // Un estado corrupto no debe dejar la app en blanco a mitad de partido.
    return EMPTY
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

/** La capa de sync se engancha aquí para subir lo que cambia en local. */
let onLocalChange: ((collection: Collection, rows: Syncable[]) => void) | null = null
export function setSyncPublisher(fn: typeof onLocalChange) {
  onLocalChange = fn
}

function commit(next: AppState) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Cuota llena o modo privado: seguimos en memoria antes que romper el registro.
  }
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
  const bucket: Record<string, Syncable> = { ...state[collection] }
  for (const row of rows) bucket[row.id] = row
  commit({ ...state, [collection]: bucket })
  if (publish) onLocalChange?.(collection, rows)
}

/** Crea una fila nueva con los campos de sincronización ya puestos. */
function born<T extends Syncable>(fields: Omit<T, keyof Syncable>): T {
  const ts = now()
  return { ...fields, id: newId(), createdAt: ts, updatedAt: ts, deletedAt: null } as T
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
    status: 'scheduled',
    roster: [],
    externalId: input.externalId ?? null,
  })
  write('matches', [match])
  return match
}

export function updateMatch(
  id: string,
  patch: Partial<Pick<Match, 'date' | 'opponent' | 'venue' | 'home' | 'status' | 'roster'>>,
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

export function setMatchStatus(id: string, status: MatchStatus) {
  updateMatch(id, { status })
}

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

// --- Ajustes ---------------------------------------------------------------

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } })
}

// --- Sincronización --------------------------------------------------------

/**
 * Aplica filas que llegan del servidor. Gana la versión con `updatedAt` mayor,
 * y no se republica para no entrar en bucle con el realtime.
 */
export function applyRemote(collection: Collection, rows: Syncable[]) {
  const bucket = state[collection] as Record<string, Syncable>
  const fresh = rows.filter((row) => {
    const mine = bucket[row.id]
    return !mine || row.updatedAt > mine.updatedAt
  })
  write(collection, fresh, false)
}

// --- Copia de seguridad ----------------------------------------------------

export const exportState = () => JSON.stringify(state, null, 2)

export function importState(json: string) {
  const parsed = JSON.parse(json) as Partial<AppState>
  commit({
    ...EMPTY,
    ...parsed,
    settings: { ...state.settings, ...(parsed.settings ?? {}) },
  })
}

export function resetState() {
  commit({ ...EMPTY, settings: state.settings })
}
