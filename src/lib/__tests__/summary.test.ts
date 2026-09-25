import { describe, expect, it } from 'vitest'
import type { AppState, Match, Payment, Player, Serve } from '../../types'
import { euros } from '../format'
import { matchDetails, potSummary } from '../summary'

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
    // desempata el orden alfabético. El total va sin paréntesis, los
    // importes de cada una sí.
    expect(text).toContain(
      `Pendiente de pagar ${euros(4)}: Anna (${euros(2)}), Laura (${euros(1)}) y Marta (${euros(1)}).`,
    )
  })

  it('con una sola deudora no le pone coma, solo el punto final', () => {
    const text = potSummary(
      state({
        players: byId([player('p1', 'Anna')]),
        serves: byId([serve('s1', 'p1', 'error')]),
      }),
    )
    expect(text).toContain(`Pendiente de pagar ${euros(1)}: Anna (${euros(1)}).`)
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

  it('después del porcentaje de acierto añade fallados/total', () => {
    const text = potSummary(
      state({
        players: byId([player('p1', 'Anna')]),
        serves: byId([serve('s1', 'p1', 'error'), serve('s2', 'p1', 'in'), serve('s3', 'p1', 'ace')]),
      }),
    )
    const lines = text.split('\n')
    const ratioIndex = lines.findIndex((line) => line.startsWith('Porcentaje de acierto'))
    expect(ratioIndex).toBeGreaterThan(-1)
    expect(lines[ratioIndex + 1]).toBe('1/3 saques fallados')
  })
})

describe('matchDetails', () => {
  const match: Match = {
    id: 'm1',
    opponent: 'CV Norte',
    date: '2025-10-04T18:30',
    venue: 'Pabellón Sur',
    home: true,
    externalId: null,
    leagueUrl: 'https://liga.example/cv-norte',
    ...stamp,
  }

  it('lleva rival, fecha, lugar, asistentes y enlaces', () => {
    const text = matchDetails(
      state({
        players: byId([player('p1', 'Ana'), player('p2', 'Bea')]),
        matches: byId([match]),
        lineups: { m1: { id: 'm1', matchId: 'm1', roster: ['p1', 'p2'], status: 'scheduled', ...stamp } },
      }),
      match,
    )
    expect(text).toContain('Volei Masters vs CV Norte')
    expect(text).toContain('Convocadas a las 17:45 (45 min antes)')
    expect(text).toContain('Pabellón Sur · En casa')
    expect(text).toContain('Asistentes (2): Ana y Bea.')
    expect(text).toContain('https://liga.example/cv-norte')
    expect(text).toContain('#/partido/m1')
  })

  it('sin asistentes ni ficha, no pinta esas líneas', () => {
    const away = { ...match, home: false, venue: '', leagueUrl: undefined }
    const text = matchDetails(state({ matches: byId([away]) }), away)
    expect(text).toContain('Volei Masters @ CV Norte')
    expect(text).toContain('📍 Fuera')
    expect(text).not.toContain('Asistentes')
    expect(text).not.toContain('Ficha del rival')
  })

  it('sin hora de partido, no hay hora de convocatoria', () => {
    const noTime = { ...match, date: '2025-10-04T00:00' }
    expect(matchDetails(state({ matches: byId([noTime]) }), noTime)).not.toContain('Convocadas')
  })

  it('la convocatoria cruza la hora en punto', () => {
    const early = { ...match, date: '2025-10-04T10:15' }
    expect(matchDetails(state({ matches: byId([early]) }), early)).toContain('Convocadas a las 09:30')
  })
})
