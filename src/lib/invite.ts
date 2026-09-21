import type { Settings } from '../types'

interface Invite {
  u: string
  k: string
  c: string
  n: string
  f: number
}

const encode = (value: string) => btoa(String.fromCharCode(...new TextEncoder().encode(value)))
const decode = (value: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)))

/**
 * Enlace de invitación: lleva dentro las claves de Supabase y el código del
 * equipo, así el resto del equipo solo tiene que abrirlo.
 */
export function buildInviteLink(settings: Settings): string {
  const invite: Invite = {
    u: settings.supabaseUrl,
    k: settings.supabaseAnonKey,
    c: settings.teamCode,
    n: settings.teamName,
    f: settings.fineAmount,
  }
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/unirse/${encodeURIComponent(encode(JSON.stringify(invite)))}`
}

export function readInvite(token: string): Partial<Settings> | null {
  try {
    const invite = JSON.parse(decode(decodeURIComponent(token))) as Invite
    if (!invite.u || !invite.k || !invite.c) return null
    return {
      supabaseUrl: invite.u,
      supabaseAnonKey: invite.k,
      teamCode: invite.c,
      teamName: invite.n || 'Mi equipo',
      fineAmount: typeof invite.f === 'number' ? invite.f : 1,
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
