import { isInteractiveBaileysEnabled } from '../../bots/universal-bot/lib/baileys-dual.js'
import { MENU_BUTTON_IDS, buildButtonsContent, resolveMenuButtons } from '../../lib/wa/interactive.js'
import {
  buildFullMenuText,
  buildInteractiveMenuContent,
  buildCategoryInteractiveContent,
  buildMenuCategories,
  buildMenuHeader,
  buildCategoryResponse,
  buildNativeFlowPickerContent,
  extractMenuSelectionId,
  findMenuCategoryFromMessage,
  getMenuCategoryId,
  resolveMenuContext,
} from '../../bots/universal-bot/lib/menu-categories.js'

/** chatId -> { key, at } del último menú interactivo enviado/editado */
const menusActivos = new Map()
const TTL_MENU_MS = 30 * 60 * 1000

function recordarMenuActivo(chatId, key) {
  if (!chatId || !key?.id) return
  menusActivos.set(chatId, { key, at: Date.now() })
}

function obtenerMenuActivo(chatId) {
  const entry = menusActivos.get(chatId)
  if (!entry?.key?.id) return null
  if (Date.now() - entry.at > TTL_MENU_MS) {
    menusActivos.delete(chatId)
    return null
  }
  return entry.key
}

function obtenerContextInfoSeleccion(m) {
  return (
    m?.msg?.contextInfo ||
    m?.message?.interactiveResponseMessage?.contextInfo ||
    m?.message?.listResponseMessage?.contextInfo ||
    m?.message?.buttonsResponseMessage?.contextInfo ||
    m?.message?.templateButtonReplyMessage?.contextInfo ||
    null
  )
}

/** Clave del mensaje del menú (foto + botón) para reemplazarlo. */
function resolverClaveMenuAnterior(m) {
  const guardado = obtenerMenuActivo(m.chat)
  const ctx = obtenerContextInfoSeleccion(m)
  const stanzaId = ctx?.stanzaId || m?.quoted?.id

  if (guardado?.id && (!stanzaId || guardado.id === stanzaId)) {
    return guardado
  }

  if (stanzaId) {
    return {
      remoteJid: guardado?.remoteJid || m.chat,
      fromMe: true,
      id: stanzaId,
      ...(guardado?.participant ? { participant: guardado.participant } : {}),
    }
  }

  return guardado
}

/**
 * WhatsApp no actualiza bien la edición de mensajes con imagen + nativeFlow
 * (a menudo "acepta" el edit y no cambia nada en el chat).
 * Por eso: enviar el menú nuevo y borrar el anterior → un solo mensaje visible.
 */
async function reemplazarMenuInteractivo(conn, m, contenido) {
  const claveAnterior = resolverClaveMenuAnterior(m)
  const enviado = await conn.sendMessageLia(
    m.chat,
    contenido,
    claveAnterior ? {} : { quoted: m },
  )

  if (enviado?.key) recordarMenuActivo(m.chat, enviado.key)

  if (claveAnterior?.id && claveAnterior.id !== enviado?.key?.id) {
    try {
      await conn.sendMessage(m.chat, { delete: claveAnterior })
    } catch (errorBorrar) {
      console.warn('[menú] No se pudo borrar el menú anterior:', errorBorrar?.message || errorBorrar)
    }
  }

  return enviado
}

async function resolverImagenMenu(conn, imgPrincipal) {
  try {
    const tipo = await conn.getFile(imgPrincipal, true)
    const { res, data: archivo, filename: rutaArchivo, mime } = tipo
    if ((res && res.status !== 200) || !archivo || archivo.length <= 65536) {
      return { image: { url: imgPrincipal } }
    }
    return { image: { url: rutaArchivo }, mimetype: mime || 'image/jpeg' }
  } catch {
    return { image: { url: imgPrincipal } }
  }
}

async function enviarMenuInteractivo(conn, m, contexto, categorias, encabezado) {
  const medios = await resolverImagenMenu(conn, contexto.mainImg)
  const contenido = buildInteractiveMenuContent(contexto, categorias, encabezado, medios, m.sender)
  const enviado = await conn.sendMessageLia(m.chat, contenido, { quoted: m })
  if (enviado?.key) recordarMenuActivo(m.chat, enviado.key)
  return enviado
}

