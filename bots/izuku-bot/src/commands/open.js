import { fetchParticipants, requireBotAdmin, requireSenderAdmin } from '../lib/groups.js'

export default {
  name: 'open',
  aliases: ['abrir', 'grupo-abierto'],
  category: 'grupos',
  description: 'Abrir el grupo para que todos escriban.',
  usage: '.open',
  examples: ['.open'],
  async run(ctx) {
    const { participants } = await fetchParticipants(ctx.sock, ctx.chatJid)
    requireSenderAdmin({ participants, senderJid: ctx.senderJid, isOwner: ctx.isOwner })
    requireBotAdmin({ participants, botJid: ctx.botJid })

    await ctx.sock.groupSettingUpdate(ctx.chatJid, 'not_announcement')
    await ctx.reply('🔓 *Grupo abierto:* todos pueden escribir.')
    return 'open'
  }
}
