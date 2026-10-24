import {
  digitsOf,
  fetchParticipants,
  isAdmin,
  isParticipant,
  mentionOf,
  requireBotAdmin,
  requireSenderAdmin,
  resolveTargetJid
} from '../lib/groups.js'

export default {
  name: 'promote',
  aliases: ['promover', 'daradmin'],
  category: 'grupos',
  description: 'Dar admin del grupo.',
  usage: '.promote @usuario (o responde a su mensaje)',
  examples: ['.promote @usuario'],
  async run(ctx) {
    const { participants } = await fetchParticipants(ctx.sock, ctx.chatJid)
    requireSenderAdmin({ participants, senderJid: ctx.senderJid, isOwner: ctx.isOwner })
    requireBotAdmin({ participants, botJid: ctx.botJid })

    const target = resolveTargetJid({
      mentions: ctx.mentionedJids,
      quotedParticipant: ctx.quotedParticipant,
      argsText: ctx.argsText
    })
    if (!target) {
      throw new Error('Indica a quién: menciona, responde a su mensaje o pasa su número.')
    }
    if (!isParticipant(participants, target)) throw new Error('Ese número no está en el grupo.')
    if (isAdmin(participants, target)) throw new Error('Ya es admin del grupo.')

    await ctx.sock.groupParticipantsUpdate(ctx.chatJid, [target], 'promote')
    await ctx.sendMention(`👑 ${mentionOf(target)} ahora es admin del grupo.`, [target])
    return `promote ${digitsOf(target)}`
  }
}
