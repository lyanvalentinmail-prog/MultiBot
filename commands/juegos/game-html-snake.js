import { sendHtmlWhatsApp } from '../../bots/universal-bot/lib/wa-html.js'
import { htmlSnake } from '../../bots/universal-bot/lib/html-games/snake.js'

let handler = async (m, { conn, usedPrefix }) => {
  try {
    const nombre = m.pushName || m.name || m.sender?.split('@')[0] || 'Jugador'
    const quoted = m.fakeObj || m.vM || {
      key: m.key,
      message: m.message,
      participant: m.sender
    }
    await sendHtmlWhatsApp(
      conn,
      m.chat,
      { html: htmlSnake({ playerName: nombre }) },
      { quoted }
    )
  } catch (e) {
    console.error('[snake html]', e?.message || e)
    return conn.reply(m.chat, `[❌] No se pudo enviar Snake.\n> ${usedPrefix}snake`, m)
  }
}

handler.help = ['snake - Juego Snake en el chat']
handler.tags = ['game', 'fun']
handler.command = ['snake', 'serpiente', 'htmlsnake']

export default {
  name: "snake",
  aliases: ["serpiente","htmlsnake"],
  category: "juegos",
  description: "snake - Juego Snake en el chat",
  usage: "snake - Juego Snake en el chat",
  examples: [],
  tags: ["game","fun"],
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}
