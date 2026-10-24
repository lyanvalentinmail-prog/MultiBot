/**
 * Perfil del usuario — comando compartido por todos los bots.
 *
 * Funciona con los dos formatos de contexto que hay en el repo:
 *   - bots con kit propio (tomioka, izuku): `ctx.reply`, `ctx.pushName`…
 *   - universal-bot: `ctx.m`, `ctx.conn`, `ctx.usedPrefix`.
 */

/** Juntá los datos del usuario según el formato de contexto. */
function datosUsuario(ctx) {
  const m = ctx.m || {}
  const nombre = ctx.pushName || m.pushName || m.name || 'Usuario'
  const jid = ctx.senderJid || m.sender || ''
  const numero = ctx.senderNumber || String(jid).split('@')[0].replace(/\D/g, '')
  const owner = ctx.isOwner === true || m.fromMe === true
  return { nombre, jid, numero, owner }
}

/** Texto del perfil (mismo estilo en todos los bots). */
export function buildProfileText(ctx) {
  const { nombre, jid, numero, owner } = datosUsuario(ctx)
  const bot = ctx.config?.bot || {}
  const lineas = [
    '',
    '╭─╮  𓍯  𝙿𝙴𝚁𝙵𝙸𝙻  𝙳𝙴  𝙴𝚂𝙴𝙸𝙾  𓍯  ',
    `│  𓂃 ࣪ ִֶָ☾.  𝙽𝙾𝙼𝙱𝚁𝙴:  ${nombre}`,
    `│  𓂃 ࣪ ִֶָ☾.  𝙸𝙳:  ${jid || numero}`,
    `│  𓂃 ࣪ ִֶָ☾.  𝙴𝚂𝙿𝙰𝙲𝙸𝙰𝙻:  ${owner ? 'Sí' : 'No'}`,
    bot.name ? `│  𓂃 ࣪ ִֶָ☾.  𝙱𝙾𝚃:  ${bot.name}` : null,
    '╰─╯'
  ]
  return lineas.filter((linea) => linea !== null).join('\n').trim()
}

export default {
  name: 'perfil',
  aliases: ['profile'],
  category: 'perfiles',
  description: 'Ver tu perfil.',
  usage: '.perfil',
  examples: ['.perfil'],
  async run(ctx) {
    const texto = buildProfileText(ctx)

    if (typeof ctx.reply === 'function') {
      await ctx.reply(texto)
      return 'perfil'
    }

    // Contexto del universal-bot (m + conn).
    const m = ctx.m
    const conn = ctx.conn
    if (!m || !conn) throw new Error('No se pudo leer el perfil en este chat.')
    await conn.sendMessage(
      m.chat,
      { text: texto, contextInfo: { ...(global.rcanal?.contextInfo || {}) } },
      { quoted: m }
    )
    return 'perfil'
  }
}