async function enviarRespuestaCategoria(conn, m, contexto, categorias, categoria) {
  const leyenda = buildCategoryResponse(categoria, contexto, { interactive: isInteractiveBaileysEnabled() })

  if (!isInteractiveBaileysEnabled()) {
    await conn.sendFile(m.chat, categoria.img, 'menu-cat.jpg', leyenda, m, null, {
      contextInfo: {
        ...rcanal.contextInfo,
        mentionedJid: [m.sender],
      },
    })
    return
  }

  try {
    const medios = await resolverImagenMenu(conn, categoria.img)
    const contenido = buildCategoryInteractiveContent(contexto, categorias, leyenda, medios, m.sender)
    await reemplazarMenuInteractivo(conn, m, contenido)
  } catch (errorInteractivo) {
    console.error('Categoría interactiva falló:', errorInteractivo)
    await conn.sendFile(m.chat, categoria.img, 'menu-cat.jpg', leyenda, m, null, {
      contextInfo: {
        ...rcanal.contextInfo,
        mentionedJid: [m.sender],
      },
    })
    try {
      await conn.sendMessageLia(
        m.chat,
        buildNativeFlowPickerContent(contexto, categorias),
        { quoted: m },
      )
    } catch (errorSelector) {
      console.error('Selector categorías (fallback) falló:', errorSelector)
    }
  }
}

/**
 * Menú con botones (Menu / Perfil).
 *
 * Los botones son un `buttonsMessage` nativo de WhatsApp: una fila de
 * respuestas rápidas que el usuario toca. El interruptor
 * `global.menuBotones` lo apaga y `global.menuBotonesLayout` decide si
 * van en una fila (horizontal) o apilados (vertical).
 *
 * @returns {Promise<boolean>} true si el menú se mandó con botones
 */
async function enviarMenuBotones(conn, m, contexto) {
  const { enabled, layout, options } = resolveMenuButtons({
    enabled: global.menuBotones,
    layout: global.menuBotonesLayout
  })
  if (!enabled) return false

  // Si el mensaje ES el toque a un botón, no se vuelve a pedir el menú.
  if (['buttonsResponseMessage', 'templateButtonReplyMessage'].includes(m.mtype)) return false

  const texto = [
    '𓂃 ࣪ ִֶָ☾. 𝙼𝙴𝙽𝚄',
    '',
    'Toca un botón para elegir: el menú de comandos o tu perfil.',
  ].join('\n')

  const contenido = buildButtonsContent({
    text: texto,
    footer: contexto.nombreBot,
    buttons: options,
    layout
  })

  try {
    await conn.sendMessageLia(m.chat, contenido, { quoted: m })
    return true
  } catch (errorBotones) {
    console.error('Menú con botones falló:', errorBotones?.message || errorBotones)
    return false
  }
}

/**
 * Abre el comando de perfil del bot (el botón "Perfil").
 * @returns {Promise<boolean>} true si se ejecutó
 */
async function ejecutarComandoPerfil(m, data) {
  const plugins = global.plugins || {}
  const plugin = Object.values(plugins).find((item) =>
    (item?.command || []).some(
      (cmd) => typeof cmd === 'string' && ['perfil', 'profile'].includes(cmd.toLowerCase())
    )
  )
  const run = plugin?.handler?.run || plugin?.run
  if (typeof run !== 'function') return false

  const conn = data.conn
  await run.call(conn, {
    ...data,
    m,
    conn,
    command: 'perfil',
    args: [],
    text: '',
    usedPrefix: data.usedPrefix || '.'
  })
  return true
}

