/**
 * Todos los iconos de la app, en un solo sitio. Mismo lenguaje visual en
 * todos: lienzo de 24×24, trazo de 1.8, esquinas y remates redondeados,
 * `currentColor` para heredar el color del texto que los acompaña.
 *
 * Los dos únicos con color fijo son la cerdita a color (`PigIcon`) y su
 * versión de trazo (`PigLineIcon`, que sigue heredando `currentColor`).
 *
 * Los que van solos (sin texto al lado) llevan su propio `aria-label` desde
 * quien los usa; el resto se pinta con `aria-hidden`.
 */
import type { SVGProps } from 'react'
import { POSITION_LABELS, type Position } from '../types'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

const stroke = (size: number, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
})

/** La cerdita a color: cabecera de marca, estados vacíos destacados. */
export function PigIcon({ size = 38, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" {...props}>
      <path
        d="M52 33c6-2 7.5 4.5 2.2 6-2.8.8-3.8-2.2-1.2-3"
        fill="none"
        stroke="var(--pig-dark)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M15.5 21 12.6 8.2c-.4-1.8 1-2.6 2.4-1.7L27 13.8Z" fill="var(--pig-dark)" />
      <path d="M48.5 21l2.9-12.8c.4-1.8-1-2.6-2.4-1.7L37 13.8Z" fill="var(--pig-dark)" />
      <ellipse cx="32" cy="36" rx="24" ry="20.5" fill="var(--pig)" />
      <ellipse cx="17" cy="41" rx="4" ry="2.6" fill="var(--pig-blush)" />
      <ellipse cx="47" cy="41" rx="4" ry="2.6" fill="var(--pig-blush)" />
      <rect x="25" y="18" width="14" height="3.6" rx="1.8" fill="var(--pig-slot)" />
      <circle cx="22.5" cy="33" r="2.7" fill="var(--pig-eye)" />
      {/* El ojo derecho es un guiño: un arco, no un círculo. Que no se "arregle". */}
      <path d="M38.5 33.4c1.6-2.2 3.8-2.2 5.4 0" fill="none" stroke="var(--pig-eye)" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="32" cy="45" rx="11.5" ry="8.5" fill="var(--pig-snout)" />
      <ellipse cx="28.2" cy="45" rx="2" ry="2.6" fill="var(--pig-dark)" />
      <ellipse cx="35.8" cy="45" rx="2" ry="2.6" fill="var(--pig-dark)" />
    </svg>
  )
}

/** La cerdita de trazo: nav y marca de agua del hero. */
export function PigLineIcon({ size = 22, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M5.6 8.4 4.7 4.6c-.1-.5.3-.8.8-.6l3.6 1.6" />
      <path d="m18.4 8.4.9-3.8c.1-.5-.3-.8-.8-.6l-3.6 1.6" />
      <path d="M12 6.4c5 0 9 3.2 9 7.2s-4 7.2-9 7.2-9-3.2-9-7.2 4-7.2 9-7.2Z" />
      <ellipse cx="12" cy="15.3" rx="3.5" ry="2.7" />
      <path d="M10.8 15.3h.01" />
      <path d="M13.2 15.3h.01" />
      <path d="M8.2 11.7h.01" />
    </svg>
  )
}

export function BallIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6c3.5 2.9 4.5 9 2.5 13.1" />
      <path d="M18.4 5.6c-3.5 2.9-4.5 9-2.5 13.1" />
    </svg>
  )
}

export function ChartIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M4 20V11" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M21 20H3" />
    </svg>
  )
}

export function CalendarIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 11h18" />
    </svg>
  )
}

export function PlusIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, { strokeWidth: 2, ...props })} aria-hidden="true" focusable="false">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

/** Pareja de `PlusIcon`: bajar un valor, como el set del partido en marcha. */
export function MinusIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, { strokeWidth: 2, ...props })} aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
    </svg>
  )
}

/** Fin de fila / avanzar. Usa `direction="left"` para el botón de volver. */
export function ChevronIcon({
  size = 24,
  direction = 'right',
  ...props
}: IconProps & { direction?: 'left' | 'right' }) {
  return (
    <svg
      {...stroke(size, { strokeWidth: 2.2, ...props })}
      aria-hidden="true"
      focusable="false"
      style={direction === 'left' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export function ShieldIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M12 3.5 5 6v6c0 4.4 3 7.5 7 8.5 4-1 7-4.1 7-8.5V6Z" />
    </svg>
  )
}

export function PeopleIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.7-3.4 3-5.2 5.5-5.2s4.8 1.8 5.5 5.2" />
      <path d="M15.3 5.6c1.4.3 2.4 1.5 2.4 3s-1 2.7-2.4 3" />
      <path d="M18 13.9c2 .5 3.4 2.1 4 4.7" />
    </svg>
  )
}

