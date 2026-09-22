import { useState, type ReactNode } from 'react'
import { hostOf, initials } from '../lib/format'

export function Avatar({ name, on = false }: { name: string; on?: boolean }) {
  return (
    <span className={on ? 'avatar on' : 'avatar'} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

export function Stat({
  value,
  label,
  tone,
}: {
  value: ReactNode
  label: string
  tone?: 'good' | 'bad' | 'money'
}) {
  return (
    <div className={tone ? `stat ${tone}` : 'stat'}>
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  )
}

export function Empty({
  glyph,
  title,
  children,
}: {
  glyph: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="glyph" aria-hidden="true">
        {glyph}
      </span>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {aside}
    </div>
  )
}

/** Barra verde/roja con la proporción de saques que entraron. */
export function RatioBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null
  return (
    <div className="bar" aria-hidden="true">
      <i style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  )
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  actions?: ReactNode
}) {
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onBack} aria-label="Volver">
        ‹
      </button>
      <h1>
        {title}
        {subtitle ? <span className="sub">{subtitle}</span> : null}
      </h1>
      {actions}
    </header>
  )
}

/** Escudo del equipo, con las iniciales de reserva mientras no haya imagen. */
export function Crest({
  team,
  big = false,
}: {
  team: { name: string; logo: string }
  big?: boolean
}) {
  return (
    <span className={big ? 'crest crest-big' : 'crest'} aria-hidden="true">
      {team.logo ? <img src={team.logo} alt="" /> : initials(team.name)}
    </span>
  )
}

/**
 * Escudo del rival. Una imagen de otro dominio se carga sin problema; si la
 * dirección deja de funcionar, volvemos a las iniciales sin dejar un hueco roto.
 */
export function OpponentCrest({
  opponent,
  logo,
  big = false,
}: {
  opponent: string
  logo?: string
  big?: boolean
}) {
  const [failed, setFailed] = useState('')
  const usable = logo && failed !== logo

  return (
    <span className={big ? 'crest crest-big' : 'crest'} aria-hidden="true">
      {usable ? (
        <img src={logo} alt="" loading="lazy" onError={() => setFailed(logo)} />
      ) : (
        initials(opponent || '?')
      )}
    </span>
  )
}

/** Enlace a la ficha del rival en la web de la liga. */
export function LeagueLink({ url }: { url?: string }) {
  if (!url) return null
  return (
    <a className="link" href={url} target="_blank" rel="noopener noreferrer">
      Ver en la liga · {hostOf(url)} ↗
    </a>
  )
}
