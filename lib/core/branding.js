/**
 * Ayudas de branding para los comandos compartidos.
 *
 * Un mismo comando lo usan varios bots (TomiOka, Universal…), así que
 * el nombre y los emojis salen siempre de la config del bot que lo ejecuta.
 */

/** Emoji de marca por índice (0 = principal, 1 = secundario…). */
export function brandEmoji(ctx, index = 0, fallback = '💙') {
  return ctx?.config?.bot?.emojis?.[index] || fallback
}

/**
 * Nombre estable del bot (config.bot.id). Es el que usan los comandos
 * compartidos, las carpetas temporales y los nombres de archivo.
 */
export function botName(ctx, fallback = 'Bot') {
  return ctx?.config?.bot?.id || ctx?.config?.bot?.name || fallback
}

/** Nombre decorativo que se muestra en los mensajes (config.bot.name). */
export function displayName(ctx, fallback = 'Bot') {
  return ctx?.config?.bot?.name || ctx?.config?.bot?.id || fallback
}

/** Nombre del bot normalizado para nombres de archivo o packs. */
export function botSlug(ctx, fallback = 'bot') {
  return String(botName(ctx, fallback))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Prefijo identificativo del bot (para ids de pack). */
export function botPrefix(ctx, fallback = 'bot') {
  return botSlug(ctx, fallback).replace(/-/g, '_')
}
