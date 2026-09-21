/** Resultado de un saque. `ace` cuenta como acierto, y además como punto directo. */
export type ServeResult = 'error' | 'in' | 'ace'

export type MatchStatus = 'scheduled' | 'live' | 'finished'

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

export interface Match extends Syncable {
  /** ISO 8601. Guardamos fecha y hora del partido. */
  date: string
  opponent: string
  venue: string
  home: boolean
  status: MatchStatus
  /** Ids de las jugadoras de la convocatoria. */
  roster: string[]
  externalId: string | null
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

export interface Settings {
  teamName: string
  /** Euros por saque fallado. */
  fineAmount: number
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
  serves: Record<string, Serve>
  payments: Record<string, Payment>
  settings: Settings
}

/** Las cuatro colecciones que viajan a Supabase. */
export type Collection = 'players' | 'matches' | 'serves' | 'payments'
export const COLLECTIONS: Collection[] = ['players', 'matches', 'serves', 'payments']
