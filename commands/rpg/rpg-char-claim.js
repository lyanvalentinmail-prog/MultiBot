import { claimCharacter } from '../../bots/universal-bot/lib/characters/index.js'

let handler = async (m, { conn, usedPrefix }) => {
  try {
    await claimCharacter(m, conn, usedPrefix || '.')
  } catch (error) {
    console.error('char-claim:', error)
    await conn.sendMessage(m.chat, {
      text: `*[❗] No se pudo comprar.*\n> ${error?.message || error}`,
      contextInfo: { ...(global.rcanal?.contextInfo || {}) },
    }, { quoted: m }).catch(() => {})
  }
}

handler.help = ['claim', 'c', 'comprar']
handler.tags = ['rpg', 'gacha']
handler.command = ['claim', 'c', 'comprar', 'reclamar']
handler.group = true

export default {
  name: "claim",
  aliases: ["c","comprar","reclamar"],
  category: "rpg",
  description: "claim · c · comprar",
  usage: "claim",
  examples: [],
  tags: ["rpg","gacha"],
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}
