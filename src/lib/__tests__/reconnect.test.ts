import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Un Supabase de mentira: `online` decide si las peticiones llegan, y `rows`
 * es lo que hay en el servidor.
 */
const server = vi.hoisted(() => ({
  online: false,
  rows: [] as { collection: string; payload: { id: string } }[],
  pulls: 0,
  upserts: [] as { id: string }[][],
}))

vi.mock('../config', () => ({
  teamConfig: { url: 'https://prueba.supabase.co', anonKey: 'anon', code: 'equipo' },
}))

vi.mock('@supabase/supabase-js', () => {
  const offline = { message: 'Failed to fetch' }
  const channel = { on: () => channel, subscribe: () => channel }
  return {
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }) },
      from: () => ({
        select: () => ({
          eq: async () => {
            server.pulls++
            return server.online ? { data: server.rows, error: null } : { data: null, error: offline }
          },
        }),
        upsert: async (batch: { id: string }[]) => {
          if (!server.online) return { error: offline }
          server.upserts.push(batch)
          return { error: null }
        },
        insert: async () => ({ error: null }),
      }),
      channel: () => channel,
      removeChannel: async () => {},
    }),
  }
})

const { connect, getSyncSnapshot, reconnect, retry } = await import('../sync')
const { addServe, getState } = await import('../store')

const settle = () => new Promise((resolve) => setTimeout(resolve, 10))

describe('reconexión', () => {
  beforeEach(() => {
    server.online = false
    server.rows = []
    server.pulls = 0
    server.upserts = []
  })

  it('si la app se abre sin cobertura, se conecta sola al volver y sube lo anotado', async () => {
    await connect()
    expect(getSyncSnapshot().status).toBe('error')

    // Sin conexión se anota igual, en el móvil.
    const serve = addServe('partido', 'lucia', 'error', 1)
    await settle()
    expect(server.upserts).toEqual([])

    server.online = true
    retry()
    await settle()

    expect(getSyncSnapshot().status).toBe('online')
    expect(server.upserts.flat().map((row) => row.id)).toContain(serve.id)
  })

  it('al volver la red baja lo que anotaron las demás durante el corte', async () => {
    server.online = true
    await connect()
    expect(getSyncSnapshot().status).toBe('online')

    const now = new Date().toISOString()
    const fromOthers = { id: 'de-otra', name: 'Marta', number: '9', createdAt: now, updatedAt: now, deletedAt: null }
    server.rows = [{ collection: 'players', payload: fromOthers }]

    reconnect()
    await settle()

    expect(getState().players['de-otra']).toBeDefined()
  })

  it('con todo en verde, reintentar no vuelve a descargar nada', async () => {
    server.online = true
    await connect()
    const pulls = server.pulls

    retry()
    await settle()

    expect(server.pulls).toBe(pulls)
  })

  it('dos avisos seguidos no abren dos conexiones a la vez', async () => {
    server.online = true
    await Promise.all([connect(), connect()])
    expect(server.pulls).toBe(1)
  })

  it('mientras reconecta, una jugadora no pasa a ver la app como administradora', async () => {
    await connect()
    expect(getSyncSnapshot().status).toBe('error')

    const statuses: string[] = []
    const { subscribeSync } = await import('../sync')
    const stop = subscribeSync(() => statuses.push(getSyncSnapshot().status))
    retry()
    await settle()
    stop()

    // 'off' es el modo sin base de datos, en el que quien abre la app es admin.
    expect(statuses).not.toContain('off')
  })
})
