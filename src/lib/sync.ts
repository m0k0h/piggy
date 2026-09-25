import { useSyncExternalStore } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { COLLECTIONS, PLAYER_WRITABLE, type Collection, type Role, type Syncable } from '../types'
import { teamConfig } from './config'
import { applyRemote, rowsOf, setSyncPublisher } from './store'
import type { View, ViewRecord } from './views'

/**
 * Todo viaja en una sola tabla con el documento en JSON. Así el esquema no
 * cambia cada vez que la app gana un campo nuevo, basta una suscripción de
 * realtime, y las políticas de permisos se escriben por colección.
 */
const TABLE = 'piggy_rows'

export type SyncStatus = 'off' | 'connecting' | 'online' | 'error'

export interface SyncSnapshot {
  status: SyncStatus
  message: string
  /** Filas locales esperando a subir (por ejemplo, sin cobertura en el pabellón). */
  pending: number
  lastSyncedAt: string | null
  /** Hay sesión de administradora iniciada. */
  signedIn: boolean
  email: string
}

const INITIAL: SyncSnapshot = {
  status: 'off',
  message: '',
  pending: 0,
  lastSyncedAt: null,
  signedIn: false,
  email: '',
}

let snapshot: SyncSnapshot = INITIAL
const watchers = new Set<() => void>()

export const getSyncSnapshot = () => snapshot
export function subscribeSync(fn: () => void) {
  watchers.add(fn)
  return () => watchers.delete(fn)
}
function setSnapshot(patch: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  watchers.forEach((w) => w())
}

/** Estado de la conexión, para pintarlo en la interfaz. */
export const useSync = () => useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot)

/**
 * Sin base de datos compartida no hay equipo y la app es toda tuya. En cuanto
 * la hay, mandas solo si has iniciado sesión: lo demás es vista de jugadora.
 */
export function roleOf(snap: SyncSnapshot): Role {
  if (snap.status === 'off') return 'admin'
  return snap.signedIn ? 'admin' : 'player'
}

export const useRole = (): Role => roleOf(useSync())

interface RowRecord {
  team_code: string
  collection: Collection
  id: string
  updated_at: string
  payload: Syncable
}

let client: SupabaseClient | null = null
let channel: RealtimeChannel | null = null
let teamCode = ''
/** Cola de pendientes por subir, indexada para no mandar la misma fila dos veces. */
const queue = new Map<string, RowRecord>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

const canWrite = (collection: Collection) =>
  roleOf(snapshot) === 'admin' || PLAYER_WRITABLE.includes(collection)

const toRecord = (collection: Collection, row: Syncable): RowRecord => ({
  team_code: teamCode,
  collection,
  id: row.id,
  updated_at: row.updatedAt,
  payload: row,
})

function enqueue(collection: Collection, rows: Syncable[]) {
  // Sin permiso para esta colección no lo intentamos: un rechazo del servidor
  // atascaría la cola y con ella los saques, que sí puede escribir cualquiera.
  if (!client || !canWrite(collection)) return
  for (const row of rows) queue.set(`${collection}:${row.id}`, toRecord(collection, row))
  setSnapshot({ pending: queue.size })
  scheduleFlush()
}

function scheduleFlush(delay = 400) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(), delay)
}

async function flush() {
  flushTimer = null
  if (!client || queue.size === 0) return
  const batch = [...queue.values()]
  const { error } = await client.from(TABLE).upsert(batch, { onConflict: 'team_code,collection,id' })
  if (error) {
    // Nos quedamos la cola y reintentamos: los datos ya están a salvo en local.
    setSnapshot({ status: 'error', message: error.message, pending: queue.size })
    scheduleFlush(5000)
    return
  }
  for (const record of batch) queue.delete(`${record.collection}:${record.id}`)
  setSnapshot({
    status: 'online',
    message: '',
    pending: queue.size,
    lastSyncedAt: new Date().toISOString(),
  })
}

async function pull() {
  if (!client) return
  const { data, error } = await client
    .from(TABLE)
    .select('collection,payload')
    .eq('team_code', teamCode)
  if (error) throw new Error(error.message)

  const grouped = new Map<Collection, Syncable[]>()
  for (const record of (data ?? []) as Pick<RowRecord, 'collection' | 'payload'>[]) {
    const bucket = grouped.get(record.collection) ?? []
    bucket.push(record.payload)
    grouped.set(record.collection, bucket)
  }
  // El equipo primero: trae la marca del borrado de prueba, y con ella se
  // descarta lo que llegue de antes en el resto de colecciones.
  const team = grouped.get('team')
  if (team) applyRemote('team', team)
  for (const [collection, rows] of grouped) if (collection !== 'team') applyRemote(collection, rows)
}

/**
 * Sube todo lo local que este rol pueda escribir. Se llama justo después de
 * `pull`, cuando el estado local ya es el más reciente de los dos lados, así
 * que nunca pisa nada más nuevo.
 */
