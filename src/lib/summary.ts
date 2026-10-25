import { callTime, euros, joinNatural, leagueName, matchDate, matchDateLong, percent, plural } from './format'
import {
  allPlayers,
  allServes,
  balances,
  fineAmount,
  lineupOf,
  participants,
  playedMatches,
  pot,
  servesOfMatch,
  tally,
  tallyByPlayer,
  teamName,
  tileName,
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
  const outcome = lineupOf(state, match.id)?.outcome
  if (outcome) lines.push(outcome === 'won' ? '🏆 Ganado' : '😔 Perdido')
  const fines = total.errors * fine
  // Sin un solo euro a la hucha, se celebra.
  lines.push(`🐷 Hucha del partido: ${euros(fines)}${fines === 0 ? ' 🎉' : ''}`)
  lines.push('')

  if (total.attempts === 0) {
    lines.push('No se anotó ningún saque.')
  } else {
    lines.push(`Saques: ${total.attempts}`)
    lines.push(`Metidos: ${total.in + total.aces} (${percent(total.ratio)}) | Fallados: ${total.errors}`)
    lines.push(`Aces: ${total.aces}`)

    const roster = participants(state, match.id)
      .filter((player) => serves.some((serve) => serve.playerId === player.id))
      .map((player) => ({ player, own: tallyByPlayer(serves, player.id) }))
      .sort((a, b) => b.own.errors - a.own.errors || b.own.attempts - a.own.attempts)

    // Cada jugadora en dos líneas y separada de la siguiente, para que no quede apretado.
    for (const { player, own } of roster) {
      lines.push('')
      // Entre asteriscos, WhatsApp pone el nombre en negrita.
      lines.push(`*${tileName(player)}*`)
      lines.push(`${percent(own.ratio)} de acierto - ${euros(own.errors * fine)}`)
    }
  }

  lines.push('')
  lines.push('Consulta más datos en la app:')
  lines.push('https://m0k0h.github.io/piggy/#/partidos')
  return lines.join('\n')
}

/** Datos de un partido programado: cuándo y dónde. */
export function matchDetails(state: AppState, match: Match): string {
  const lines: string[] = []

  lines.push(`🏐 ${teamName(state)} ${match.home ? 'vs' : '@'} ${match.opponent || 'Rival por definir'}`)
  if (match.league) lines.push(`🏆 ${leagueName(match.league, true)}`)
  lines.push(`📅 ${matchDateLong(match.date)}`)
  const call = callTime(match.date)
  if (call) lines.push(`⏰ Convocadas a las ${call}`)
  lines.push(`📍 ${match.venue ? `${match.venue} · ` : ''}${match.home ? 'En casa' : 'Fuera'}`)
  // Fuera, el mapa del pabellón del rival; en casa ya se sabe llegar.
  const map = match.home ? '' : match.mapsUrl
  if (map) lines.push(map)
  if (match.streamUrl) lines.push(`📺 Directo: ${match.streamUrl}`)

  lines.push('')
  lines.push('Consulta más datos en la app:')
  lines.push(`https://m0k0h.github.io/piggy/#/partido/${match.id}`)
  return lines.join('\n')
}

/** Estado de cuentas de la hucha, para anunciarlo antes del próximo partido. */
export function potSummary(state: AppState): string {
  const totals = pot(state)
  const globalTally = tally(allServes(state))
  const lines: string[] = []

  lines.push(`🐷 Hucha de ${teamName(state)}`)
  // El total tiene en cuenta lo que se debe: es lo generado por los fallos,
  // esté ya cobrado o no — igual que la cifra grande de la app.
  lines.push(`Llevamos ahorrado: ${euros(totals.owed)}`)

  const pending = balances(state).filter((row) => row.pending > 0)
  if (pending.length > 0) {
    // El total sin paréntesis, los importes de cada una sí: es la cifra que
    // manda en la frase, no un dato más entre los nombres.
    const debtors = pending.map((row) => `${row.player.name} (${euros(row.pending)})`)
    lines.push(`Pendiente de pagar ${euros(totals.pending)}: ${joinNatural(debtors)}.`)
  } else if (totals.owed > 0) {
    lines.push('¡Todas al día! 🎉')
  }

  lines.push('')
  lines.push(`Porcentaje de acierto del equipo: ${percent(globalTally.ratio)}`)
  if (globalTally.attempts > 0) {
    lines.push(`${globalTally.errors}/${globalTally.attempts} saques fallados`)
  }
  lines.push('')
  lines.push('Consulta más datos en la app:')
  lines.push('https://m0k0h.github.io/piggy/#/hucha')
  return lines.join('\n')
}

/** Balance de toda la temporada, lo mismo que enseña Stats con «Toda la temporada». */
export function seasonSummary(state: AppState): string {
  const serves = allServes(state)
  const total = tally(serves)
  const fine = fineAmount(state)
  const played = playedMatches(state).length
  const lines: string[] = []

  // Entre asteriscos, negrita; entre guiones bajos, cursiva (en WhatsApp).
  lines.push(`*${teamName(state)} Stats*`)
  lines.push('_Toda la temporada_')
  if (played > 0) lines.push(plural(played, 'partido jugado', 'partidos jugados'))
  lines.push(`🐷 Hucha: ${euros(total.errors * fine)}`)
  lines.push('')

  if (total.attempts === 0) {
    lines.push('Todavía no hay saques anotados.')
  } else {
    lines.push(`Saques: ${total.attempts}`)
    lines.push(`Metidos: ${total.in + total.aces} (${percent(total.ratio)}) | Fallados: ${total.errors}`)
    lines.push(`Aces: ${total.aces}`)

    const rows = allPlayers(state)
      .map((player) => ({ player, own: tallyByPlayer(serves, player.id) }))
      .filter((row) => row.own.attempts > 0)
    // El mismo orden que «Mejor %» en la app: a igual porcentaje, quien más ha sacado.
    const best = [...rows]
      .sort((a, b) => (b.own.ratio ?? 0) - (a.own.ratio ?? 0) || b.own.attempts - a.own.attempts)
      .slice(0, 3)
    if (best.length > 0) {
      lines.push('')
      lines.push('🎯 Mejor porcentaje')
      for (const { player, own } of best) {
        // Entre asteriscos, WhatsApp pone el nombre en negrita.
        lines.push(`• *${tileName(player)}*: ${percent(own.ratio)} (${plural(own.attempts, 'saque', 'saques')})`)
      }
    }
    const aces = rows.filter((row) => row.own.aces > 0).sort((a, b) => b.own.aces - a.own.aces)[0]
    if (aces) lines.push(`⚡ Más aces: *${tileName(aces.player)}* (${aces.own.aces})`)
  }

  lines.push('')
  lines.push('Consulta más datos en la app:')
  lines.push('https://m0k0h.github.io/piggy/#/stats')
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
