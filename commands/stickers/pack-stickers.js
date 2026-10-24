import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import fluent from 'fluent-ffmpeg'
import PackSessionStore from '../../bots/universal-bot/lib/pack-session.js'
import { buildWastickerZip, safeFileName } from '../../bots/universal-bot/lib/wasticker.js'
import { addExif } from '../../bots/universal-bot/lib/sticker.js'
import { resolverMetaSticker, toWebp } from './stickers-sticker.js'
import { splitNombreAutor } from './stickers-take.js'

const store = new PackSessionStore({ ttlMinutes: 10, maxStickers: 30 })

const DONE = new Set(['done', 'listo', 'fin', 'finish', 'terminar', 'zip'])
const CANCEL = new Set(['cancel', 'cancelar', 'salir', 'stop'])
const ADD = new Set(['add', 'agregar', 'añadir', 'anadir', '+'])
const STATUS = new Set(['status', 'estado', 'info', 'lista', 'list'])

const TIPOS_MEDIA = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage']
const MAX_BYTES = 20 * 1024 * 1024

function esWebp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false
  return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
}

/** Heurística: los WebP animados traen cuadros ANMF */
function esWebpAnimado(buffer) {
  if (!esWebp(buffer)) return false
  return buffer.includes(Buffer.from('ANMF'))
}

/** Ícono del pack (96x96 PNG) a partir del primer sticker */
async function makeTray(buffer) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pack-tray-'))
  const input = path.join(dir, 'in.webp')
  const output = path.join(dir, 'tray.png')
  try {
    await fs.promises.writeFile(input, buffer)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('FFmpeg tardó demasiado')), 60_000)
      fluent(input)
        .outputOptions(['-vframes 1', '-vf scale=96:96'])
        .save(output)
        .on('end', () => {
          clearTimeout(timer)
          resolve()
        })
        .on('error', (error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
    return await fs.promises.readFile(output)
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true })
  }
}

function statusMessage(session, prefix, command) {
  return [
    '⏳ *Pack en curso*',
    `▸ Nombre: *${session.name}*`,
    `▸ Autor: *${session.author}*`,
    `▸ Stickers: *${session.stickers.length}/${store.maxStickers}*`,
    'Envía *stickers*, *fotos* o *videos* (o responde con *.pack add*).',
    `✅ *${prefix}${command} done* para recibir el pack`,
    `💥 *${prefix}${command} cancel* para cancelar`
  ].join('\n')
}

/** Media citado o del propio mensaje (para `.pack` como pie de foto) */
function mediaDelMensaje(m) {
  const citado = m.quoted ? m.quoted : m
  const tipoMime = (citado.msg || citado).mimetype || citado.mediaType || ''
  if (!/image|video|webp|webm/.test(tipoMime)) return null
  if (typeof citado.download !== 'function') return null
  return { target: citado, id: citado.key?.id || citado.id || null }
}

async function addMediaToSession(conn, m, session, target, msgId) {
  if (msgId && session.lastAddedId === msgId) return null
  const buffer = await target.download()
  if (!buffer?.length) throw new Error('descarga vacía')
  if (buffer.length > MAX_BYTES) throw new Error('el archivo pesa más de 20 MB')

  const webp = esWebp(buffer) ? buffer : await toWebp(buffer)
  const final = await addExif(webp, session.name, session.author)
  const added = store.add(session, {
    buffer: final,
    emojis: [],
    animated: esWebpAnimado(final)
  })
  if (!added.ok) throw new Error('el pack ya está lleno (30 stickers)')
  if (msgId) session.lastAddedId = msgId
  return added.count
}

async function finishPack(conn, m, session, prefix, command) {
  if (!session) {
    return conn.reply(m.chat, `No hay ningún pack en curso. Inicia uno con *${prefix}${command} nombre,autor*.`, m)
  }
  if (!session.stickers.length) {
    return conn.reply(
      m.chat,
      `El pack *${session.name}* todavía está vacío: envía stickers, fotos o videos para agregarlo.`,
      m
    )
  }

  await conn.reply(m.chat, `⏳ Armando el pack *${session.name}* (${session.stickers.length} stickers)...`, m)

  let tray = null
  try {
    tray = await makeTray(session.stickers[0].buffer)
  } catch (error) {
    console.warn('[pack] No se pudo generar el ícono:', error?.message || error)
  }

  const packId = `pack${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`
  const zip = buildWastickerZip({
    stickers: session.stickers,
    tray,
    packId,
    name: session.name,
    publisher: session.author
  })
  store.finish(session)

  await conn.sendMessage(
    m.chat,
    {
      document: zip,
      fileName: `${safeFileName(session.name)}.wasticker`,
      mimetype: 'application/zip',
      caption: `📦 *${session.name}* by ${session.author}\n${session.stickers.length} stickers · impórtalo desde tu app de stickers favorita.`
    },
    { quoted: m }
  )
}

