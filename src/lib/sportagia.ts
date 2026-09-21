/**
 * Importador de Sportagia.
 *
 * La web del equipo es una SPA con la ruta en el hash, así que el listado no
 * está en el HTML: lo pide a una API. Como no hemos podido confirmar cuál es,
 * aquí hay dos caminos:
 *
 *  1. `fetchTeam` prueba las rutas de API más probables. Funciona solo si el
 *     servidor envía cabeceras CORS; si no, el navegador lo bloqueará.
 *  2. `parsePasted`, que digiere lo que pegues: el JSON que veas en la pestaña
 *     Red de las DevTools, o directamente el texto seleccionado de la página.
 *
 * El segundo camino es el que no depende de nada y siempre está disponible.
 */

export interface ParsedPlayer {
  name: string
  number: string
  externalId: string | null
}

export interface ParsedMatch {
  /** ISO 8601 con hora local. */
  date: string
  opponent: string
  venue: string
  home: boolean
  externalId: string | null
}

export interface ParsedTeam {
  players: ParsedPlayer[]
  matches: ParsedMatch[]
}

const MONTHS: Record<string, number> = {
  gener: 1, enero: 1, ene: 1, gen: 1,
  febrer: 2, febrero: 2, feb: 2,
  marc: 3, març: 3, marzo: 3, mar: 3,
  abril: 4, abr: 4,
  maig: 5, mayo: 5, may: 5, mai: 5,
  juny: 6, junio: 6, jun: 6,
  juliol: 7, julio: 7, jul: 7,
  agost: 8, agosto: 8, ago: 8, ag: 8,
  setembre: 9, septiembre: 9, set: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  novembre: 11, noviembre: 11, nov: 11,
  desembre: 12, diciembre: 12, des: 12, dic: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Construye un ISO local (sin zona) para que el móvil lo lea como hora de pista. */
const iso = (y: number, m: number, d: number, hh = 0, mm = 0) =>
  `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}`

/**
 * Lee una fecha de casi cualquier forma: ISO, dd/mm/aaaa, dd-mm-aa o
 * "25 d'octubre de 2025", con hora opcional.
 */
export function parseDate(input: string, fallbackYear = new Date().getFullYear()): string | null {
  const raw = input.trim()
  if (!raw) return null

  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/)
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch
    return iso(+y, +m, +d, hh ? +hh : 0, mm ? +mm : 0)
  }

  const text = strip(raw)
  let year: number | null = null
  let month = 0
  let day = 0
  // Apartamos la fecha antes de buscar la hora: si no, "25.10.2025" se leería
  // como las 25:10.
  let rest = text

  const numeric = text.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/)
  if (numeric && +numeric[1] >= 1 && +numeric[1] <= 31 && +numeric[2] >= 1 && +numeric[2] <= 12) {
    day = +numeric[1]
    month = +numeric[2]
    year = numeric[3] ? (+numeric[3] < 100 ? +numeric[3] + 2000 : +numeric[3]) : fallbackYear
    rest = text.replace(numeric[0], ' ')
  } else {
    const named = text.match(/\b(\d{1,2})\s*(?:d[e']\s*)?([a-z]+)\.?(?:\s*(?:de\s*|del\s*)?(\d{4}))?/)
    const namedMonth = named ? MONTHS[named[2]] : undefined
    if (named && namedMonth) {
      day = +named[1]
      month = namedMonth
      year = named[3] ? +named[3] : fallbackYear
      rest = text.replace(named[0], ' ')
    }
  }
  if (year === null) return null

  const time = rest.match(/\b([01]?\d|2[0-3])[:.h]([0-5]\d)(?!\d)/)
  return iso(year, month, day, time ? +time[1] : 0, time ? +time[2] : 0)
}

const pick = (obj: Record<string, unknown>, keys: string[]): string => {
  for (const key of Object.keys(obj)) {
    if (keys.includes(strip(key))) {
      const value = obj[key]
      if (value != null && typeof value !== 'object') return String(value).trim()
    }
  }
  return ''
}

const NAME_KEYS = ['nom', 'nombre', 'name', 'jugador', 'jugadora', 'nomcomplet', 'fullname']
const SURNAME_KEYS = ['cognom', 'cognoms', 'apellido', 'apellidos', 'surname', 'lastname']
const NUMBER_KEYS = ['dorsal', 'numero', 'num', 'number', 'no']
const ID_KEYS = ['id', 'idjugador', 'idjugadora', 'idpartit', 'externalid', 'uuid']
const DATE_KEYS = ['data', 'fecha', 'date', 'datahora', 'fechahora', 'datetime', 'dia', 'inici']
const RIVAL_KEYS = ['rival', 'contrari', 'contrario', 'opponent', 'equipvisitant', 'visitant', 'visitante', 'equiprival']
const VENUE_KEYS = ['pavello', 'pabellon', 'lloc', 'lugar', 'venue', 'installacio', 'instalacion', 'camp', 'pista']
const HOME_KEYS = ['local', 'escasa', 'ishome', 'home', 'casa']

function asPlayer(obj: Record<string, unknown>): ParsedPlayer | null {
  const first = pick(obj, NAME_KEYS)
  if (!first) return null
  const last = pick(obj, SURNAME_KEYS)
  const name = `${first} ${last}`.trim()
  if (name.length < 2) return null
  return { name, number: pick(obj, NUMBER_KEYS), externalId: pick(obj, ID_KEYS) || null }
}

function asMatch(obj: Record<string, unknown>): ParsedMatch | null {
  const rawDate = pick(obj, DATE_KEYS)
  const date = rawDate ? parseDate(rawDate) : null
  if (!date) return null
  const opponent = pick(obj, RIVAL_KEYS)
  if (!opponent) return null
  const homeRaw = strip(pick(obj, HOME_KEYS))
  return {
    date,
    opponent,
    venue: pick(obj, VENUE_KEYS),
    home: homeRaw === '' ? true : !['false', '0', 'no', 'visitant', 'visitante', 'fora'].includes(homeRaw),
    externalId: pick(obj, ID_KEYS) || null,
  }
}

/** Recorre un JSON de forma recursiva y recoge todo lo que parezca jugadora o partido. */
function walkJson(value: unknown, out: ParsedTeam, depth = 0) {
  if (depth > 8 || value == null) return
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, out, depth + 1)
    return
  }
  if (typeof value !== 'object') return

  const obj = value as Record<string, unknown>
  const match = asMatch(obj)
  if (match) out.matches.push(match)
  else {
    const player = asPlayer(obj)
    if (player) out.players.push(player)
  }
  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === 'object') walkJson(nested, out, depth + 1)
  }
}

