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
