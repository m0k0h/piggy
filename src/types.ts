/** Resultado de un saque. `ace` cuenta como acierto, y además como punto directo. */
export type ServeResult = 'error' | 'in' | 'ace'

export type MatchStatus = 'scheduled' | 'live' | 'finished'

/**
 * Quién está usando la app.
 *
 * `admin` prepara el equipo: plantilla, calendario, cobros y ajustes.
 * `player` solo abre un partido ya creado y anota saques; la hucha y las
 * estadísticas las ve, pero no las toca.
 *
 * El rol de verdad lo decide Postgres, no esta app: sin sesión iniciada, la
 * base de datos rechaza cualquier escritura que no sea de saques o convocatoria.
 */
export type Role = 'admin' | 'player'

/** Campos comunes a todo lo sincronizable: el merge se resuelve por `updatedAt`. */
export interface Syncable {
  id: string
  createdAt: string
  updatedAt: string
  /** Borrado lógico: nunca borramos filas, así el merge entre móviles es monótono. */
  deletedAt: string | null
}

export interface Player extends Syncable {
  name: string
  /** Dorsal. Texto porque en Sportagia a veces viene vacío o con formato raro. */
  number: string
  /** Id en Sportagia, si vino de allí. Sirve para no duplicar al reimportar. */
  externalId: string | null
}

/** El partido tal como lo deja preparado la administradora. Solo ella lo edita. */
export interface Match extends Syncable {
  /** ISO 8601. Guardamos fecha y hora del partido. */
  date: string
  opponent: string
  venue: string
  home: boolean
  externalId: string | null
}

/**
 * Lo que pasa el día del partido: quién vino y en qué punto está el acta.
 *
 * Va aparte del partido a propósito. Así el equipo puede iniciar y cerrar el
 * acta sin permiso para tocar la fecha o el rival, y dos móviles editando a la
 * vez (una anotando, la admin corrigiendo el calendario) no se pisan.
 *
 * `id` es el id del partido: hay como mucho una convocatoria por partido.
 */
export interface Lineup extends Syncable {
  matchId: string
  /** Ids de las jugadoras convocadas. */
  roster: string[]
  status: MatchStatus
}

export interface Serve extends Syncable {
  matchId: string
  playerId: string
  result: ServeResult
  set: number
}

/** Un pago a la hucha: descuenta de lo que debe la jugadora. */
export interface Payment extends Syncable {
  playerId: string
  amount: number
  note: string
}

/**
 * Los datos del equipo que todas deben ver iguales. Fila única con id `team`,
 * sincronizada como una más; si la admin sube la multa a 2 €, sube para todas.
 */
export interface Team extends Syncable {
  name: string
  /** Euros por saque fallado. */
  fineAmount: number
}

/** Configuración de este móvil. No se sincroniza: dice a qué equipo conectarse. */
export interface Settings {
  /** URL del equipo en Sportagia, para el importador. */
  teamUrl: string
  /** Código compartido: todas las que lo usan ven los mismos datos. */
  teamCode: string
  supabaseUrl: string
  supabaseAnonKey: string
}

export interface AppState {
  players: Record<string, Player>
  matches: Record<string, Match>
  lineups: Record<string, Lineup>
  serves: Record<string, Serve>
  payments: Record<string, Payment>
  team: Team
  settings: Settings
}

/** Las colecciones que viajan a la base de datos. */
export type Collection = 'players' | 'matches' | 'lineups' | 'serves' | 'payments' | 'team'

export const COLLECTIONS: Collection[] = [
  'players',
  'matches',
  'lineups',
  'serves',
  'payments',
  'team',
]

/**
 * Lo único que una jugadora sin sesión puede escribir. Misma lista, palabra por
 * palabra, que la política de la base de datos en `supabase/schema.sql`.
 */
export const PLAYER_WRITABLE: Collection[] = ['lineups', 'serves']

export const TEAM_ROW_ID = 'team'
