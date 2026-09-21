import { useSyncExternalStore } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { COLLECTIONS, type Collection, type Settings, type Syncable } from '../types'
import { applyRemote, getState, setSyncPublisher } from './store'

/**
 * Todo viaja en una sola tabla con el documento en JSON. Así el esquema no
 * cambia cada vez que añadimos un campo, y basta una suscripción de realtime.
 */
const TABLE = 'piggy_rows'

export type SyncStatus = 'off' | 'connecting' | 'online' | 'error'

export interface SyncSnapshot {
  status: SyncStatus
  message: string
  /** Filas locales esperando a subir (por ejemplo, sin cobertura en el pabellón). */
  pending: number
  lastSyncedAt: string | null
}

let snapshot: SyncSnapshot = { status: 'off', message: '', pending: 0, lastSyncedAt: null }
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

const toRecord = (collection: Collection, row: Syncable): RowRecord => ({
  team_code: teamCode,
  collection,
  id: row.id,
  updated_at: row.updatedAt,
  payload: row,
})

function enqueue(collection: Collection, rows: Syncable[]) {
  if (!client) return
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
  const { data, error } = await client.from(TABLE).select('collection,payload').eq('team_code', teamCode)
  if (error) throw new Error(error.message)
  const grouped = new Map<Collection, Syncable[]>()
  for (const record of (data ?? []) as Pick<RowRecord, 'collection' | 'payload'>[]) {
    const bucket = grouped.get(record.collection) ?? []
    bucket.push(record.payload)
    grouped.set(record.collection, bucket)
  }
  for (const [collection, rows] of grouped) applyRemote(collection, rows)
}

/**
 * Sube todo lo local. Se llama justo después de `pull`, cuando el estado local
 * ya es el más reciente de los dos lados, así que nunca pisa nada más nuevo.
 */
function pushEverything() {
  const state = getState()
  for (const collection of COLLECTIONS) {
    const rows = Object.values(state[collection]) as Syncable[]
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
  setSnapshot({ status: 'off', message: '', pending: 0 })
}

/** Conecta (o reconecta) con los ajustes actuales. Sin claves, se queda en local. */
export async function connect(settings: Settings) {
  disconnect()
  const { supabaseUrl, supabaseAnonKey, teamCode: code } = settings
  if (!supabaseUrl || !supabaseAnonKey || !code) return

  teamCode = code.trim()
  setSnapshot({ status: 'connecting', message: '' })
  try {
    // Carga diferida: sin equipo compartido, la app arranca sin bajar el SDK.
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
      auth: { persistSession: false },
    })
    await pull()
    setSyncPublisher(enqueue)
    pushEverything()
    listenRealtime()
    setSnapshot({ status: 'online', message: '', lastSyncedAt: new Date().toISOString() })
  } catch (err) {
    client = null
    setSnapshot({ status: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

/** Reintenta lo que quedó en la cola, por ejemplo al volver la conexión. */
export function retry() {
  if (client) scheduleFlush(0)
}

/** Estado de la sincronización para pintarlo en Ajustes. */
export const useSync = () =>
  useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot)
