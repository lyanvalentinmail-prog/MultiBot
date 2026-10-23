let handler = async (m, { conn }) => {
  await conn.sendMessage(m.chat, { text: '🏓 *Pong!* Bot activo ✅\n> Latencia: ' + (Date.now() - m.messageTimestamp * 1000) + 'ms' }, { quoted: m })
}
handler.command = ['ping', 'p', 'pong']
handler.help = ['ping']
handler.tags = ['info']
export default handler