const handler = async (m, { conn, usedPrefix }) => {
  try {
    const contexto = await resolveMenuContext(m, conn, usedPrefix)
    const categorias = buildMenuCategories(contexto)
    const encabezado = buildMenuHeader(m, contexto)

    // Terminal → Personalizar bot → "Menú de botones" (global.menuBotones).
    if (await enviarMenuBotones(conn, m, contexto)) return

    if (!isInteractiveBaileysEnabled()) {
      const texto = buildFullMenuText(m, contexto, categorias)
      await conn.sendFile(m.chat, contexto.mainImg, 'thumbnail.jpg', texto, m, null, {
        contextInfo: {
          ...rcanal.contextInfo,
          mentionedJid: [m.sender],
        },
      })
      return
    }

    try {
      await enviarMenuInteractivo(conn, m, contexto, categorias, encabezado)
    } catch (errorInteractivo) {
      console.error('Menú interactivo (imagen+botón) falló:', errorInteractivo)

      await conn.sendFile(m.chat, contexto.mainImg, 'thumbnail.jpg', encabezado, m, null, {
        contextInfo: {
          ...rcanal.contextInfo,
          mentionedJid: [m.sender],
        },
      })

      try {
        await conn.sendMessageLia(
          m.chat,
          buildNativeFlowPickerContent(contexto, categorias),
          { quoted: m },
        )
      } catch (errorSelector) {
        // La lista de WhatsApp no se muestra (no es un tipo nativo para
        // estas cuentas): se cae al menú completo en texto.
        console.error('Selector nativeFlow falló:', errorSelector)
        await conn.sendMessage(m.chat, {
          text: buildFullMenuText(m, contexto, categorias),
          contextInfo: {
            ...rcanal.contextInfo,
            mentionedJid: [m.sender],
          },
        }, { quoted: m })
      }
    }
  } catch (error) {
    console.error('Error en menú:', error)
    conn.sendMessage(m.chat, {
      text: 'Hubo un error al mostrar el menú.',
      contextInfo: {
        ...rcanal.contextInfo,
      },
    }, { quoted: m })
    throw error
  }
}

/**
 * Botones del menú (Menu / Perfil): el toque llega como un mensaje aparte.
 *
 *   - "Menu"   → el menú completo (categorías), no el lanzador de botones.
 *   - "Perfil" → el comando de perfil del bot.
 *
 * @returns {Promise<boolean>} true si el toque se atendió
 */
async function manejarBotonMenu(m, data) {
  if (!['buttonsResponseMessage', 'templateButtonReplyMessage'].includes(m.mtype)) return false

  const id = String(m.text || '').trim().toLowerCase()
  if (id !== MENU_BUTTON_IDS.MENU && id !== MENU_BUTTON_IDS.PERFIL) return false

  const { conn, usedPrefix } = data

  if (id === MENU_BUTTON_IDS.PERFIL) {
    const ejecutado = await ejecutarComandoPerfil(m, data)
    if (ejecutado) m.commandExecuted = true
    return ejecutado
  }

  const contexto = await resolveMenuContext(m, conn, usedPrefix)
  const categorias = buildMenuCategories(contexto)
  const encabezado = buildMenuHeader(m, contexto)

  if (isInteractiveBaileysEnabled()) {
    await enviarMenuInteractivo(conn, m, contexto, categorias, encabezado)
  } else {
    await conn.sendFile(m.chat, contexto.mainImg, 'thumbnail.jpg', buildFullMenuText(m, contexto, categorias), m, null, {
      contextInfo: {
        ...rcanal.contextInfo,
        mentionedJid: [m.sender],
      },
    })
  }

  m.commandExecuted = true
  return true
}

async function manejarSeleccionCategoriaMenu(m, { conn, usedPrefix }) {

  const idFila = extractMenuSelectionId(m)
  const esRespuestaInteractiva = [
    'listResponseMessage',
    'interactiveResponseMessage',
    'buttonsResponseMessage',
  ].includes(m.mtype)

  if (!idFila && !esRespuestaInteractiva) return false
  if (!idFila && esRespuestaInteractiva) {
    const etiqueta = [m?.msg?.title, m?.text].filter(Boolean).join(' ')
    if (!etiqueta) return false
  } else if (!getMenuCategoryId(idFila)) {
    return false
  }

  const contexto = await resolveMenuContext(m, conn, usedPrefix)
  const categorias = buildMenuCategories(contexto)
  const categoria = findMenuCategoryFromMessage(m, categorias)
  if (!categoria) return false

  await enviarRespuestaCategoria(conn, m, contexto, categorias, categoria)

  m.commandExecuted = true
  return true
}

handler.all = async function (m, data) {
  try {
    if (await manejarBotonMenu(m, data)) return
    await manejarSeleccionCategoriaMenu(m, data)
  } catch (error) {
    console.error('Error en selección de menú:', error)
  }
}

handler.command = ['menu', 'help', 'menú']
export default {
  name: "menu",
  aliases: ["help","menú"],
  category: "info",
  description: "Comando menu",
  usage: "",
  examples: [],
  all(ctx) {
    return handler.all.call(this, ctx.m, ctx)
  },
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}