export function CoinsIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <ellipse cx="9" cy="8" rx="6" ry="3.4" />
      <path d="M3 8v4c0 1.9 2.7 3.4 6 3.4s6-1.5 6-3.4V8" />
      <path d="M3 12v4c0 1.9 2.7 3.4 6 3.4s6-1.5 6-3.4v-1" />
      <path d="M15.5 9.3c2.6.4 4.5 1.7 4.5 3.3s-1.9 2.9-4.5 3.3" />
    </svg>
  )
}

export function CheckIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, { strokeWidth: 2.2, ...props })} aria-hidden="true" focusable="false">
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  )
}

export function XIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, { strokeWidth: 2.2, ...props })} aria-hidden="true" focusable="false">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  )
}

export function StarIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.9Z" />
    </svg>
  )
}

/** Celebración: "todas al día", "nadie debe nada". */
export function PartyIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M4.5 20 8 8.5l7.5 7.5Z" />
      <path d="M8 8.5 18.5 5 16 15.5" />
      <path d="M14 3.5l1 2" />
      <path d="M19 6.5l2 1" />
      <path d="M17.5 10.5l2 .6" />
    </svg>
  )
}

/** "No sé qué decirte": partido que ya no existe. */
export function ShrugIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M4 19c.6-3.2 2.2-5 5-5.6" />
      <path d="M20 19c-.4-2.4-1.5-4-3.2-5" />
      <path d="M9 13.4v2.4l-2.4 2" />
      <path d="M15 13.6c1.6.3 2.6 1.3 2.6 2.6" />
    </svg>
  )
}

/** Acta sin nada anotado. */
export function ClipboardIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <rect x="5" y="4.5" width="14" height="17" rx="2.4" />
      <path d="M9 4.5V3.4A1.4 1.4 0 0 1 10.4 2h3.2A1.4 1.4 0 0 1 15 3.4v1.1" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  )
}

/** Casa: partido que se juega en el pabellón propio. */
/** Enlace que abre fuera de la app: ficha del rival en la web de la liga. */
export function ExternalLinkIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M17.5 13.5V19a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2H11" />
      <path d="M14.5 3.5h6v6" />
      <path d="M20 4 10.5 13.5" />
    </svg>
  )
}

/** Deshacer: la flecha que da marcha atrás sobre un saque anotado. */
export function UndoIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M9.5 15 4.5 10l5-5" />
      <path d="M4.5 10h10a5 5 0 0 1 0 10H9" />
    </svg>
  )
}

export function HomeIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" />
      <path d="M10 20.5V14a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6.5" />
    </svg>
  )
}

/** Silbato: la hora a la que se convoca antes del partido. */
export function WhistleIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <circle cx="9" cy="14" r="5.5" />
      <path d="M12.5 9.8 20.5 7v4.5l-5.2.9" />
      <path d="M4 6.5 5.5 8M8 4v2M2.5 10.5h2" />
      <circle cx="9" cy="14" r="1.2" />
    </svg>
  )
}

/** Chincheta del mapa: el enlace a Google Maps del pabellón. */
export function MapPinIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  )
}

/** Compartir: la flecha que sale de la bandeja, para mandar la hucha por WhatsApp. */
export function ShareIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M12 14.5V3.5" />
      <path d="M7.5 8 12 3.5 16.5 8" />
      <path d="M8 11H6.5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H16" />
    </svg>
  )
}

/** Megáfono: lo que la administradora quiere comentar con el equipo. */
export function MegaphoneIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...stroke(size, props)} aria-hidden="true" focusable="false">
      <path d="M4 10.2a1.7 1.7 0 0 1 1.7-1.7H9l8-4v15l-8-4H5.7A1.7 1.7 0 0 1 4 13.8Z" />
      <path d="M7.5 15.5 9 20" />
      <path d="M20 9.5a3 3 0 0 1 0 5" />
    </svg>
  )
}

/**
 * Posición en el campo, como forma geométrica: triángulo la colocadora,
 * cuadrado la punta, círculo la central. Rellenas (relleno y trazo en
 * `currentColor`) para que se distingan a tamaño pequeño; el trazo redondea
 * las esquinas como en el resto de iconos. Lleva su propio `aria-label`
 * porque la forma sola es el dato.
 */
export function PositionIcon({ position, size = 12, ...props }: IconProps & { position: Position }) {
  return (
    <svg
      {...stroke(size, props)}
      fill="currentColor"
      role="img"
      aria-label={POSITION_LABELS[position]}
      focusable="false"
    >
      {position === 'setter' ? <path d="M12 4 20.5 19h-17Z" /> : null}
      {position === 'outside' ? <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" /> : null}
      {position === 'middle' ? <circle cx="12" cy="12" r="8" /> : null}
    </svg>
  )
}