function pushEverything() {
  for (const collection of COLLECTIONS) {
    if (!canWrite(collection)) continue
    const rows = rowsOf(collection)
    if (rows.length > 0) enqueue(collection, rows)
  }
  scheduleFlush(0)
}

function listenRealtime() {
  if (!client) return
  channel = client
    .channel(`piggy:${teamCode}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `team_code=eq.${teamCode}` },
      (payload) => {
        const record = payload.new as RowRecord | null
        if (record?.payload && record.collection) applyRemote(record.collection, [record.payload])
      },
    )
    .subscribe()
}

export function disconnect() {
  if (channel) void client?.removeChannel(channel)
  channel = null
  client = null
  queue.clear()
  setSyncPublisher(null)
  setSnapshot(INITIAL)
}

/** Conecta con la base de datos del equipo. Sin configurar, se queda en local. */
export async function connect() {
  disconnect()
  if (!teamConfig) return

  teamCode = teamConfig.code
  setSnapshot({ status: 'connecting', message: '' })
  try {
    // Carga diferida: sin equipo compartido, la app arranca sin bajar el SDK.
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(teamConfig.url, teamConfig.anonKey, {
      // La sesión persiste para que la admin no tenga que entrar cada vez.
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'piggy.auth' },
    })

    const { data } = await client.auth.getSession()
    setSnapshot({ signedIn: Boolean(data.session), email: data.session?.user.email ?? '' })

    await pull()
    setSyncPublisher(enqueue)
    pushEverything()
    listenRealtime()
    setSnapshot({ status: 'online', message: '', lastSyncedAt: new Date().toISOString() })
    void flushViews()
  } catch (err) {
    client = null
    setSnapshot({ status: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

/** Reintenta lo que quedó en la cola, por ejemplo al volver la conexión. */
export function retry() {
  if (client) scheduleFlush(0)
  void flushViews()
}

// --- Visitas -----------------------------------------------------------------

/**
 * Las visitas van en su propia tabla y no pasan por la réplica: no se bajan a
 * ningún móvil ni tocan la cola de saques. Si una no llega a subir no pasa
 * nada; se reintenta al volver la conexión y, si se cierra la app antes, se
 * pierde, que para contar visitas da igual.
 */
const VIEWS_TABLE = 'piggy_views'
const MAX_PENDING_VIEWS = 50
let pendingViews: Omit<ViewRecord, 'team_code'>[] = []
let flushingViews = false

/** Apunta que alguien del equipo ha abierto una pantalla. */
export function recordView(view: View, visitor: string, standalone: boolean) {
  if (!teamConfig) return
  pendingViews.push({ view, visitor, standalone, created_at: new Date().toISOString() })
  if (pendingViews.length > MAX_PENDING_VIEWS) pendingViews = pendingViews.slice(-MAX_PENDING_VIEWS)
  void flushViews()
}

async function flushViews() {
  if (!client || flushingViews || pendingViews.length === 0) return
  // Lo que mira la administradora no cuenta: queremos saber qué usa el equipo.
  // Se decide aquí y no al apuntar porque la sesión se conoce después.
  if (snapshot.signedIn) {
    pendingViews = []
    return
  }
  flushingViews = true
  const batch = pendingViews
  pendingViews = []
  const { error } = await client
    .from(VIEWS_TABLE)
    .insert(batch.map((row) => ({ ...row, team_code: teamCode })))
  flushingViews = false
  if (error) pendingViews = [...batch, ...pendingViews].slice(-MAX_PENDING_VIEWS)
  // Lo que se apuntó mientras subía el lote anterior.
  else if (pendingViews.length > 0) void flushViews()
}

/**
 * Las visitas desde `since`, para el panel. Solo la administradora puede
 * leerlas. Supabase devuelve como mucho 1000 filas por consulta, así que se
 * piden por páginas.
 */
export async function fetchViews(since: Date): Promise<ViewRecord[]> {
  if (!client) throw new Error('Sin base de datos compartida no hay visitas que contar.')
  const PAGE = 1000
  const rows: ViewRecord[] = []
  for (let page = 0; page < 50; page++) {
    const { data, error } = await client
      .from(VIEWS_TABLE)
      .select('team_code,view,visitor,standalone,created_at')
      .eq('team_code', teamCode)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as ViewRecord[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

// --- Sesión de administradora ----------------------------------------------

export interface AuthResult {
  ok: boolean
  message: string
}

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Ese usuario aún no está confirmado en Supabase.',
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!client) return { ok: false, message: 'Primero conecta la base de datos del equipo.' }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) return { ok: false, message: AUTH_ERRORS[error.message] ?? error.message }

  setSnapshot({ signedIn: true, email: data.user?.email ?? '' })
  // Ya como admin: bajamos lo que no podíamos ver y subimos lo que no podíamos
  // escribir (la plantilla y el calendario que tuvieras solo en este móvil).
  await pull()
  pushEverything()
  return { ok: true, message: '' }
}

export async function signOut() {
  if (!client) return
  await client.auth.signOut()
  setSnapshot({ signedIn: false, email: '' })
}
