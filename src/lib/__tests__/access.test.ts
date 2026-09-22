import { describe, expect, it } from 'vitest'
// El esquema real, leído tal cual: si la app y la base de datos dejan de decir
// lo mismo, estos tests lo cantan.
import sql from '../../../supabase/schema.sql?raw'
import { COLLECTIONS, PLAYER_WRITABLE } from '../../types'
import { migrate } from '../store'
import { roleOf, type SyncSnapshot } from '../sync'

const snapshot = (patch: Partial<SyncSnapshot>): SyncSnapshot => ({
  status: 'off',
  message: '',
  pending: 0,
  lastSyncedAt: null,
  signedIn: false,
  email: '',
  ...patch,
})

describe('roleOf', () => {
  it('sin base de datos compartida, la app es toda tuya', () => {
    expect(roleOf(snapshot({ status: 'off' }))).toBe('admin')
  })

  it('conectada al equipo pero sin sesión, eres jugadora', () => {
    expect(roleOf(snapshot({ status: 'online' }))).toBe('player')
    expect(roleOf(snapshot({ status: 'connecting' }))).toBe('player')
  })

  it('con sesión iniciada, eres administradora', () => {
    expect(roleOf(snapshot({ status: 'online', signedIn: true }))).toBe('admin')
  })
})

/**
 * Los permisos de verdad los aplica Postgres. Si alguien añade una colección
 * escribible en un sitio y no en el otro, la app intentaría escrituras que el
 * servidor rechaza (o, peor, dejaría de ofrecer algo que sí está permitido).
 */
describe('la app y la base de datos dicen lo mismo', () => {
  const listIn = (haystack: string) =>
    [...haystack.matchAll(/'([a-z]+)'/g)].map((match) => match[1]).sort()

  it('el equipo puede escribir exactamente las mismas colecciones', () => {
    const policy = sql.slice(sql.indexOf('"el equipo anota el partido"'))
    const allowed = listIn(policy.slice(policy.indexOf('collection in ('), policy.indexOf(');')))
    expect(allowed).toEqual([...PLAYER_WRITABLE].sort())
  })

  it('la tabla acepta exactamente las colecciones que la app envía', () => {
    const constraint = sql.slice(sql.indexOf('piggy_rows_collection_check\n  check'))
    expect(listIn(constraint.slice(0, constraint.indexOf(');')))).toEqual([...COLLECTIONS].sort())
  })

  it('nadie puede borrar filas', () => {
    expect(sql).not.toMatch(/for\s+delete/i)
    expect(sql).not.toMatch(/for\s+all/i)
  })
})

describe('migrate desde el formato anterior', () => {
  const legacy = JSON.stringify({
    players: { p1: { id: 'p1', name: 'Anna', number: '12', externalId: null, createdAt: 'a', updatedAt: 'a', deletedAt: null } },
    matches: {
      m1: {
        id: 'm1',
        date: '2025-10-25T18:30',
        opponent: 'CV Barcelona',
        venue: 'Municipal',
        home: true,
        status: 'finished',
        roster: ['p1'],
        externalId: null,
        createdAt: 'a',
        updatedAt: 'b',
        deletedAt: null,
      },
      m2: { id: 'm2', date: '2025-11-08T17:00', opponent: 'CN Sabadell', venue: '', home: false, status: 'scheduled', roster: [], externalId: null, createdAt: 'a', updatedAt: 'a', deletedAt: null },
    },
    serves: { s1: { id: 's1', matchId: 'm1', playerId: 'p1', result: 'error', set: 1, createdAt: 'a', updatedAt: 'a', deletedAt: null } },
    payments: {},
    settings: { teamName: 'Volei Masters', fineAmount: 2 },
  })

  const migrated = migrate(legacy)

  it('saca el estado del partido a su propia convocatoria', () => {
    expect(migrated.matches.m1).not.toHaveProperty('status')
    expect(migrated.matches.m1).not.toHaveProperty('roster')
    expect(migrated.lineups.m1).toMatchObject({ matchId: 'm1', status: 'finished', roster: ['p1'] })
  })

  it('no inventa convocatoria para un partido que nunca se jugó', () => {
    expect(migrated.lineups.m2).toBeUndefined()
  })

  it('mueve el nombre y la multa a los datos del equipo', () => {
    expect(migrated.team).toMatchObject({ name: 'Volei Masters', fineAmount: 2 })
  })

  it('conserva jugadoras y saques', () => {
    expect(migrated.players.p1.name).toBe('Anna')
    expect(migrated.serves.s1.result).toBe('error')
  })
})
