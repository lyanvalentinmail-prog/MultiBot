import {
  digitsOf,
  fetchParticipants,
  isAdmin,
  isParticipant,
  mentionOf,
  requireBotAdmin,
  requireSenderAdmin,
  resolveTargetJid
} from '../../lib/wa/groups.js'

export default {
  name: 'demote',
  aliases: ['degradar', 'quitaradmin'],
  category: 'grupos',
  description: 'Quitar admin del grupo.',
  usage: '.demote @usuario (o responde a su mensaje)',
  examples: ['.demote @usuario'],
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
    if (!isAdmin(participants, target)) throw new Error('Ni siquiera es admin.')

    await ctx.sock.groupParticipantsUpdate(ctx.chatJid, [target], 'demote')
    await ctx.sendMention(`📉 ${mentionOf(target)} ya no es admin del grupo.`, [target])
    return `demote ${digitsOf(target)}`
  }
}
