/**
 * salida.js — Ajustes de apariencia de los mensajes que ENVÍA el bot.
 *
 * - `sinMarcasReenviado(contenido)`: clona el contenido y le quita las marcas
 *   de "reenviado" (isForwarded, forwardingScore, forwardedNewsletterMessageInfo)
 *   sin mutar el objeto original (algunos plugins reutilizan global.rcanal).
 * - `quiereReenviado()`: true salvo que la terminal lo haya apagado con
 *   `global.mensajesReenviados = false` (termux.sh → Personalizar bot).
 */

export function quiereReenviado() {
  return global.mensajesReenviados !== false
}

export function sinMarcasReenviado(contenido) {
  if (!contenido || typeof contenido !== 'object') return contenido
  const ctx = contenido.contextInfo
  if (!ctx || typeof ctx !== 'object') return contenido
  if (!('isForwarded' in ctx) && !('forwardingScore' in ctx) && !('forwardedNewsletterMessageInfo' in ctx)) {
    return contenido
  }
  const limpio = { ...ctx }
  delete limpio.isForwarded
  delete limpio.forwardingScore
  delete limpio.forwardedNewsletterMessageInfo
  return { ...contenido, contextInfo: limpio }
}

/**
 * Aplica la preferencia de reenviado al contenido saliente.
 * No toca nada cuando el ajuste está activado (comportamiento actual).
 */
export function aplicarPreferenciaReenviado(contenido) {
  if (quiereReenviado()) return contenido
  return sinMarcasReenviado(contenido)
}
