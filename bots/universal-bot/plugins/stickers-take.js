import { addExif } from '../lib/sticker.js'
import { isAnimatedWebP, resolverMetaSticker, toWebp } from './stickers-sticker.js'

/**
 * Divide "nombre,autor" (la coma separa; sin coma solo hay nombre).
 * Los valores por defecto salen de la meta del usuario (.setmeta)
 * o de la configuración global del bot.
 */
export function splitNombreAutor(texto, defecto = {}) {
  const raw = String(texto || '').trim()
  if (!raw) return { name: String(defecto.packname || '').trim(), author: String(defecto.author || '').trim() }
  const coma = raw.indexOf(',')
  if (coma === -1) return { name: raw.slice(0, 60), author: String(defecto.author || '').trim() }
  return {
    name: raw.slice(0, coma).trim().slice(0, 60) || String(defecto.packname || '').trim(),
    author: raw.slice(coma + 1).trim().slice(0, 60) || String(defecto.author || '').trim()
  }
}

function esWebp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false
  return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const citado = m.quoted ? m.quoted : m
  const tipoMime = (citado.msg || citado).mimetype || citado.mediaType || ''

  if (!/image|video|webp|webm/.test(tipoMime) || typeof citado.download !== 'function') {
    return conn.reply(
      m.chat,
      `Responde a un *sticker* (o a una foto/video) con *${usedPrefix + command} nombre,autor* para cambiarle el nombre y el autor.\n\n> Ejemplo: ${usedPrefix + command} Mis stickers, Yo`,
      m
    )
  }

  const meta = resolverMetaSticker(m, conn)
  const { name, author } = splitNombreAutor(text, meta)
  if (!name) {
    return conn.reply(m.chat, `Necesito un nombre. Ejemplo: *${usedPrefix + command} Olas del mar, Yo*`, m)
  }

  try {
    const bufer = await citado.download()
    const webp = esWebp(bufer) ? bufer : await toWebp(bufer)
    const final = await addExif(webp, name, author)
    const animado = isAnimatedWebP(final)

    await conn.sendMessage(
      m.chat,
      { sticker: final, ...(animado ? { isAnimated: true } : {}) },
      { quoted: m }
    )
  } catch (error) {
    console.error(error)
    conn.reply(m.chat, '[❌] No se pudo cambiar el nombre del sticker.', m)
  }
}

handler.help = ['take <nombre,autor> • responde a un sticker, foto o video']
handler.tags = ['stickers']
handler.command = ['take', 'robar', 'rename', 'autor']

export default handler
