import fetch from 'node-fetch'
import { addExif } from '../lib/sticker.js'
import { toWebp, isAnimatedWebP } from './stickers-sticker.js'
import { construirUrlDelirius, construirUrlTenor, normalizarResultados } from '../lib/sticker-search.js'

async function buscarEn(url) {
  const respuesta = await fetch(url)
  if (!respuesta.ok) return []
  const json = await respuesta.json().catch(() => null)
  return normalizarResultados(json)
}

const handler = async (m, { conn, text, args, usedPrefix }) => {
  const consulta = (text || (args || []).join(' ') || '').trim()
  if (!consulta) {
    return conn.reply(m.chat, `Uso: ${usedPrefix || '.'}bsticker <término>\n> Ejemplo: ${usedPrefix || '.'}bsticker gato`, m, rcanal)
  }

  try {
    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {})

    // Fuente 1: Delirius · Fuente 2 (respaldo): Tenor público.
    let urls = []
    try {
      urls = await buscarEn(construirUrlDelirius(consulta))
    } catch (errorDelirius) {
      console.error('[bsticker] Delirius falló:', errorDelirius?.message || errorDelirius)
    }
    if (!urls.length) {
      try {
        urls = await buscarEn(construirUrlTenor(consulta))
      } catch (errorTenor) {
        console.error('[bsticker] Tenor falló:', errorTenor?.message || errorTenor)
      }
    }
    if (!urls.length) {
      return conn.reply(m.chat, `[❗] No encontré stickers para: *${consulta}*\n> Prueba con otra palabra.`, m, rcanal)
    }

    let nombre = m.pushName || 'Usuario'
    try {
      nombre = (await conn.getName(m.sender)) || nombre
    } catch {}
    const autor = `@${nombre}\n${global.namebot || 'MultiBot'}`
    let enviados = 0

    for (const urlMedia of urls.slice(0, 3)) {
      try {
        const r = await fetch(urlMedia)
        if (!r.ok) continue
        const bufer = Buffer.from(await r.arrayBuffer())
        if (!bufer.length) continue

        const webp = await toWebp(bufer)
        const stickerFinal = await addExif(webp, consulta.slice(0, 40), autor)
        const animado = isAnimatedWebP(stickerFinal)

        await conn.sendMessage(
          m.chat,
          {
            sticker: stickerFinal,
            ...(animado ? { isAnimated: true } : {}),
            contextInfo: rcanal?.contextInfo
          },
          { quoted: m }
        )
        enviados++
      } catch (errorItem) {
        console.error('[bsticker] no se pudo convertir un resultado:', errorItem?.message || errorItem)
      }
    }

    if (!enviados) {
      return conn.reply(m.chat, '[❌] Encontré resultados pero no se pudieron convertir a sticker.', m, rcanal)
    }
  } catch (error) {
    console.error('Error en bsticker:', error)
    return conn.reply(m.chat, '[❌] Error al buscar stickers.', m, rcanal)
  }
}

handler.help = ['bsticker <término>']
handler.tags = ['stickers']
handler.command = ['search-sticker', 'bsticker', 'sticker-search']

export default handler
