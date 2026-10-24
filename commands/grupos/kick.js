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
  name: 'kick',
  aliases: ['ban', 'expulsar'],
  category: 'grupos',
  description: 'Expulsar a alguien del grupo.',
  usage: '.kick @usuario (o responde a su mensaje)',
  examples: ['.kick @usuario', '.kick 59899123456'],
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
    if (digitsOf(target) === ctx.botNumber) throw new Error('No puedo expulsarme a mí mismo.')
    if (!isParticipant(participants, target)) throw new Error('Ese número no está en el grupo.')
    if (isAdmin(participants, target) && !ctx.isOwner) {
      throw new Error('No puedo expulsar a otro admin.')
    }

    await ctx.sock.groupParticipantsUpdate(ctx.chatJid, [target], 'remove')
    await ctx.sendMention(`👢 ${mentionOf(target)} fue expulsado del grupo.`, [target])
    return `kick ${digitsOf(target)}`
  }
}
