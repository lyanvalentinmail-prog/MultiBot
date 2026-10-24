const UNIT_MAP = {
  h: 3600_000,
  hr: 3600_000,
  hrs: 3600_000,
  hora: 3600_000,
  horas: 3600_000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minuto: 60_000,
  minutos: 60_000,
  s: 1000,
  seg: 1000,
  segundo: 1000,
  segundos: 1000
}

const DURATION_RX = /(\d+)\s*(h|hr|hrs|hora|horas|m|min|mins|minuto|minutos|s|seg|segundo|segundos)\b/gi
const MAX_MS = 7 * 24 * 3600_000 // 7 días

export function parseDurationMs(input) {
  if (!input) return 0
  let total = 0
  for (const match of String(input).matchAll(DURATION_RX)) {
    const mult = UNIT_MAP[match[2].toLowerCase()]
    if (mult) total += parseInt(match[1], 10) * mult
  }
  return total
}

export function stripDurations(text) {
  if (!text) return text
  return String(text)
    .replace(DURATION_RX, '')
    .replace(/[\\/,|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function formatMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (ss || parts.length === 0) parts.push(`${ss}s`)
  return parts.join(' ')
}

export default {
  name: 'timer',
  aliases: ['temp', 'recordar', 'aviso'],
  category: 'herramientas',
  description: 'Avisarte algo dentro de un tiempo.',
  usage: '.timer mensaje tiempo (ej. .timer Jugar 25s)',
  examples: ['.timer Vamos a jugar 25s', '.timer Reunión 3m', '.timer Evento 1h 20m'],
  async run(ctx) {
    const cleaned = ctx.argsText.trim()
    if (!cleaned) {
      throw new Error(
        `Uso: *${ctx.prefix}timer mensaje tiempo*\nEj: *${ctx.prefix}timer Vamos a jugar 25s* · *${ctx.prefix}timer Reunión 3m*`
      )
    }
    const durationMs = parseDurationMs(cleaned)
    if (!durationMs || durationMs < 1000) {
      throw new Error('Indica un tiempo válido. Ej: 25s, 3m, 1h 20m')
    }
    if (durationMs > MAX_MS) throw new Error('El tiempo máximo permitido es 7 días.')
    const message = stripDurations(cleaned)
    if (!message) throw new Error('Incluye un mensaje. Ej: *"Vamos a jugar" 10m*')

    const delay = formatMs(durationMs)
    await ctx.reply(`⏰ Listo: te aviso en *${delay}*.\n_${message}_`)
    setTimeout(() => {
      ctx.reply(`⏰ *Recordatorio:* ${message}`).catch(() => {})
    }, durationMs).unref?.()
    return `timer ${delay}`
  }
}
