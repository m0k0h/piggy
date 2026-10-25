import { useState, type ReactNode } from 'react'
import { initials, leagueName } from '../lib/format'
import type { Tally } from '../lib/stats'
import type { League, MatchOutcome, Player } from '../types'
import { ChevronIcon, ExternalLinkIcon, PartyIcon, PositionIcon, SadIcon } from './icons'

/**
 * El nombre de una jugadora con la forma de su posición delante (si tiene).
 * Úsalo en cualquier sitio de la interfaz donde salga una jugadora.
 */
export function PlayerName({ player }: { player?: Pick<Player, 'name' | 'position'> }) {
  return (
    <span className="player-name">
      {player?.position ? <PositionIcon position={player.position} className="position-mark" /> : null}
      {player?.name ?? 'Jugadora'}
    </span>
  )
}

export function Avatar({
  name,
  number,
  on = false,
  big = false,
}: {
  name: string
  number?: string
  on?: boolean
  big?: boolean
}) {
  const className = ['avatar', on && 'on', big && 'big'].filter(Boolean).join(' ')
  return (
    <span className={className} aria-hidden="true">
      {number?.trim() ? number.trim() : initials(name)}
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
  tone?: 'good' | 'bad' | 'money' | 'ace'
}) {
  return (
    <div className={tone ? `stat ${tone}` : 'stat'}>
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  )
}

export function Empty({
  icon,
  title,
  highlight = false,
  children,
}: {
  icon: ReactNode
  title: string
  /** El hueco de la hucha: círculo rosa tenue detrás del icono. Es la
   * identidad de esa pantalla, no un estado vacío más. */
  highlight?: boolean
  children?: ReactNode
}) {
  return (
    <div className={highlight ? 'empty highlight' : 'empty'}>
      <span className="glyph" aria-hidden="true">
        {icon}
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
/** Barra de saques: dentro en verde, aces en violeta y, de fondo, fallos en rojo. */
export function RatioBar({ tally }: { tally: Pick<Tally, 'attempts' | 'in' | 'aces'> }) {
  if (tally.attempts === 0) return null
  const width = (count: number) => `${(count / tally.attempts) * 100}%`
  return (
    <div className="bar" aria-hidden="true">
      <i style={{ width: width(tally.in) }} />
      <i className="ace" style={{ width: width(tally.aces) }} />
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
        <ChevronIcon direction="left" size={20} />
      </button>
      <h1>
        {title}
        {subtitle ? <span className="sub">{subtitle}</span> : null}
      </h1>
      {actions}
    </header>
  )
}

const crestClass = (big: boolean, hasLogo: boolean, round = false) =>
  ['crest', big && 'crest-big', hasLogo && 'has-logo', round && 'round'].filter(Boolean).join(' ')

/** Escudo del equipo, con las iniciales de reserva mientras no haya imagen. */
export function Crest({
  team,
  big = false,
}: {
  team: { name: string; logo: string }
  big?: boolean
}) {
  return (
    <span className={crestClass(big, Boolean(team.logo))} aria-hidden="true">
      {team.logo ? <img src={team.logo} alt="" /> : initials(team.name)}
    </span>
  )
}

/**
 * La liga del partido como etiqueta de color: rosa la femenina, ámbar la
 * mixta, para distinguirlas de un vistazo en la lista. Nada si no la tiene.
 */
export function LeagueTag({ league, long = false }: { league?: League; long?: boolean }) {
  if (!league) return null
  return <span className={`league-tag ${league}`}>{leagueName(league, long)}</span>
}

/** Ganado (fiesta, en verde) o perdido (cara triste, en rojo). `long` añade «Partido». */
export function OutcomeTag({ outcome, long = false }: { outcome?: MatchOutcome; long?: boolean }) {
  if (!outcome) return null
  const won = outcome === 'won'
  const Icon = won ? PartyIcon : SadIcon
  return (
    <span className={`outcome-tag ${outcome}`}>
      <Icon size={long ? 15 : 12} />
      {long ? 'Partido ' : ''}
      {won ? 'ganado' : 'perdido'}
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
    <span className={crestClass(big, Boolean(usable), true)} aria-hidden="true">
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
      <ExternalLinkIcon size={15} />
      Ver en la liga
    </a>
  )
}

/**
 * El punto rojo de «en directo»: el partido está en juego y tiene directo en
 * YouTube. Late despacio; con el movimiento reducido se queda quieto.
 */
export function LiveDot() {
  return <span className="live-dot" aria-hidden="true" />
}
