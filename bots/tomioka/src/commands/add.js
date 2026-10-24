import {
  digitsOf,
  fetchParticipants,
  isParticipant,
  mentionOf,
  requireBotAdmin,
  requireSenderAdmin,
  resolveTargetJid
} from '../lib/groups.js'

export default {
  name: 'add',
  aliases: ['agregar', 'addgroup'],
  category: 'grupos',
  description: 'Agregar un número al grupo.',
  usage: '.add 59899123456',
  examples: ['.add 59899123456'],
  async run(ctx) {
    const { participants } = await fetchParticipants(ctx.sock, ctx.chatJid)
    requireSenderAdmin({ participants, senderJid: ctx.senderJid, isOwner: ctx.isOwner })
    requireBotAdmin({ participants, botJid: ctx.botJid })

    const target = resolveTargetJid({
      mentions: ctx.mentionedJids,
      quotedParticipant: ctx.quotedParticipant,
      argsText: ctx.argsText
    })
    if (!target) throw new Error('Pasa el número con código de país. Ejemplo: *.add 59899123456*')
    if (isParticipant(participants, target)) throw new Error('Ese número ya está en el grupo.')

    const result = await ctx.sock.groupParticipantsUpdate(ctx.chatJid, [target], 'add').catch(() => null)
    const status = String(result?.[0]?.status ?? result?.[0] ?? '')
    if (!result || (status && status !== '200')) {
      throw new Error('WhatsApp no dejó agregar ese número (privacidad o número inválido).')
    }

    await ctx.sendMention(`➕ ${mentionOf(target)} fue agregado al grupo.`, [target])
    return `add ${digitsOf(target)}`
  }
}
