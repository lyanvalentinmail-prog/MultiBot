/**
 * Comando de ejemplo: muestra el menú del bot.
 */
export default {
  name: 'menu',
  aliases: ['help', 'h'],
  category: 'info',
  description: 'Muestra el menú de comandos',
  usage: 'menu',
  examples: ['menu'],
  async run(ctx) {
    const { conn, m, usedPrefix } = ctx
    const txt = `🤖 *${global.namebot}*

> Prefijo: ${usedPrefix}
> Comandos:
> ${usedPrefix}ping → Pong
> ${usedPrefix}menu → Este menú
> ${usedPrefix}owner → Info owner

_Plantilla MultiBot — los comandos viven en commands/ (carpeta única del repo)_
`
    await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
  }
}
