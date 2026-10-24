/**
 * Comando de ejemplo: muestra el menú del bot.
 *
 * Es la plantilla de cómo usar el menú con botones (ButtonsMessage):
 * los botones son un tipo nativo de WhatsApp y el kit compartido los
 * manda con `sendButtonsMessage` (que usa @itsliaaa/baileys + el nodo
 * <biz> que WhatsApp exige para mostrarlos).
 */
import { resolveMenuButtons, sendButtonsMessage } from '../../lib/wa/interactive.js'

export default {
  name: 'menu',
  aliases: ['help', 'h'],
  category: 'info',
  description: 'Muestra el menú de comandos',
  usage: 'menu',
  examples: ['menu'],
  async run(ctx) {
    const { conn, m, usedPrefix } = ctx
    const txt = `🤖 *${global.namebot}*\n\n> Prefijo: ${usedPrefix}\n> Comandos:\n> ${usedPrefix}ping → Pong\n> ${usedPrefix}menu → Este menú\n> ${usedPrefix}owner → Info owner\n\n_Plantilla MultiBot — los comandos viven en commands/ (carpeta única del repo)_\n`

    // Menú con botones (Menu / Perfil). El interruptor global.menuBotones
    // lo apaga y global.menuBotonesLayout elige el diseño.
    const { enabled, layout, options } = resolveMenuButtons({
      enabled: global.menuBotones,
      layout: global.menuBotonesLayout
    })

    if (enabled) {
      // sendButtonsMessage cae al texto plano si el bot no puede mandar
      // botones (falta la dependencia o el socket no retransmite).
      const enviado = await sendButtonsMessage(conn, {
        chatJid: m.chat,
        text: txt,
        footer: global.namebot || '',
        buttons: options,
        layout,
        quoted: m
      })
      if (enviado) return
    }

    await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
  }
}
