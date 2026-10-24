/**
 * Ayudas para los comandos de administración de grupos.
 * Sin dependencias externas.
 */

/** Dígitos de un JID/LID ("59899...:12@s.whatsapp.net" → "59899...") */
export function digitsOf(jid = '') {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')
}

export function isGroupJid(jid = '') {
  return String(jid || '').endsWith('@g.us')
}

/** ¿El participante es admin o superadmin? */
export function isParticipantAdmin(participant) {
  return participant?.admin === 'admin' || participant?.admin === 'superadmin'
}

/** JIDs de los admins del grupo */
export function adminJids(participants = []) {
  return (participants || []).filter(isParticipantAdmin).map((p) => String(p.id || p.jid || ''))
}

/** ¿Este JID es admin del grupo? (compara por dígitos: cubre @lid y @s.whatsapp.net) */
export function isAdmin(participants = [], jid = '') {
  const digits = digitsOf(jid)
  if (!digits) return false
  return (participants || []).some((p) => isParticipantAdmin(p) && digitsOf(p.id || p.jid) === digits)
}

/** ¿Este JID está en el grupo? */
export function isParticipant(participants = [], jid = '') {
  const digits = digitsOf(jid)
  if (!digits) return false
  return (participants || []).some((p) => digitsOf(p.id || p.jid) === digits)
}

/**
 * Participantes del grupo desde el socket.
 * @throws {Error} si no es un grupo o WhatsApp no entrega los datos
 */
export async function fetchParticipants(sock, chatJid) {
  if (!isGroupJid(chatJid)) throw new Error('Este comando solo funciona en grupos.')
  const metadata = await sock.groupMetadata(chatJid).catch(() => null)
  const participants = metadata?.participants || []
  if (!participants.length) throw new Error('No pude leer la lista del grupo. Intenta de nuevo.')
  return { metadata, participants }
}

/**
 * A quién va dirigido el comando: mención > mensaje citado > número en el texto.
 * @returns {string|null} JID del objetivo o null si no se indicó a nadie
 */
export function resolveTargetJid({ mentions = [], quotedParticipant = null, argsText = '' } = {}) {
  if (Array.isArray(mentions) && mentions[0]) return String(mentions[0])
  if (quotedParticipant) return String(quotedParticipant)
  const digits = String(argsText || '').replace(/\D/g, '')
  if (digits.length >= 7 && digits.length <= 15) return `${digits}@s.whatsapp.net`
  return null
}

/** Mención visible (@59899...) para los textos de respuesta */
export function mentionOf(jid = '') {
  return `@${digitsOf(jid)}`
}

/** Solo admins del grupo (o el dueño del bot) */
export function requireSenderAdmin({ participants = [], senderJid = '', isOwner = false } = {}) {
  if (isOwner) return
  if (!isAdmin(participants, senderJid)) {
    throw new Error('Solo los administradores pueden usar este comando.')
  }
}

/** El bot tiene que ser admin para cambiar el grupo */
export function requireBotAdmin({ participants = [], botJid = '' } = {}) {
  if (!isAdmin(participants, botJid)) {
    throw new Error('Necesito ser admin del grupo para eso.')
  }
}