/** Una línea de partido: fecha + rival, tal como se ve al copiar el calendario. */
function lineAsMatch(line: string): ParsedMatch | null {
  const date = parseDate(line)
  if (!date) return null
  // Quitamos fecha, hora, resultado y separadores para quedarnos con el rival.
  const rest = line
    .replace(/\b\d{1,2}[/\-.]\d{1,2}(?:[/\-.]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ][\d:]+)?/g, ' ')
    .replace(/\b\d{1,2}[:.h]\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\s*-\s*\d{1,2}\b/g, ' ')
    .replace(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\b`, 'gi'), ' ')
    .replace(/\b(dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|de|del|d'|a les|h)\b/gi, ' ')
    .replace(/[|;\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const opponent = rest.replace(/^[-–—:,.\s]+|[-–—:,.\s]+$/g, '').trim()
  if (opponent.length < 3) return null
  return { date, opponent, venue: '', home: true, externalId: null }
}

/** Una línea de jugadora: "12 Anna Nuñez", "Anna Nuñez - 12" o solo el nombre. */
function lineAsPlayer(line: string): ParsedPlayer | null {
  const text = line.replace(/[|;\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (!text || text.length > 60) return null

  const leading = text.match(/^(\d{1,2})[\s.\-–)]+(.+)$/)
  if (leading) return { name: leading[2].trim(), number: leading[1], externalId: null }

  const trailing = text.match(/^(.+?)[\s.\-–(]+(\d{1,2})\)?$/)
  if (trailing && /[a-zA-ZÀ-ÿ]{2,}/.test(trailing[1])) {
    return { name: trailing[1].trim(), number: trailing[2], externalId: null }
  }

  // Solo texto: lo aceptamos si parece un nombre y no una frase de la web.
  if (/^[A-Za-zÀ-ÿ'’.\-\s]{3,40}$/.test(text) && text.split(/\s+/).length <= 5) {
    return { name: text, number: '', externalId: null }
  }
  return null
}

export type PasteKind = 'players' | 'matches'

/**
 * Digiere lo pegado. Si es JSON lo recorre entero; si es texto suelto, va
 * línea a línea buscando lo que pediste (`kind`).
 */
export function parsePasted(raw: string, kind: PasteKind): ParsedTeam {
  const out: ParsedTeam = { players: [], matches: [] }
  const text = raw.trim()
  if (!text) return out

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      walkJson(JSON.parse(text), out)
      if (out.players.length > 0 || out.matches.length > 0) return dedupe(out)
    } catch {
      // No era JSON válido; seguimos con el modo texto.
    }
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (kind === 'matches') {
      const match = lineAsMatch(trimmed)
      if (match) out.matches.push(match)
    } else {
      const player = lineAsPlayer(trimmed)
      if (player) out.players.push(player)
    }
  }
  return dedupe(out)
}

function dedupe(team: ParsedTeam): ParsedTeam {
  const seenPlayers = new Set<string>()
  const seenMatches = new Set<string>()
  return {
    players: team.players.filter((p) => {
      const key = strip(p.name)
      if (seenPlayers.has(key)) return false
      seenPlayers.add(key)
      return true
    }),
    matches: team.matches.filter((m) => {
      const key = `${m.date.slice(0, 10)}|${strip(m.opponent)}`
      if (seenMatches.has(key)) return false
      seenMatches.add(key)
      return true
    }),
  }
}

/** Saca el id del equipo de una URL tipo `.../#/equip/31`. */
export function teamIdFromUrl(url: string): string | null {
  return url.match(/(?:equip|equipo|team)s?\/(\d+)/)?.[1] ?? null
}

/** Rutas de API candidatas mientras no confirmemos la real. */
export function candidateEndpoints(url: string): string[] {
  const id = teamIdFromUrl(url)
  if (!id) return []
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return []
  }
  return [
    `${origin}/api/equip/${id}`,
    `${origin}/api/equips/${id}`,
    `${origin}/api/team/${id}`,
    `${origin}/api/v1/equip/${id}`,
    `${origin}/api/equip/${id}/jugadors`,
    `${origin}/api/equip/${id}/partits`,
    `${origin}/api/equips/${id}/jugadors`,
    `${origin}/api/equips/${id}/partits`,
  ]
}

