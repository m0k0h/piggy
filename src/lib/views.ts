import { useEffect } from 'react'
import { recordView } from './sync'

/**
 * Visitas a la app del equipo: qué pantallas se abren y cuánta gente distinta
 * entra. Nada personal: cada móvil lleva un identificador al azar que no dice
 * de quién es, y la administración no cuenta.
 */

/** Las pantallas que se cuentan. Misma lista que la de `supabase/schema.sql`. */
export const VIEWS = ['hucha', 'partidos', 'stats', 'partido'] as const
export type View = (typeof VIEWS)[number]

export const VIEW_LABELS: Record<View, string> = {
  hucha: 'Hucha',
  partidos: 'Partidos',
  stats: 'Stats',
  partido: 'Ficha de un partido',
}

/** Una fila de `piggy_views`, tal cual viaja. */
export interface ViewRecord {
  team_code: string
  view: View
  /** Identificador al azar de este móvil: sirve para contar personas, no para saber quién. */
  visitor: string
  /** Abierta desde la app instalada en la pantalla de inicio, no desde el navegador. */
  standalone: boolean
  created_at: string
}

const VISITOR_KEY = 'piggy.visitor'

/** El identificador de este móvil. Si no se puede guardar, vale para esta sesión. */
let fallbackVisitor = ''
export function visitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY)
    if (saved) return saved
    const fresh = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, fresh)
    return fresh
  } catch {
    fallbackVisitor ||= crypto.randomUUID()
    return fallbackVisitor
  }
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/**
 * Con la app abierta en segundo plano, volver a ella al cabo de un rato es
 * otra visita; ir y volver de pestaña en un minuto, no.
 */
const SAME_VISIT_MS = 30 * 60 * 1000
let last: { view: View; at: number } | null = null

/** ¿Cuenta como visita nueva? Aparte para poder probarlo. */
export function isNewVisit(
  previous: { view: View; at: number } | null,
  view: View,
  now: number,
): boolean {
  return !previous || previous.view !== view || now - previous.at > SAME_VISIT_MS
}

function track(view: View) {
  const now = Date.now()
  if (!isNewVisit(last, view, now)) return
  last = { view, at: now }
  recordView(view, visitorId(), isStandalone())
}

/** Apunta la pantalla abierta, y otra vez si se vuelve a la app tras un buen rato. */
export function useTrackView(view: View | null) {
  useEffect(() => {
    if (!view) return
    track(view)
    const onVisible = () => {
      if (document.visibilityState === 'visible') track(view)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [view])
}

// --- Resumen para el panel ----------------------------------------------------

export interface ViewSummary {
  /** Visitas en el periodo. */
  views: number
  /** Móviles distintos en el periodo. */
  visitors: number
  /** Móviles distintos hoy. */
  today: number
  /** Media de móviles distintos por día. */
  dailyAverage: number
  /** Parte de los móviles que han entrado alguna vez desde la app instalada. */
  installed: number | null
  perView: { view: View; label: string; views: number; visitors: number }[]
  /** Un punto por día, del más antiguo a hoy, también los días sin nadie. */
  perDay: { date: Date; views: number; visitors: number }[]
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/** Resume las visitas de los últimos `days` días (hoy incluido), en hora local. */
export function summarizeViews(rows: ViewRecord[], days: number, now = new Date()): ViewSummary {
  const today = startOfDay(now)
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  const inRange = rows.filter((row) => new Date(row.created_at) >= from)

  const visitors = new Set<string>()
  const installed = new Set<string>()
  const byView = new Map<View, { views: number; visitors: Set<string> }>()
  const byDay = new Map<string, { views: number; visitors: Set<string> }>()

  for (const row of inRange) {
    visitors.add(row.visitor)
    if (row.standalone) installed.add(row.visitor)

    const own = byView.get(row.view) ?? { views: 0, visitors: new Set() }
    own.views++
    own.visitors.add(row.visitor)
    byView.set(row.view, own)

    const key = dayKey(new Date(row.created_at))
    const day = byDay.get(key) ?? { views: 0, visitors: new Set() }
    day.views++
    day.visitors.add(row.visitor)
    byDay.set(key, day)
  }

  const perDay = Array.from({ length: days }, (_, index) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + index)
    const day = byDay.get(dayKey(date))
    return { date, views: day?.views ?? 0, visitors: day?.visitors.size ?? 0 }
  })

  const perView = VIEWS.map((view) => ({
    view,
    label: VIEW_LABELS[view],
    views: byView.get(view)?.views ?? 0,
    visitors: byView.get(view)?.visitors.size ?? 0,
  })).sort((a, b) => b.views - a.views)

  return {
    views: inRange.length,
    visitors: visitors.size,
    today: perDay[perDay.length - 1]?.visitors ?? 0,
    dailyAverage: perDay.reduce((sum, day) => sum + day.visitors, 0) / days,
    installed: visitors.size > 0 ? installed.size / visitors.size : null,
    perView,
    perDay,
  }
}
