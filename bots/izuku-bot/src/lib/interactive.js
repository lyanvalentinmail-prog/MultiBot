/**
 * Mensajes interactivos: listas con botón y secciones tocables.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ----------------------------
 * `@whiskeysockets/baileys` (la versión que usa este bot) NO sabe construir
 * un `listMessage`. Su `generateWAMessageContent` solo contempla los tipos
 * habituales de WhatsApp (texto, imagen, vídeo, audio, sticker, polls…),
 * así que un
 *
 *     sock.sendMessage(jid, { text, footer, buttonText, sections })
 *
 * entra en la rama de "text" y **descarta el botón y las secciones**: a
 * WhatsApp solo llega el texto plano. El menú se "envía", pero la lista
 * interactiva nunca aparece.
 *
 * LA SOLUCIÓN
 * ------------
 * Es la misma que ya usa universal-bot en `lib/baileys-dual.js`: generar el
 * mensaje con `@itsliaaa/baileys` (que sí soporta `sections`) y
 * retransmitirlo con el nodo `<biz>` que WhatsApp exige para mostrar botones
 * y listas. Sin ese nodo el mensaje sale pero sin botón.
 *
 * Si algo falla (dependencia ausente, error de red…) se cae de vuelta al
 * texto plano: es preferible un menú sin botón a un menú que no llega.
 */

/** Carga perezosa de @itsliaaa/baileys (solo hace falta si hay listas) */
let liaPromise = null

function loadLia() {
  if (!liaPromise) {
    liaPromise = import('@itsliaaa/baileys').catch((error) => {
      liaPromise = null
      throw error
    })
  }
  return liaPromise
}

/** `getBizBinaryNode` vive en un archivo interno del paquete */
let bizPromise = null

function loadBizUtils() {
  if (!bizPromise) {
    bizPromise = import('@itsliaaa/baileys/lib/WABinary/generic-utils.js').catch((error) => {
      bizPromise = null
      throw error
    })
  }
  return bizPromise
}

/**
 * Precarga `@itsliaaa/baileys` para que el primer `.help` no pague el coste
 * de importar el paquete (unos ~300 ms). Se llama al arrancar el bot.
 * Si falla, el menú sigue funcionando en modo texto.
 */
export async function warmUpInteractive(logger = null) {
  try {
    await Promise.all([loadLia(), loadBizUtils()])
    return true
  } catch (error) {
    logger?.warn?.(`Interactivos no disponibles: ${error.message}. El menú se mandó como texto.`)
    return false
  }
}

/**
 * Envía una lista interactiva (descripción + botón + secciones tocables).
 *
 * Al tocar una fila, WhatsApp devuelve el `rowId` como `listResponseMessage`;
 * `getText()` de `lib/message.js` lo lee, así que el comando se ejecuta
 * igual que si el usuario lo escribiera.
 *
 * @param {object} options
 * @param {object} options.sock       socket de Baileys
 * @param {string} options.chatJid    chat de destino
 * @param {string} options.text       descripción de la lista
 * @param {string} [options.footer]   pie de la lista
 * @param {string} [options.buttonText] texto del botón
 * @param {string} [options.title]    título de la lista
 * @param {Array}  options.sections   secciones con sus filas
 * @param {object} [options.quoted]   mensaje citado
 * @param {object} [options.contextInfo] contexto extra (p. ej. "reenviado")
 * @param {object} [options.logger]   logger
 * @returns {Promise<object>} el mensaje enviado
 */
export async function sendListMessage(sock, { chatJid, text = '', footer = '', buttonText = '', title = '', sections = [], quoted = null, contextInfo = null, logger = null } = {}) {
  const usable = (Array.isArray(sections) ? sections : []).filter(
    (section) => Array.isArray(section?.rows) && section.rows.length > 0
  )

  if (!usable.length) {
    logger?.warn?.('La lista no tiene filas: el menú se manda como texto.')
    return sock.sendMessage(chatJid, { text }, quoted ? { quoted } : undefined)
  }

  // Sin socket con relay no hay lista interactiva posible: texto plano.
  if (typeof sock?.relayMessage !== 'function') {
    logger?.warn?.('El socket no puede retransmitir mensajes: el menú se manda como texto.')
    return sock.sendMessage(chatJid, { text }, quoted ? { quoted } : undefined)
  }

  let lia
  let biz
  try {
    ;[lia, biz] = await Promise.all([loadLia(), loadBizUtils()])
  } catch (error) {
    logger?.warn?.(`Interactivos no disponibles (${error.message}): el menú se manda como texto.`)
    return sock.sendMessage(chatJid, { text }, quoted ? { quoted } : undefined)
  }

  const { generateWAMessage, normalizeMessageContent, shouldIncludeBizBinaryNode } = lia

  try {
    const msg = await generateWAMessage(
      chatJid,
      { text, footer, buttonText, title, sections: usable },
      {
        userJid: sock.user?.id || sock.user?.jid,
        upload: sock.waUploadToServer,
        ...(quoted ? { quoted } : {})
      }
    )

    const inner = normalizeMessageContent(msg.message) || msg.message
    const relayOptions = { messageId: msg.key.id }

    // Contexto extra (modo "mensajes reenviados"): va dentro del listMessage.
    if (contextInfo && inner?.listMessage) {
      inner.listMessage.contextInfo = { ...(inner.listMessage.contextInfo || {}), ...contextInfo }
    }

    // WhatsApp solo muestra el botón si el mensaje lleva su nodo <biz>.
    if (shouldIncludeBizBinaryNode(inner)) {
      relayOptions.additionalNodes = [biz.getBizBinaryNode(inner)]
    }

    await sock.relayMessage(chatJid, msg.message, relayOptions)
    return msg
  } catch (error) {
    logger?.warn?.(`No se pudo enviar la lista (${error.message}): el menú se manda como texto.`)
    return sock.sendMessage(chatJid, { text }, quoted ? { quoted } : undefined)
  }
}
