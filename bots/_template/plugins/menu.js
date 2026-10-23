let handler = async (m, { conn, usedPrefix }) => {
  const txt = `🤖 *${global.namebot}*

> Prefijo: ${usedPrefix}
> Comandos:
> ${usedPrefix}ping → Pong
> ${usedPrefix}menu → Este menú
> ${usedPrefix}owner → Info owner

_Plantilla MultiBot — añade tus plugins en plugins/_
`
  await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
}
handler.command = ['menu', 'help', 'h']
export default handler
