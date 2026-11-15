import { describe, expect, it } from 'vitest'
import sql from '../../../supabase/schema.sql?raw'
import type { AppState, Serve } from '../../types'
import { applyRemote, getState, withoutAces } from '../store'

const stamp = { createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', deletedAt: null }

/** Un saque como lo dejaba la app cuando aún había aces. */
const serve = (id: string, result: string): Serve =>
  ({ id, matchId: 'm1', playerId: 'p1', result, set: 1, ...stamp }) as Serve

const state = (serves: Serve[]): AppState => ({
  players: {},
  matches: {},
  lineups: {},
  payments: {},
  serves: Object.fromEntries(serves.map((row) => [row.id, row])),
  team: { id: 'team', name: 'Equipo', fineAmount: 1, logo: '', ...stamp },
})

describe('migración de los aces', () => {
  it('los aces guardados pasan a saque metido, sin tocar la fecha ni lo demás', () => {
    const clean = withoutAces(state([serve('s1', 'ace'), serve('s2', 'error'), serve('s3', 'in')]))
    expect(clean.serves.s1).toEqual(serve('s1', 'in'))
    expect(clean.serves.s2.result).toBe('error')
    expect(clean.serves.s3.result).toBe('in')
  })

  it('sin aces devuelve el mismo estado, para no guardar ni repintar en balde', () => {
    const before = state([serve('s1', 'in'), serve('s2', 'error')])
    expect(withoutAces(before)).toBe(before)
  })

  it('un ace que llega del servidor entra como saque metido', () => {
    applyRemote('serves', [{ ...serve('remoto', 'ace'), createdAt: '2026-11-01T10:00:00.000Z' }])
    expect(getState().serves.remoto.result).toBe('in')
  })

  it('el esquema deja la tabla limpia de aces', () => {
    expect(sql).toMatch(/payload->>'result' = 'ace'/)
    expect(sql).toMatch(/jsonb_set\(payload, '\{result\}', '"in"'\)/)
  })
})
