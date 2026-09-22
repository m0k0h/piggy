import { euros, matchDate, percent, plural } from './format'
import {
  allServes,
  balances,
  fineAmount,
  participants,
  pot,
  servesOfMatch,
  tally,
  tallyByPlayer,
  teamName,
} from './stats'
import type { AppState, Match } from '../types'

/** Resumen de un partido, pensado para pegarlo en el grupo de WhatsApp. */
export function matchSummary(state: AppState, match: Match): string {
  const serves = servesOfMatch(state, match.id)
  const total = tally(serves)
  const fine = fineAmount(state)
  const lines: string[] = []

  lines.push(`🏐 ${teamName(state)} ${match.home ? 'vs' : '@'} ${match.opponent}`)
  lines.push(matchDate(match.date))
  lines.push('')

  if (total.attempts === 0) {
    lines.push('No se anotó ningún saque.')
    return lines.join('\n')
  }

  lines.push(
    `Saques: ${total.attempts} · dentro ${total.in + total.aces} (${percent(total.ratio)}) · aces ${total.aces} · fallos ${total.errors}`,
  )
  lines.push(`🐷 Hucha del partido: ${euros(total.errors * fine)}`)

  const roster = participants(state, match.id)
    .filter((player) => serves.some((serve) => serve.playerId === player.id))
    .map((player) => ({ player, own: tallyByPlayer(serves, player.id) }))
    .sort((a, b) => b.own.errors - a.own.errors || b.own.attempts - a.own.attempts)

  if (roster.length > 0) {
    lines.push('')
    for (const { player, own } of roster) {
      const money = own.errors > 0 ? ` — ${euros(own.errors * fine)}` : ''
      lines.push(
        `• ${player.name}: ${plural(own.attempts, 'saque', 'saques')}, ${plural(own.errors, 'fallo', 'fallos')} (${percent(own.ratio)} dentro)${money}`,
      )
    }
  }
  return lines.join('\n')
}

/** Estado de cuentas de la hucha, para anunciarlo antes del próximo partido. */
export function potSummary(state: AppState): string {
  const totals = pot(state)
  const globalRatio = tally(allServes(state)).ratio
  const lines: string[] = []

  lines.push(`🐷 Hucha de saques fallados de ${teamName(state)}`)
  lines.push(`Llevamos ${euros(totals.paid)} ahorrados.`)

  const pending = balances(state).filter((row) => row.pending > 0)
  if (pending.length > 0) {
    const names = pending.map((row) => row.player.name).join(', ')
    lines.push(`Faltan por pagar ${euros(totals.pending)} de ${names}.`)
  }

  lines.push(`Porcentaje de acierto del equipo: ${percent(globalRatio)}`)
  lines.push('')
  lines.push('https://m0k0h.github.io/piggy/#/hucha')
  return lines.join('\n')
}

/** Copia al portapapeles con respaldo para navegadores sin permiso. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

/** Abre el menú de compartir del móvil; si no existe, copia. */
export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      // Cancelar el diálogo no es un fallo que debamos reportar.
      if (err instanceof Error && err.name === 'AbortError') return 'shared'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}
