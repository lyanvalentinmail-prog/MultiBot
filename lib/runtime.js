/**
 * Runtime compartido por el kit común (lib/) y los comandos (commands/).
 *
 * El kit no puede importar el config.js de un bot concreto (eso ataría los
 * comandos a un solo bot), así que cada bot inyecta aquí su raíz y su
 * marca (branding) al arrancar. Todos los valores se leen en tiempo de
 * llamada, así que da igual cuándo se configuren.
 */

/** Estado del runtime: lo rellena el bot con setRoot()/setBrand(). */
const state = {
  root: process.cwd(),
  brand: {
    name: 'Bot',
    displayName: 'Bot',
    slug: 'bot',
    team: 'Bot',
    emojis: ['⭐'],
    packName: 'Bot',
    packAuthor: 'Bot',
    stickerEmojis: ['⭐'],
    tmpEnv: 'BOT_TMPDIR',
    tmpPrefix: 'bot-',
    accent: '✨'
  }
}

/** Define la raíz del bot (carpeta del proyecto del bot). */
export function setRoot(dir) {
  if (dir) state.root = dir
}

/** Devuelve la raíz del bot. */
export function getRoot() {
  return state.root
}

/** Actualiza la marca del bot (nombre, emojis, pack, carpetas temporales…). */
export function setBrand(patch = {}) {
  Object.assign(state.brand, patch)
}

/** Devuelve la marca actual. */
export function getBrand() {
  return state.brand
}

/** Acceso directo a la marca (mismo objeto, se actualiza en vivo). */
export const brand = state.brand
