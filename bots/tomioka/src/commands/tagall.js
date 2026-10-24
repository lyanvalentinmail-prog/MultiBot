import {
  fetchParticipants,
  mentionOf,
  requireSenderAdmin
} from '../lib/groups.js'

export default {
  name: 'tagall',
  aliases: ['notificar', 'tag', 'todos'],
  category: 'grupos',
  description: 'Etiquetar a todos los del grupo.',
  usage: '.tagall mensaje (o responde a un mensaje)',
  examples: ['.tagall Reunión a las 8', '.tagall'],
  async run(ctx) {
    const { participants } = await fetchParticipants(ctx.sock, ctx.chatJid)
    requireSenderAdmin({ participants, senderJid: ctx.senderJid, isOwner: ctx.isOwner })

    const message = ctx.argsText.trim() || ctx.quoted?.text?.trim() || '¡Atención a todos!'
    const jids = participants.map((p) => String(p.id || p.jid || '')).filter(Boolean)
    if (!jids.length) throw new Error('El grupo no tiene participantes visibles.')

    const lines = jids.map((jid) => `▪️ ${mentionOf(jid)}`)
    await ctx.sendMention(`📢 *Aviso:*\n${message}\n\n${lines.join('\n')}`, jids)
    return `tagall ${jids.length}`
  }
}
