import { describe, expect, it } from 'vitest'
import type { AppState, Payment, Player, Serve } from '../../types'
import { euros } from '../format'
import { potSummary } from '../summary'

const stamp = { createdAt: '2025-10-01T10:00', updatedAt: '2025-10-01T10:00', deletedAt: null }

const player = (id: string, name: string): Player => ({ id, name, number: '', externalId: null, ...stamp })

const serve = (id: string, playerId: string, result: Serve['result']): Serve => ({
  id,
  matchId: 'm1',
  playerId,
  result,
  set: 1,
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
  lineups: {},
  serves: {},
  payments: {},
  team: { id: 'team', name: 'Volei Masters', fineAmount: 1, logo: '', ...stamp },
  ...rows,
})

describe('potSummary', () => {
  it('el total tiene en cuenta lo que se debe: es lo generado, no solo lo cobrado', () => {
    const text = potSummary(
      state({
        players: byId([player('p1', 'Anna')]),
        serves: byId([serve('s1', 'p1', 'error'), serve('s2', 'p1', 'error')]),
        payments: byId([payment('pay1', 'p1', 1)]),
      }),
    )
    // 2 fallos a 1 € = 2 € generados, aunque solo se haya cobrado 1 €.
    expect(text).toContain(`Llevamos ahorrado: ${euros(2)}`)
  })

  it('enumera a las deudoras con lo que debe cada una entre paréntesis, "y" antes de la última y punto final', () => {
    const text = potSummary(
      state({
        players: byId([player('p1', 'Anna'), player('p2', 'Marta'), player('p3', 'Laura')]),
        serves: byId([
          serve('s1', 'p1', 'error'),
          serve('s2', 'p1', 'error'),
          serve('s3', 'p2', 'error'),
          serve('s4', 'p3', 'error'),
        ]),
      }),
    )
    // Anna debe más y va primera; Laura y Marta empatan, y entre ellas
    // desempata el orden alfabético.
    expect(text).toContain(
      `Pendiente de pagar (${euros(4)}): Anna (${euros(2)}), Laura (${euros(1)}) y Marta (${euros(1)}).`,
    )
  })

  it('con una sola deudora no le pone coma, solo el punto final', () => {
    const text = potSummary(
      state({
        players: byId([player('p1', 'Anna')]),
        serves: byId([serve('s1', 'p1', 'error')]),
      }),
    )
    expect(text).toContain(`Pendiente de pagar (${euros(1)}): Anna (${euros(1)}).`)
  })

  it('sin nadie pendiente, avisa de que todas están al día', () => {
    const text = potSummary(
      state({
        players: byId([player('p1', 'Anna')]),
        serves: byId([serve('s1', 'p1', 'error')]),
        payments: byId([payment('pay1', 'p1', 1)]),
      }),
    )
    expect(text).toContain('¡Todas al día!')
    expect(text).not.toContain('Pendiente de pagar')
  })
})
