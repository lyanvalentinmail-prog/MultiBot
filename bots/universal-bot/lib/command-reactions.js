export const COMMAND_REACTIONS = Object.freeze({
  waiting: '🕘',
  success: '✅️',
  error: '⚠️',
  denied: '🚫',
  unknown: '❌️'
})

/** Las reacciones son informativas y nunca deben interrumpir un comando. */
export async function reactCommand(sock, message, emoji) {
  if (!sock?.sendMessage || !message?.chat || !message?.key || !emoji) return null
  try {
    return await sock.sendMessage(message.chat, { react: { text: emoji, key: message.key } })
  } catch (error) {
    sock.logger?.debug?.(`No se pudo enviar la reacción ${emoji}: ${error.message}`)
    return null
  }
}

export function hasCommandPrefix(text, prefix) {
  const value = String(text || '')
  if (!value) return false
  const candidates = Array.isArray(prefix) ? prefix : [prefix]
  return candidates.some(candidate => {
    if (candidate instanceof RegExp) {
      candidate.lastIndex = 0
      const matched = candidate.test(value)
      candidate.lastIndex = 0
      return matched
    }
    return typeof candidate === 'string' && candidate.length > 0 && value.startsWith(candidate)
  })
}
