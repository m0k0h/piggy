import { describe, expect, it } from 'vitest'
import { candidateEndpoints, parseDate, parsePasted, teamIdFromUrl } from '../sportagia'

describe('parseDate', () => {
  it('lee formatos numéricos y con nombre de mes en catalán y castellano', () => {
    expect(parseDate('25/10/2025 18:30')).toBe('2025-10-25T18:30')
    expect(parseDate('25-10-25')).toBe('2025-10-25T00:00')
    expect(parseDate('2025-10-25T18:30:00')).toBe('2025-10-25T18:30')
    expect(parseDate("dissabte 25 d'octubre de 2025 a les 18.30h")).toBe('2025-10-25T18:30')
    expect(parseDate('25 de noviembre de 2025')).toBe('2025-11-25T00:00')
  })

  it('devuelve null cuando no hay fecha', () => {
    expect(parseDate('CV Barcelona')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('parsePasted con texto', () => {
  it('saca jugadoras con dorsal delante, detrás o sin dorsal', () => {
    const { players } = parsePasted('12 Anna Núñez\nMarta Soler - 7\nLaura Puig', 'players')
    expect(players).toEqual([
      { name: 'Anna Núñez', number: '12', externalId: null },
      { name: 'Marta Soler', number: '7', externalId: null },
      { name: 'Laura Puig', number: '', externalId: null },
    ])
  })

  it('no repite jugadoras aunque cambien los acentos o las mayúsculas', () => {
    const { players } = parsePasted('Anna Núñez\nANNA NUNEZ', 'players')
    expect(players).toHaveLength(1)
  })

  it('saca partidos quedándose solo con el rival', () => {
    const { matches } = parsePasted(
      '25/10/2025 18:30 | CV Barcelona\n08/11/2025 17:00 | CN Sabadell',
      'matches',
    )
    expect(matches).toEqual([
      { date: '2025-10-25T18:30', opponent: 'CV Barcelona', venue: '', home: true, externalId: null },
      { date: '2025-11-08T17:00', opponent: 'CN Sabadell', venue: '', home: true, externalId: null },
    ])
  })

  it('descarta del rival el resultado y el día de la semana', () => {
    const { matches } = parsePasted('dissabte 25/10/2025 CV Barcelona 3 - 1', 'matches')
    expect(matches[0].opponent).toBe('CV Barcelona')
  })

  it('ignora las líneas sin fecha al buscar partidos', () => {
    const { matches } = parsePasted('Propers partits\n25/10/2025 CV Barcelona', 'matches')
    expect(matches).toHaveLength(1)
  })
})

describe('parsePasted con JSON', () => {
  it('reconoce jugadoras y partidos anidados con claves en catalán', () => {
    const json = JSON.stringify({
      equip: {
        jugadores: [
          { id: 9, nom: 'Anna', cognoms: 'Núñez', dorsal: 12 },
          { id: 10, nom: 'Marta', cognoms: 'Soler', dorsal: 7 },
        ],
        partits: [{ id: 77, data: '2025-10-25T18:30:00', rival: 'CV Barcelona', pavello: 'Municipal', local: false }],
      },
    })
    const { players, matches } = parsePasted(json, 'players')
    expect(players).toEqual([
      { name: 'Anna Núñez', number: '12', externalId: '9' },
      { name: 'Marta Soler', number: '7', externalId: '10' },
    ])
    expect(matches).toEqual([
      { date: '2025-10-25T18:30', opponent: 'CV Barcelona', venue: 'Municipal', home: false, externalId: '77' },
    ])
  })
})

describe('URL del equipo', () => {
  it('extrae el id de la ruta con hash', () => {
    expect(teamIdFromUrl('https://sportagia.voleimasters.cat/#/equip/31')).toBe('31')
    expect(teamIdFromUrl('https://ejemplo.com/')).toBeNull()
  })

  it('propone endpoints sobre el mismo origen', () => {
    const endpoints = candidateEndpoints('https://sportagia.voleimasters.cat/#/equip/31')
    expect(endpoints.length).toBeGreaterThan(0)
    expect(endpoints[0]).toBe('https://sportagia.voleimasters.cat/api/equip/31')
  })
})
