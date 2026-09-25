import { describe, expect, it } from 'vitest'
import sql from '../../../supabase/schema.sql?raw'
import { isNewVisit, summarizeViews, VIEWS, type View, type ViewRecord } from '../views'

const row = (view: View, visitor: string, at: Date, standalone = false): ViewRecord => ({
  team_code: 'equipo-principal',
  view,
  visitor,
  standalone,
  created_at: at.toISOString(),
})

// Mediodía en hora local, para que el día no dependa de la zona del ordenador.
const day = (offset: number, hour = 12) => new Date(2026, 8, 25 + offset, hour)
const now = day(0, 20)

describe('summarizeViews', () => {
  const rows = [
    row('hucha', 'a', day(0), true),
    row('stats', 'a', day(0), true),
    row('hucha', 'b', day(0)),
    row('partidos', 'b', day(-1)),
    row('hucha', 'c', day(-10)),
  ]

  it('cuenta visitas y personas distintas del periodo', () => {
    const summary = summarizeViews(rows, 7, now)
    expect(summary.views).toBe(4)
    expect(summary.visitors).toBe(2)
    expect(summary.today).toBe(2)
  })

  it('lo de fuera del periodo no cuenta', () => {
    expect(summarizeViews(rows, 30, now).visitors).toBe(3)
  })

  it('un punto por día, también los vacíos, terminando hoy', () => {
    const { perDay } = summarizeViews(rows, 7, now)
    expect(perDay).toHaveLength(7)
    expect(perDay.map((d) => d.visitors)).toEqual([0, 0, 0, 0, 0, 1, 2])
    expect(perDay[6].views).toBe(3)
  })

  it('por pantalla, de la más vista a la menos, con todas aunque estén a cero', () => {
    const { perView } = summarizeViews(rows, 7, now)
    expect(perView[0]).toMatchObject({ view: 'hucha', views: 2, visitors: 2 })
    expect(perView.map((item) => item.view).sort()).toEqual([...VIEWS].sort())
    expect(perView.find((item) => item.view === 'partido')?.views).toBe(0)
  })

  it('la parte que usa la app instalada va por personas, no por visitas', () => {
    expect(summarizeViews(rows, 7, now).installed).toBe(0.5)
    expect(summarizeViews([], 7, now).installed).toBeNull()
  })
})

describe('isNewVisit', () => {
  const at = 1_000_000_000
  it('la primera y otra pantalla cuentan', () => {
    expect(isNewVisit(null, 'hucha', at)).toBe(true)
    expect(isNewVisit({ view: 'hucha', at }, 'stats', at + 1000)).toBe(true)
  })

  it('volver a la misma al rato es la misma visita; al cabo de una hora, otra', () => {
    expect(isNewVisit({ view: 'hucha', at }, 'hucha', at + 60_000)).toBe(false)
    expect(isNewVisit({ view: 'hucha', at }, 'hucha', at + 60 * 60_000)).toBe(true)
  })
})

describe('la app y la base de datos cuentan las mismas pantallas', () => {
  it('la tabla de visitas acepta exactamente VIEWS', () => {
    const constraint = sql.slice(sql.indexOf('piggy_views_view_check\n  check'))
    const listed = [...constraint.slice(0, constraint.indexOf(');')).matchAll(/'([a-z]+)'/g)]
      .map((match) => match[1])
      .sort()
    expect(listed).toEqual([...VIEWS].sort())
  })

  it('el equipo no puede leer las visitas, solo apuntarlas', () => {
    const policy = sql.slice(sql.indexOf('create policy "la admin ve las visitas"'))
    expect(policy.slice(0, policy.indexOf(';'))).toMatch(/for select\s+to authenticated\s/)
  })
})
