import { giftHaremCharacter } from '../../bots/universal-bot/lib/characters/index.js'

let handler = async (m, { conn, usedPrefix, args }) => {
  try {
    await giftHaremCharacter(m, conn, usedPrefix || '.', args || [])
  } catch (error) {
    console.error('char-darhr:', error)
    await conn.sendMessage(m.chat, {
      text: `*[❗] No se pudo regalar el personaje.*\n> ${error?.message || error}`,
      contextInfo: { ...(global.rcanal?.contextInfo || {}) },
    }, { quoted: m }).catch(() => {})
  }
}

handler.help = ['darhr @user <n°>']
handler.tags = ['rpg', 'gacha']
handler.command = ['darhr', 'darharem', 'regalarhr', 'givehr']
handler.group = true

export default {
  name: "darhr",
  aliases: ["darharem","regalarhr","givehr"],
  category: "rpg",
  description: "darhr @user <n°>",
  usage: "darhr @user <n°>",
  examples: [],
  tags: ["rpg","gacha"],
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}
