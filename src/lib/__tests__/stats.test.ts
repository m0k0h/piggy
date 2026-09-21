import { describe, expect, it } from 'vitest'
import type { AppState, Payment, Player, Serve } from '../../types'
import { DEFAULT_SETTINGS } from '../store'
import { balances, currentSet, pot, tally, upcomingMatches } from '../stats'

const stamp = { createdAt: '2025-10-01T10:00', updatedAt: '2025-10-01T10:00', deletedAt: null }

const player = (id: string, name: string): Player => ({ id, name, number: '', externalId: null, ...stamp })
const serve = (id: string, playerId: string, result: Serve['result'], set = 1): Serve => ({
  id,
  matchId: 'm1',
  playerId,
  result,
  set,
  ...stamp,
})
const payment = (id: string, playerId: string, amount: number): Payment => ({
  id,
  playerId,
  amount,
  note: '',
  ...stamp,
})

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]))

const state = (rows: Partial<AppState>): AppState => ({
  players: {},
  matches: {},
  serves: {},
  payments: {},
  settings: { ...DEFAULT_SETTINGS, fineAmount: 1 },
  ...rows,
})

describe('tally', () => {
  it('cuenta el ace como acierto', () => {
    const result = tally([serve('1', 'p1', 'in'), serve('2', 'p1', 'ace'), serve('3', 'p1', 'error')])
    expect(result).toEqual({ attempts: 3, errors: 1, in: 1, aces: 1, ratio: 2 / 3 })
  })

  it('deja el ratio en null si no hubo saques', () => {
    expect(tally([]).ratio).toBeNull()
  })
})

describe('balances', () => {
  const base = state({
    players: byId([player('p1', 'Anna'), player('p2', 'Marta')]),
    serves: byId([
      serve('s1', 'p1', 'error'),
      serve('s2', 'p1', 'error'),
      serve('s3', 'p1', 'in'),
      serve('s4', 'p2', 'error'),
    ]),
    payments: byId([payment('pay1', 'p1', 1)]),
  })

  it('resta lo ya pagado y ordena por deuda pendiente', () => {
    const rows = balances(base)
    expect(rows.map((r) => r.player.name)).toEqual(['Anna', 'Marta'])
    expect(rows[0]).toMatchObject({ owed: 2, paid: 1, pending: 1 })
    expect(rows[1]).toMatchObject({ owed: 1, paid: 0, pending: 1 })
  })

  it('aplica el importe por fallo configurado', () => {
    const caro = { ...base, settings: { ...base.settings, fineAmount: 2.5 } }
    expect(balances(caro)[0].owed).toBe(5)
  })

  it('mantiene a quien deja el equipo mientras siga debiendo, para que cuadre la hucha', () => {
    const conBaja = state({
      players: byId([
        player('p1', 'Anna'),
        { ...player('p2', 'Marta'), deletedAt: '2025-10-02T10:00' },
      ]),
      serves: byId([serve('s1', 'p1', 'error'), serve('s2', 'p2', 'error'), serve('s3', 'p2', 'error')]),
    })
    const rows = balances(conBaja)
    expect(rows.map((r) => r.player.name)).toEqual(['Marta', 'Anna'])
    expect(rows.reduce((sum, r) => sum + r.pending, 0)).toBe(pot(conBaja).pending)
  })

  it('deja de listar a quien se fue una vez ha pagado', () => {
    const saldada = state({
      players: byId([{ ...player('p2', 'Marta'), deletedAt: '2025-10-02T10:00' }]),
      serves: byId([serve('s1', 'p2', 'error')]),
      payments: byId([payment('pay1', 'p2', 1)]),
    })
    expect(balances(saldada)).toHaveLength(0)
  })

  it('ignora los saques borrados', () => {
    const conBorrados = state({
      players: byId([player('p1', 'Anna')]),
      serves: byId([serve('s1', 'p1', 'error'), { ...serve('s2', 'p1', 'error'), deletedAt: '2025-10-02T10:00' }]),
    })
    const rows = balances(conBorrados)
    expect(rows).toHaveLength(1)
    expect(rows[0].owed).toBe(1)
  })
})

describe('pot', () => {
  it('suma la hucha de todo el equipo', () => {
    const result = pot(
      state({
        players: byId([player('p1', 'Anna')]),
        serves: byId([serve('s1', 'p1', 'error'), serve('s2', 'p1', 'error'), serve('s3', 'p1', 'ace')]),
        payments: byId([payment('pay1', 'p1', 1)]),
      }),
    )
    expect(result).toEqual({ errors: 2, owed: 2, paid: 1, pending: 1 })
  })
})

describe('currentSet', () => {
  it('se queda con el set más alto anotado', () => {
    expect(currentSet([serve('1', 'p1', 'in', 1), serve('2', 'p1', 'in', 3)])).toBe(3)
    expect(currentSet([])).toBe(1)
  })
})

describe('upcomingMatches', () => {
  it('excluye los finalizados y ordena del más próximo al más lejano', () => {
    const matches = byId([
      { id: 'a', date: '2025-11-10T18:00', opponent: 'B', venue: '', home: true, status: 'scheduled' as const, roster: [], externalId: null, ...stamp },
      { id: 'b', date: '2025-10-25T18:00', opponent: 'A', venue: '', home: true, status: 'live' as const, roster: [], externalId: null, ...stamp },
      { id: 'c', date: '2025-09-01T18:00', opponent: 'C', venue: '', home: true, status: 'finished' as const, roster: [], externalId: null, ...stamp },
    ])
    expect(upcomingMatches(state({ matches })).map((m) => m.id)).toEqual(['b', 'a'])
  })
})
