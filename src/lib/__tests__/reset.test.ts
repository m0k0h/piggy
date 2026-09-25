import { describe, expect, it } from 'vitest'
import type { Team } from '../../types'
import { addMatch, addPayment, addPlayer, addServe, applyRemote, getState, rowsOf, saveLineup } from '../store'

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

  it('con la marca ya guardada pero sin purgar, el móvil tira lo borrado y no lo vuelve a subir', async () => {
    const player = addPlayer('Irene', '4')
    const match = addMatch({ date: '2026-09-03T18:00', opponent: 'Viejo' })
    addServe(match.id, player.id, 'error', 1)
    addPayment(player.id, 3)
    await tick()
    const resetAt = new Date().toISOString()
    // Un móvil con una versión anterior guardó el equipo con la marca, pero no
    // tiró su copia. El equipo que le llega ahora no es más nuevo que el suyo.
    const team = withReset(resetAt)
    applyRemote('team', [team])
    const stale = { ...match, id: 'stale', createdAt: match.createdAt }
    applyRemote('matches', [stale])
    applyRemote('team', [team])

    expect(getState().matches).toEqual({})
    expect(rowsOf('serves')).toEqual([])
    expect(rowsOf('payments')).toEqual([])
  })

  it('lo borrado que alguien volvió a subir al servidor no se enseña', async () => {
    const player = addPlayer('Sara', '11')
    const match = addMatch({ date: '2026-09-04T18:00', opponent: 'Rival' })
    const payment = addPayment(player.id, 5)
    await tick()
    const resetAt = new Date().toISOString()
    applyRemote('team', [withReset(resetAt)])

    applyRemote('matches', [{ ...match, updatedAt: new Date().toISOString() }])
    applyRemote('payments', [{ ...payment, updatedAt: new Date().toISOString() }])

    expect(getState().matches).toEqual({})
    expect(getState().payments).toEqual({})
  })

  it('un equipo que llega sin la marca no se la quita a este móvil', async () => {
    await tick()
    const resetAt = new Date().toISOString()
    applyRemote('team', [withReset(resetAt)])
    await tick()
    const { resetAt: _gone, ...bare } = getState().team
    applyRemote('team', [{ ...bare, name: 'Otro nombre', updatedAt: new Date().toISOString() } as Team])

    expect(getState().team.name).toBe('Otro nombre')
    expect(getState().team.resetAt).toBe(resetAt)
  })

  it('lo de antes de la noche del borrado no vuelve aunque nadie tenga la marca', () => {
    const old = '2026-09-20T18:00:00.000Z'
    const player = addPlayer('Nerea', '2')
    const payment = { ...addPayment(player.id, 4), id: 'viejo', createdAt: old, updatedAt: old }
    applyRemote('payments', [payment])

    expect(getState().payments.viejo).toBeUndefined()
    expect(rowsOf('payments').some((row) => row.createdAt === old)).toBe(false)
  })
})