let handler = async (m, { conn, args, text, usedPrefix, command }) => {
  const first = String(args[0] || '').toLowerCase()
  const session = store.get(m.chat, m.sender)

  if (CANCEL.has(first)) {
    if (!session) return conn.reply(m.chat, 'No hay ningún pack en curso.', m)
    store.cancel(session)
    return conn.reply(m.chat, '💥 Pack cancelado. Los stickers en memoria fueron descartados.', m)
  }

  if (DONE.has(first)) {
    return finishPack(conn, m, session, usedPrefix, command)
  }

  if (STATUS.has(first)) {
    if (!session) return conn.reply(m.chat, 'No hay ningún pack en curso.', m)
    return conn.reply(m.chat, statusMessage(session, usedPrefix, command), m)
  }

  if (ADD.has(first)) {
    if (!session) {
      return conn.reply(m.chat, `Primero inicia un pack con *${usedPrefix}${command} nombre,autor*.`, m)
    }
    const found = mediaDelMensaje(m)
    if (!found) return conn.reply(m.chat, 'Responde a un sticker, foto o video para agregarlo al pack.', m)
    try {
      const count = await addMediaToSession(conn, m, session, found.target, found.id)
      if (count === null) return
      return conn.reply(
        m.chat,
        `✅ Sticker *${count}/${store.maxStickers}* agregada a *${session.name}*.` +
          (count >= store.maxStickers ? `\n✅ ¡Pack lleno! Envía *${usedPrefix}${command} done*.` : ''),
        m
      )
    } catch (error) {
      console.error(error)
      return conn.reply(m.chat, `❌ No se pudo agregar: ${error.message}`, m)
    }
  }

  const found = mediaDelMensaje(m)

  // ".pack" como pie de foto/video: usa el pack en curso y agrega esa foto
  if (session) {
    if (found) {
      try {
        const count = await addMediaToSession(conn, m, session, found.target, found.id)
        if (count === null) return
        return conn.reply(m.chat, `✅ Sticker *${count}/${store.maxStickers}* agregada a *${session.name}*.`, m)
      } catch (error) {
        console.error(error)
        return conn.reply(m.chat, `❌ No se pudo agregar: ${error.message}`, m)
      }
    }
    return conn.reply(
      m.chat,
      `⏳ Ya tienes el pack *${session.name}* en curso (${session.stickers.length}/${store.maxStickers}).\n` +
        `✅ *${usedPrefix}${command} done* para recibirlo · 💥 *${usedPrefix}${command} cancel* para descartarlo`,
      m
    )
  }

  const meta = resolverMetaSticker(m, conn)
  const { name, author } = splitNombreAutor(text, meta)
  if (!name) {
    return conn.reply(m.chat, `Ponle un nombre al pack. Ejemplo: *${usedPrefix}${command} Olas del mar, Yo*`, m)
  }
  if (name.length > 45) return conn.reply(m.chat, 'El nombre del pack es demasiado largo (máx. 45 caracteres).', m)

  const created = store.start({ chatJid: m.chat, senderJid: m.sender, name, author })
  await conn.reply(
    m.chat,
    [
      '👊 *Nuevo pack iniciado*',
      `▸ Nombre: *${name}*`,
      `▸ Autor: *${author}*`,
      'Envía *stickers*, *fotos* o *videos* para agregarlo.',
      `Máximo *${store.maxStickers}* stickers.`,
      `Termina con *${usedPrefix}${command} done* y recibirás el archivo *.wasticker*. 📦`,
      '_La sesión expira en 10 minutos de inactividad._'
    ].join('\n'),
    m
  )

  // Si el comando vino como pie de foto/video, esa imagen ya entra al pack
  if (found) {
    try {
      const count = await addMediaToSession(conn, m, created, found.target, found.id)
      if (count !== null) {
        await conn.reply(m.chat, `✅ Sticker *${count}/${store.maxStickers}* agregada a *${created.name}*.`, m)
      }
    } catch (error) {
      console.error(error)
      await conn.reply(m.chat, `❌ No se pudo agregar: ${error.message}`, m)
    }
  }
}

/**
 * Fotos, videos o stickers que llegan con un pack en curso se agregan solos.
 * El `lastAddedId` evita duplicar cuando el mensaje también pasó por `.pack`.
 */
handler.all = async function (m, { conn }) {
  try {
    if (!m || m.fromMe || m.key?.fromMe) return
    if (!m.sender || !m.chat) return
    if (!TIPOS_MEDIA.includes(m.mtype)) return
    if (m.mtype === 'documentMessage' && !/^(image|video)\//.test(m.msg?.mimetype || '')) return
    if (typeof m.download !== 'function') return

    const session = store.findByChat(m.chat, m.sender)
    if (!session) return

    const msgId = m.key?.id || null
    if (msgId && session.lastAddedId === msgId) return

    const count = await addMediaToSession(conn, m, session, m, msgId)
    if (count === null) return
    await conn.reply(
      m.chat,
      `✅ Sticker *${count}/${store.maxStickers}* agregada a *${session.name}*.` +
        (count >= store.maxStickers ? '\n✅ ¡Pack lleno! Envía *.pack done*.' : ''),
      m
    )
  } catch (error) {
    console.error('[pack] auto-add falló:', error?.message || error)
  }
}

handler.help = ['pack <nombre,autor> • envía fotos o stickers • pack done • pack cancel']
handler.tags = ['stickers']
handler.command = ['pack', 'packsticker', 'stickerpack']

export default {
  name: "pack",
  aliases: ["packsticker","stickerpack"],
  category: "stickers",
  description: "pack <nombre · autor> • envía fotos o stickers • pack done • pack cancel",
  usage: "pack <nombre",
  examples: [],
  tags: ["stickers"],
  all(ctx) {
    return handler.all.call(this, ctx.m, ctx)
  },
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}
