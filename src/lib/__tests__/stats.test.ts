import { describe, expect, it } from 'vitest'
import type { AppState, Lineup, Match, Payment, Player, Serve } from '../../types'
import { balances, currentSet, matchStatus, participants, pot, tally, upcomingMatches } from '../stats'

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

const match = (id: string, date: string, opponent = 'Rival'): Match => ({
  id,
  date,
  opponent,
  venue: '',
  home: true,
  externalId: null,
  ...stamp,
})

const lineup = (matchId: string, status: Lineup['status'], roster: string[] = []): Lineup => ({
  id: matchId,
  matchId,
  roster,
  status,
  ...stamp,
})

const byId = <T extends { id: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.id, r]))

const state = (rows: Partial<AppState>, fine = 1): AppState => ({
  players: {},
  matches: {},
  lineups: {},
  serves: {},
  payments: {},
  team: { id: 'team', name: 'Equipo', fineAmount: fine, logo: '', ...stamp },
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

  it('aplica el importe por fallo del equipo', () => {
    const caro = { ...base, team: { ...base.team, fineAmount: 2.5 } }
    expect(balances(caro)[0].owed).toBe(5)
  })

  it('mantiene a quien deja el equipo mientras siga debiendo, para que cuadre la hucha', () => {
    const conBaja = state({
      players: byId([player('p1', 'Anna'), { ...player('p2', 'Marta'), deletedAt: '2025-10-02T10:00' }]),
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
    expect(balances(conBorrados)[0].owed).toBe(1)
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

describe('estado del partido', () => {
  it('sin convocatoria el partido sigue programado', () => {
    const s = state({ matches: byId([match('m1', '2025-11-10T18:00')]) })
    expect(matchStatus(s, 'm1')).toBe('scheduled')
  })

  it('la convocatoria es la que dice si está en juego o cerrado', () => {
    const s = state({
      matches: byId([match('m1', '2025-11-10T18:00')]),
      lineups: byId([lineup('m1', 'finished', ['p1'])]),
    })
    expect(matchStatus(s, 'm1')).toBe('finished')
  })

  it('una convocatoria borrada devuelve el partido a programado', () => {
    const s = state({
      matches: byId([match('m1', '2025-11-10T18:00')]),
      lineups: byId([{ ...lineup('m1', 'live'), deletedAt: '2025-10-02T10:00' }]),
    })
    expect(matchStatus(s, 'm1')).toBe('scheduled')
  })
})

describe('upcomingMatches', () => {
  it('excluye los finalizados y ordena del más próximo al más lejano', () => {
    const s = state({
      matches: byId([
        match('a', '2025-11-10T18:00'),
        match('b', '2025-10-25T18:00'),
        match('c', '2025-09-01T18:00'),
      ]),
      lineups: byId([lineup('b', 'live'), lineup('c', 'finished')]),
    })
    expect(upcomingMatches(s).map((m) => m.id)).toEqual(['b', 'a'])
  })
})

describe('participants', () => {
  it('suma a la convocatoria cualquiera que llegara a sacar', () => {
    const s = state({
      players: byId([player('p1', 'Anna'), player('p2', 'Marta')]),
      matches: byId([match('m1', '2025-11-10T18:00')]),
      lineups: byId([lineup('m1', 'live', ['p1'])]),
      serves: byId([serve('s1', 'p2', 'error')]),
    })
    expect(participants(s, 'm1').map((p) => p.name)).toEqual(['Anna', 'Marta'])
  })
})
