let handler = async (m) => {
  if (!global.db.data.users[m.sender].genre)
    return conn.reply(m.chat, '[❗] No tienes un género establecido.', m, rcanal)

  delete global.db.data.users[m.sender].genre

  return conn.reply(m.chat, `✐ Tu género ha sido eliminado.`, m, rcanal)
}
handler.help = ['#delgenre\n→ Elimina tu género del perfil']
handler.tags = ['perfiles']
handler.command = ['delgenre']
export default {
  name: "delgenre",
  aliases: [],
  category: "perfiles",
  description: "#delgenre\\n→ Elimina tu género del perfil",
  usage: "#delgenre\\n→ Elimina tu género del perfil",
  examples: [],
  tags: ["perfiles"],
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}
