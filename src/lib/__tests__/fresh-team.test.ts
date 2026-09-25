import { describe, expect, it } from 'vitest'
import { TEAM_ROW_ID, type Team } from '../../types'
import { applyRemote, getState } from '../store'

describe('móvil recién estrenado', () => {
  it('acepta el equipo del servidor, con su marca de borrado, aunque sea de antes', () => {
    const past = '2026-09-24T22:28:00.000Z'
    const server: Team = {
      id: TEAM_ROW_ID,
      name: 'Las del saque',
      fineAmount: 1,
      logo: '',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: past,
      deletedAt: null,
      resetAt: past,
    }
    applyRemote('team', [server])

    expect(getState().team.name).toBe('Las del saque')
    expect(getState().team.resetAt).toBe(past)
  })
})
