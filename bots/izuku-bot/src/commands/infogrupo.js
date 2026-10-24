import { adminJids, fetchParticipants, mentionOf } from '../lib/groups.js'
import { truncate } from '../lib/text.js'

export default {
  name: 'infogrupo',
  aliases: ['infogp', 'groupinfo'],
  category: 'grupos',
  description: 'Ver la info del grupo.',
  usage: '.infogrupo',
  examples: ['.infogrupo'],
  async run(ctx) {
    const { metadata, participants } = await fetchParticipants(ctx.sock, ctx.chatJid)

    const created = metadata.creation
      ? new Date(metadata.creation * 1000).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
      : '—'
    const lines = [
      `👥 *${metadata.subject || 'Grupo'}*`,
      `▸ Miembros: *${participants.length}* (admins: *${adminJids(participants).length}*)`,
      `▸ Creado: ${created}`,
      metadata.owner ? `▸ Creador: ${mentionOf(metadata.owner)}` : null,
      metadata.desc ? `▸ Descripción: ${truncate(String(metadata.desc).trim(), 200)}` : null
    ]
    await ctx.reply(lines.filter((line) => line !== null).join('\n'))
    return `infogrupo ${participants.length}`
  }
}
