import { randomBytes } from 'crypto'

const JID_FANTASMA = '0@s.whatsapp.net'

function digitosDe(jid = '') {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')
}

/**
 * Cita estilo "estado": en vez de citar el mensaje del usuario, la respuesta
 * cita una tarjeta de contacto (como los estados de WhatsApp). Es el mismo
 * formato que usa el bot principal (universal-bot).
 * Sin dependencias externas.
 */
export function buildEstadoQuote({ name = '', waid = '' } = {}) {
  const nombre = String(name || '').trim().slice(0, 40) || 'Usuario'
  const digitos = digitosDe(waid) || '0'
  const id = '3EB0' + randomBytes(8).toString('hex').toUpperCase()

  const vcard =
    'BEGIN:VCARD\n' +
    'VERSION:3.0\n' +
    `N:;${nombre};;;\n` +
    `FN:${nombre}\n` +
    `TEL;type=CELL;type=VOICE;waid=${digitos}:+${digitos}\n` +
    'END:VCARD'

  return {
    key: {
      remoteJid: 'status@broadcast',
      fromMe: false,
      id,
      participant: JID_FANTASMA
    },
    message: {
      contactMessage: { displayName: nombre, vcard }
    },
    participant: JID_FANTASMA
  }
}