export interface FetchReport extends ParsedTeam {
  /** Rutas que respondieron con datos aprovechables. */
  hits: string[]
  errors: string[]
}

/**
 * Intenta leer Sportagia directamente. Puede fallar por CORS: en ese caso el
 * informe lo dice y queda el pegado manual, que siempre funciona.
 */
export async function fetchTeam(url: string): Promise<FetchReport> {
  const report: FetchReport = { players: [], matches: [], hits: [], errors: [] }
  const endpoints = candidateEndpoints(url)
  if (endpoints.length === 0) {
    report.errors.push('No he reconocido el id del equipo en esa URL.')
    return report
  }

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })
      if (!response.ok) {
        report.errors.push(`${endpoint} → HTTP ${response.status}`)
        continue
      }
      const found: ParsedTeam = { players: [], matches: [] }
      walkJson(await response.json(), found)
      if (found.players.length === 0 && found.matches.length === 0) {
        report.errors.push(`${endpoint} → respondió, pero sin datos reconocibles`)
        continue
      }
      report.hits.push(endpoint)
      report.players.push(...found.players)
      report.matches.push(...found.matches)
    } catch (err) {
      report.errors.push(`${endpoint} → ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const clean = dedupe(report)
  report.players = clean.players
  report.matches = clean.matches
  return report
}
