import { fetchParticipants, requireBotAdmin, requireSenderAdmin } from '../lib/groups.js'

export default {
  name: 'close',
  aliases: ['cerrar', 'grupo-cerrado'],
  category: 'grupos',
  description: 'Cerrar el grupo (solo escriben los admins).',
  usage: '.close',
  examples: ['.close'],
  async run(ctx) {
    const { participants } = await fetchParticipants(ctx.sock, ctx.chatJid)
    requireSenderAdmin({ participants, senderJid: ctx.senderJid, isOwner: ctx.isOwner })
    requireBotAdmin({ participants, botJid: ctx.botJid })

    await ctx.sock.groupSettingUpdate(ctx.chatJid, 'announcement')
    await ctx.reply('🔒 *Grupo cerrado:* solo los admins pueden escribir.')
    return 'close'
  }
}
