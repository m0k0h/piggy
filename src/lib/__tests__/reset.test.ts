import { describe, expect, it } from 'vitest'
import type { Team } from '../../types'
import { addMatch, addPayment, addPlayer, addServe, applyRemote, getState, saveLineup } from '../store'

const withReset = (resetAt: string): Team => ({ ...getState().team, resetAt, updatedAt: resetAt })
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('borrado de partidos de prueba', () => {
  it('al llegar la marca del equipo, cada móvil tira su copia de partidos, saques y cobros', async () => {
    const player = addPlayer('Lucía', '7')
    const match = addMatch({ date: '2026-09-01T18:00', opponent: 'Rival' })
    saveLineup(match.id, { roster: [player.id], status: 'live' })
    addServe(match.id, player.id, 'error', 1)
    addPayment(player.id, 2)

    await tick()
    const resetAt = new Date().toISOString()
    applyRemote('team', [withReset(resetAt)])

    const state = getState()
    expect(state.matches).toEqual({})
    expect(state.lineups).toEqual({})
    expect(state.serves).toEqual({})
    expect(Object.keys(state.players)).toEqual([player.id])
    expect(state.payments).toEqual({})
    expect(state.team.resetAt).toBe(resetAt)
  })

  it('lo anotado después del borrado se queda', async () => {
    const player = addPlayer('Marta', '9')
    await tick()
    const resetAt = new Date().toISOString()
    await tick()
    const match = addMatch({ date: '2026-09-02T18:00', opponent: 'Otro' })
    addServe(match.id, player.id, 'in', 1)

    applyRemote('team', [{ ...withReset(resetAt), updatedAt: new Date().toISOString() }])

    expect(getState().team.resetAt).toBe(resetAt)
    expect(Object.keys(getState().matches)).toEqual([match.id])
    expect(Object.keys(getState().serves)).toHaveLength(1)
  })
})
