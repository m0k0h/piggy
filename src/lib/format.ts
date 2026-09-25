const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const euroWholeFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Los importes redondos se ven mejor sin decimales: "12 €" en vez de "12,00 €". */
export const euros = (amount: number): string =>
  Number.isInteger(amount) ? euroWholeFormatter.format(amount) : euroFormatter.format(amount)

const dayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
const longFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

const asDate = (value: string) => new Date(value)
const valid = (d: Date) => !Number.isNaN(d.getTime())

export function matchDate(value: string): string {
  const date = asDate(value)
  if (!valid(date)) return value
  const day = dayFormatter.format(date).replace('.', '')
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  return hasTime ? `${day} · ${timeFormatter.format(date)}` : day
}

export function matchDateLong(value: string): string {
  const date = asDate(value)
  if (!valid(date)) return value
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
  return hasTime ? `${longFormatter.format(date)} a las ${timeFormatter.format(date)}` : longFormatter.format(date)
}

/** Minutos antes del partido a los que se cita a las jugadoras. */
const CALL_MINUTES = 45

/** Hora de la convocatoria ("17:45"), o null si el partido no tiene hora. */
export function callTime(value: string): string | null {
  const date = asDate(value)
  if (!valid(date)) return null
  if (date.getHours() === 0 && date.getMinutes() === 0) return null
  return timeFormatter.format(new Date(date.getTime() - CALL_MINUTES * 60_000))
}

/** "hoy", "mañana" o los días que faltan; en pasado, cuánto hace. */
export function relativeDay(value: string): string {
  const date = asDate(value)
  if (!valid(date)) return ''
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(date) - startOf(new Date())) / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days === -1) return 'ayer'
  return days > 0 ? `en ${days} días` : `hace ${Math.abs(days)} días`
}

export const percent = (ratio: number | null): string =>
  ratio === null ? '—' : `${Math.round(ratio * 100)}%`

/** "3/12 saques fallidos · 75% de acierto": el resumen que se repite en cada fila de jugadora. */
export const serveSummary = (errors: number, attempts: number, ratio: number | null): string =>
  attempts === 0 ? 'Sin datos todavía' : `${errors}/${attempts} saques fallidos · ${percent(ratio)} de acierto`

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}

/** Valor para un `<input type="datetime-local">` a partir de un ISO guardado. */
export const toInputValue = (value: string): string => value.slice(0, 16)

/** Fecha por defecto al crear un partido: hoy a las 18:00. */
export function defaultMatchDate(): string {
  const date = new Date()
  date.setHours(18, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T18:00`
}

/** "1 fallo" / "3 fallos": el singular se nota mucho en pantalla. */
export const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

/** Deja una dirección utilizable aunque se pegue sin `https://` delante. */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Igual, pero admitiendo además una imagen pegada como data URL. */
export function normalizeImageUrl(value: string): string {
  const trimmed = value.trim()
  return /^data:image\//i.test(trimmed) ? trimmed : normalizeUrl(trimmed)
}

/** El dominio, para enseñar un enlace largo sin que rompa la fila. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Une una lista al estilo español: comas entre todos menos los dos últimos,
 * que van con "y". "Anna, Marta y Laura" en vez de "Anna, Marta, y Laura".
 */
export function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/** Nombre corto de la liga ("Femenina", "Mixta"), o el largo con `long`. */
export function leagueName(league: 'femenina' | 'mixta', long = false): string {
  const name = league === 'mixta' ? 'Mixta' : 'Femenina'
  return long ? `Liga ${name.toLowerCase()}` : name
}
