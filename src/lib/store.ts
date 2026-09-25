import { useSyncExternalStore } from 'react'
import {
  TEAM_ROW_ID,
  type AppState,
  type Collection,
  type League,
  type Lineup,
  type Match,
  type MatchStatus,
  type Notice,
  type Payment,
  type Player,
  type Position,
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

/**
 * Fecha de un equipo que nadie ha tocado: más vieja que cualquiera. Un móvil
 * recién estrenado tiene que aceptar el equipo del servidor, no pisarlo con
 * el suyo de fábrica por tener la hora de ahora.
 */
const NEVER = new Date(0).toISOString()

const defaultTeam = (): Team => ({
  id: TEAM_ROW_ID,
  name: 'Mi equipo',
  fineAmount: 1,
  logo: '',
  createdAt: NEVER,
  updatedAt: NEVER,
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

/** Lo que se va con el borrado de prueba: los partidos con todo lo anotado, y los cobros. */
export const WIPE_COLLECTIONS: readonly Collection[] = ['matches', 'lineups', 'serves', 'payments']

/**
 * Una fila de lo borrado en la prueba: creada hasta `resetAt`. No se enseña,
 * no se guarda y no se sube, venga de donde venga — de la copia local de un
 * móvil que no llegó a purgar, o del servidor si alguno ya la volvió a subir.
 */
/**
 * El borrado de prueba se hizo la noche del 24 de septiembre de 2026, antes de
 * esta hora. Es el suelo de `resetAt`: aunque algún móvil o el propio servidor
 * hayan perdido la marca del equipo, lo de antes no vuelve.
 */
const WIPED_UNTIL = '2026-09-24T22:29:31.000Z'

/** Hasta cuándo va lo borrado: la marca del equipo, y nunca antes del suelo. */
const resetOf = (team: Team) => [team.resetAt ?? '', WIPED_UNTIL].sort().at(-1) ?? WIPED_UNTIL

function wiped(collection: Collection, row: Syncable, resetAt: string) {
  return resetAt !== '' && WIPE_COLLECTIONS.includes(collection) && row.createdAt <= resetAt
}

/**
 * Quita de un estado lo creado hasta `team.resetAt` en partidos, convocatorias,
 * saques y cobros. Las jugadoras y los datos del equipo no se tocan. Si no hay
 * nada que quitar, devuelve el mismo estado.
 */
function withoutWiped(s: AppState): AppState {
  const resetAt = resetOf(s.team)
  let changed = false
  const next = { ...s }
  for (const collection of WIPE_COLLECTIONS) {
    const rows = Object.entries(s[collection as keyof AppState] as Record<string, Syncable>)
    const kept = rows.filter(([, row]) => !wiped(collection, row, resetAt))
    if (kept.length !== rows.length) {
      changed = true
      ;(next as Record<string, unknown>)[collection] = Object.fromEntries(kept)
    }
  }
  return changed ? next : s
}

// Al arrancar ya se tira lo borrado que quedara en la copia local.
let state: AppState = withoutWiped(load())
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

/** Publica en la portada lo que hay que comentar, sustituyendo lo anterior. */
export function publishNotice(text: string, image: string): Notice | null {
  const clean = text.trim()
  if (!clean && !image) return null
  const notice: Notice = { text: clean, image, publishedAt: now() }
  write('team', [{ ...state.team, notice, updatedAt: now() }])
  return notice
}

export function removeNotice() {
  if (!state.team.notice) return
  write('team', [{ ...state.team, notice: null, updatedAt: now() }])
}

// --- Jugadoras -------------------------------------------------------------

export function addPlayer(
  name: string,
  number = '',
  externalId: string | null = null,
  position?: Position,
): Player {
  const player = born<Player>({
    name: name.trim(),
    number: number.trim(),
    externalId,
    ...(position ? { position } : {}),
  })
  write('players', [player])
  return player
}

export function updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'number' | 'position'>>) {
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
  leagueUrl?: string
  opponentLogo?: string
  mapsUrl?: string
  league?: League
}

export function addMatch(input: MatchInput): Match {
  const match = born<Match>({
    date: input.date,
    opponent: input.opponent.trim(),
    venue: (input.venue ?? '').trim(),
    home: input.home ?? true,
    externalId: input.externalId ?? null,
    leagueUrl: (input.leagueUrl ?? '').trim(),
    opponentLogo: (input.opponentLogo ?? '').trim(),
    mapsUrl: (input.mapsUrl ?? '').trim(),
    ...(input.league ? { league: input.league } : {}),
  })
  write('matches', [match])
  return match
}

export function updateMatch(
  id: string,
  patch: Partial<Pick<Match, 'date' | 'opponent' | 'venue' | 'home' | 'leagueUrl' | 'opponentLogo' | 'mapsUrl' | 'league'>>,
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
    const incoming = rows.find((row) => row.id === TEAM_ROW_ID) as Team | undefined
    if (incoming) {
      // La marca solo avanza: un equipo que llegue sin ella (subido desde un
      // móvil que no la tenía) no la borra de los demás.
      const resetAt = [incoming.resetAt ?? '', state.team.resetAt ?? ''].sort().at(-1) || undefined
      if (incoming.updatedAt > state.team.updatedAt) write('team', [{ ...incoming, resetAt }], false)
      else if (resetAt !== state.team.resetAt) write('team', [{ ...state.team, resetAt }], false)
    }
    // La purga no depende de que el equipo llegue más nuevo: un móvil puede
    // tener ya la marca guardada sin haber tirado su copia (la recibió con una
    // versión anterior de la app). Quitar lo borrado es idempotente.
    const clean = withoutWiped(state)
    if (clean !== state) commit(clean)
    return
  }
  const bucket = state[collection] as Record<string, Syncable>
  const fresh = rows.filter((row) => {
    if (wiped(collection, row, resetOf(state.team))) return false
    const mine = bucket[row.id]
    return !mine || row.updatedAt > mine.updatedAt
  })
  write(collection, fresh, false)
}

/** Todas las filas locales de una colección, para subirlas de golpe. */
export function rowsOf(collection: Collection): Syncable[] {
  if (collection === 'team') return [state.team]
  const resetAt = resetOf(state.team)
  return Object.values(state[collection] as Record<string, Syncable>).filter((row) => !wiped(collection, row, resetAt))
}
