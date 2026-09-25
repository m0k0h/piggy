import { describe, expect, it } from 'vitest'
import type { AppState, Match } from '../../types'
import { hostOf, normalizeImageUrl, normalizeUrl } from '../format'
import { knownOpponent } from '../stats'

const stamp = { createdAt: '2025-10-01T10:00', updatedAt: '2025-10-01T10:00', deletedAt: null }

const match = (id: string, date: string, opponent: string, extra: Partial<Match> = {}): Match => ({
  id,
  date,
  opponent,
  venue: '',
  home: true,
  externalId: null,
  ...stamp,
  ...extra,
})

const state = (matches: Match[]): AppState => ({
  players: {},
  matches: Object.fromEntries(matches.map((m) => [m.id, m])),
  lineups: {},
  serves: {},
  payments: {},
  team: { id: 'team', name: 'Equipo', fineAmount: 1, logo: '', ...stamp },
})

describe('normalizeUrl', () => {
  it('añade el esquema cuando se pega una dirección a medias', () => {
    expect(normalizeUrl('voleimasters.cat/equip/7')).toBe('https://voleimasters.cat/equip/7')
  })

  it('respeta las direcciones que ya lo traen', () => {
    expect(normalizeUrl('http://ejemplo.com/a')).toBe('http://ejemplo.com/a')
    expect(normalizeUrl('  https://ejemplo.com/a  ')).toBe('https://ejemplo.com/a')
  })

  it('deja vacío lo vacío, sin inventarse un https suelto', () => {
    expect(normalizeUrl('   ')).toBe('')
  })
})

describe('normalizeImageUrl', () => {
  it('no toca una imagen pegada como data URL', () => {
    const data = 'data:image/png;base64,AAAA'
    expect(normalizeImageUrl(data)).toBe(data)
  })

  it('completa el esquema en una dirección normal', () => {
    expect(normalizeImageUrl('cdn.liga.cat/escudo.png')).toBe('https://cdn.liga.cat/escudo.png')
  })
})

describe('hostOf', () => {
  it('se queda con el dominio y se come el www', () => {
    expect(hostOf('https://www.voleimasters.cat/equip/7?x=1')).toBe('voleimasters.cat')
  })

  it('devuelve el texto tal cual si no es una dirección', () => {
    expect(hostOf('no es una url')).toBe('no es una url')
  })
})

describe('knownOpponent', () => {
  it('recupera el enlace y el escudo del partido más reciente contra ese rival', () => {
    const s = state([
      match('viejo', '2025-10-01T18:00', 'CV Barcelona', {
        leagueUrl: 'https://liga.cat/viejo',
        opponentLogo: 'https://liga.cat/viejo.png',
      }),
      match('nuevo', '2025-12-01T18:00', 'CV Barcelona', {
        leagueUrl: 'https://liga.cat/nuevo',
        opponentLogo: 'https://liga.cat/nuevo.png',
      }),
    ])
    expect(knownOpponent(s, 'CV Barcelona')).toEqual({
      leagueUrl: 'https://liga.cat/nuevo',
      logo: 'https://liga.cat/nuevo.png',
      mapsUrl: '',
    })
  })

  it('recupera el mapa de su pabellón del último partido en su casa, aunque sea otro', () => {
    const s = state([
      match('alla', '2025-10-01T18:00', 'CV Barcelona', { home: false, mapsUrl: 'https://maps.app.goo.gl/bcn' }),
      match('aqui', '2025-12-01T18:00', 'CV Barcelona', { leagueUrl: 'https://liga.cat/bcn' }),
    ])
    expect(knownOpponent(s, 'CV Barcelona')).toEqual({
      leagueUrl: 'https://liga.cat/bcn',
      logo: '',
      mapsUrl: 'https://maps.app.goo.gl/bcn',
    })
  })

  it('con solo el mapa guardado, también lo recupera', () => {
    const s = state([
      match('alla', '2025-10-01T18:00', 'CV Barcelona', { home: false, mapsUrl: 'https://maps.app.goo.gl/bcn' }),
    ])
    expect(knownOpponent(s, 'CV Barcelona')?.mapsUrl).toBe('https://maps.app.goo.gl/bcn')
  })

  it('no toma el mapa de un partido en casa', () => {
    const s = state([match('aqui', '2025-10-01T18:00', 'CV Barcelona', { mapsUrl: 'https://maps.app.goo.gl/x' })])
    expect(knownOpponent(s, 'CV Barcelona')).toBeNull()
  })

  it('no le importan acentos ni mayúsculas', () => {
    const s = state([
      match('m1', '2025-10-01T18:00', 'CN Mataró', { leagueUrl: 'https://liga.cat/m' }),
    ])
    expect(knownOpponent(s, 'cn mataro')?.leagueUrl).toBe('https://liga.cat/m')
  })

  it('se salta el partido que se está editando, para no leerse a sí mismo', () => {
    const s = state([match('m1', '2025-10-01T18:00', 'CV Barcelona', { leagueUrl: 'https://liga.cat/a' })])
    expect(knownOpponent(s, 'CV Barcelona', 'm1')).toBeNull()
  })

  it('ignora los partidos del rival que no guardaron nada', () => {
    const s = state([match('m1', '2025-10-01T18:00', 'CV Barcelona')])
    expect(knownOpponent(s, 'CV Barcelona')).toBeNull()
  })

  it('no devuelve nada sin rival', () => {
    expect(knownOpponent(state([]), '  ')).toBeNull()
  })
})
