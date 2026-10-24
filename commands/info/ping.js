/**
 * Comando de ejemplo: comprueba que el bot está vivo.
 */
export default {
  name: 'ping',
  aliases: ['p', 'pong'],
  category: 'info',
  description: 'Comprueba que el bot está activo',
  usage: 'ping',
  examples: ['ping'],
  async run(ctx) {
    const { conn, m } = ctx
    const latency = Date.now() - m.messageTimestamp * 1000
    await conn.sendMessage(
      m.chat,
      { text: '🏓 *Pong!* Bot activo ✅\n> Latencia: ' + latency + 'ms' },
      { quoted: m }
    )
  }
}
