import type { Settings } from '../types'

interface Invite {
  u: string
  k: string
  c: string
  /** Nombre del equipo, solo para que la pantalla de bienvenida diga a cuál entras. */
  n: string
}

const encode = (value: string) => btoa(String.fromCharCode(...new TextEncoder().encode(value)))
const decode = (value: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)))

/**
 * Enlace de invitación: lleva dentro las claves de Supabase y el código del
 * equipo, así el resto del equipo solo tiene que abrirlo.
 */
export function buildInviteLink(settings: Settings, teamName: string): string {
  const invite: Invite = {
    u: settings.supabaseUrl,
    k: settings.supabaseAnonKey,
    c: settings.teamCode,
    n: teamName,
  }
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/unirse/${encodeURIComponent(encode(JSON.stringify(invite)))}`
}

export interface ParsedInvite {
  settings: Pick<Settings, 'supabaseUrl' | 'supabaseAnonKey' | 'teamCode'>
  teamName: string
}

export function readInvite(token: string): ParsedInvite | null {
  try {
    const invite = JSON.parse(decode(decodeURIComponent(token))) as Invite
    if (!invite.u || !invite.k || !invite.c) return null
    return {
      settings: { supabaseUrl: invite.u, supabaseAnonKey: invite.k, teamCode: invite.c },
      teamName: invite.n || 'Mi equipo',
    }
  } catch {
    return null
  }
}

/** Código corto y legible para decirlo en voz alta en el vestuario. */
export function randomTeamCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')
}
