/**
 * Menú interactivo con botones (ButtonsMessage) — kit compartido por los bots.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ----------------------------
 * La lista interactiva (`listMessage`) no la enseña WhatsApp: el mensaje
 * llega al chat, pero sin botón ni secciones. Los botones de respuesta
 * rápida sí son un tipo nativo de WhatsApp (`buttonsMessage`) y se dibujan
 * bajo el mensaje:
 *
 *   - layout "horizontal" → una fila de botones (el tipo `buttonsMessage`).
 *   - layout "vertical"   → botones apilados (el tipo `templateMessage`).
 *
 * CÓMO SE GENERAN
 * ---------------
 * `@whiskeysockets/baileys` (el que usa el socket) no sabe construir un
 * `buttonsMessage`: su `generateWAMessageContent` solo contempla texto,
 * multimedia, polls… y descarta los botones. `@itsliaaa/baileys` sí los
 * construye y además trae el nodo `<biz>` que WhatsApp exige para que el
 * mensaje salga con los botones visibles.
 *
 * Por eso el mensaje se genera con el fork y se retransmite con el socket
 * (`relayMessage`) añadiendo ese nodo. Si algo falla (falta la dependencia,
 * error de red…) se cae de vuelta al texto plano: es preferible un menú sin
 * botones a un menú que no llega.
 */

import { getContent } from './message.js'

/** Diseños de botones soportados. */
export const BUTTON_LAYOUT = Object.freeze({
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical'
})

/** Opciones por defecto del menú: "Menu" y "Perfil". */
export const DEFAULT_MENU_BUTTONS = Object.freeze([
  Object.freeze({ id: 'menu', label: 'Menu' }),
  Object.freeze({ id: 'perfil', label: 'Perfil' })
])

/** Identificadores de los botones del menú (los que el bot entiende al tocarlos). */
export const MENU_BUTTON_IDS = Object.freeze({
  MENU: 'menu',
  PERFIL: 'perfil'
})

/* ── Carga perezosa del fork (@itsliaaa/baileys) ───────────────────────── */

let liaPromise = null
let bizPromise = null

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
 * Precarga el fork para que el primer `.menu` no pague el coste de importar
 * el paquete. Se llama al arrancar el bot. Si falla, el menú sigue
 * funcionando en modo texto.
 * @returns {Promise<boolean>} true si los interactivos están disponibles
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

/* ── Configuración ─────────────────────────────────────────────────────── */

/**
 * Normaliza los botones de una configuración (los ids y las etiquetas se
 * limpian: sin ids vacíos, sin etiquetas larguísimas).
 * @param {Array} buttons
 * @returns {Array<{id:string,label:string}>}
 */
export function normalizeButtons(buttons) {
  if (!Array.isArray(buttons)) return []
  const vistos = new Set()
  const out = []
  for (const button of buttons) {
    if (!button || typeof button !== 'object') continue
    const id = String(button.id ?? button.buttonId ?? '').trim()
    const label = String(button.label ?? button.text ?? button.buttonText ?? '').trim()
    if (!id || !label) continue
    const key = id.toLowerCase()
    if (vistos.has(key)) continue
    vistos.add(key)
    out.push({ id: key, label: label.slice(0, 40) })
  }
  return out
}

/**
 * Normaliza la configuración del menú con botones de cualquier bot.
 *
 * Acepta varias formas para no atar el kit a un solo esquema:
 *   - `{ enabled, layout, options }`  (forma canónica)
 *   - `{ enabled, layout, buttons }`  (alias)
 *   - `listMode`                      (config vieja: `menu.listMode`)
 *
 * @param {object} raw
 * @returns {{enabled:boolean, layout:string, options:Array<{id:string,label:string}>}}
 */
export function resolveMenuButtons(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const legacy = source.listMode
  const enabled =
    source.enabled === undefined
      ? legacy === undefined
        ? true
        : legacy !== false
      : source.enabled !== false
  const layout =
    String(source.layout || '').toLowerCase() === BUTTON_LAYOUT.VERTICAL
      ? BUTTON_LAYOUT.VERTICAL
      : BUTTON_LAYOUT.HORIZONTAL
  const options = normalizeButtons(source.options || source.buttons)
  return { enabled, layout, options: options.length ? options : [...DEFAULT_MENU_BUTTONS] }
}

/**
 * Lee la configuración del menú con botones desde la config de un bot.
 * Los bots con `config.json` la guardan en `config.menu.buttons`; el
 * universal la tiene en `global.menuBotones` / `global.menuBotonesLayout`.
 * @param {object} config config del bot
 * @param {object} [overrides] valores sueltos (enabled/layout/options)
 */
export function readMenuButtons(config = {}, overrides = {}) {
  const menu = config?.menu && typeof config.menu === 'object' ? config.menu : {}
  const base = menu.buttons && typeof menu.buttons === 'object' ? menu.buttons : {}
  // `listMode` es la llave vieja (activaba la lista): si el bot todavía la
  // tiene en su config y no trae `buttons.enabled`, manda ella.
  return resolveMenuButtons({ ...base, listMode: menu.listMode, ...overrides })
}

/* ── Lectura de la respuesta a un botón ────────────────────────────────── */

/**
 * Lee la selección del usuario cuando toca un botón.
 *
 * - `buttonsResponseMessage`   → botones horizontales (`buttonsMessage`)
 * - `templateButtonReplyMessage` → botones apilados (`templateMessage`)
 * - `interactiveResponseMessage` → flujos nativos
 *
 * @param {object} message mensaje recibido
 * @returns {{id:string, label:string}|null}
 */
export function readButtonSelection(message) {
  const content = getContent(message)
  if (!content) return null

  const botones = content.buttonsResponseMessage
  if (botones?.selectedButtonId) {
    return {
      id: String(botones.selectedButtonId).trim().toLowerCase(),
      label: String(botones.selectedDisplayText || '').trim()
    }
  }

  const plantilla = content.templateButtonReplyMessage
  if (plantilla?.selectedId) {
    return {
      id: String(plantilla.selectedId).trim().toLowerCase(),
      label: String(plantilla.selectedDisplayText || '').trim()
    }
  }

  const flujo = content.interactiveResponseMessage?.nativeFlowResponseMessage
  if (flujo?.paramsJson) {
    try {
      const datos = JSON.parse(flujo.paramsJson)
      if (datos?.id) {
        return { id: String(datos.id).trim().toLowerCase(), label: String(datos.title || '').trim() }
      }
    } catch {
      /* paramsJson ilegible: no hay selección */
    }
  }

  return null
}

/* ── Envío ─────────────────────────────────────────────────────────────── */

/** Texto plano con las opciones (respaldo cuando no hay botones). */
function buildFallbackText(text, footer, buttons) {
  const lista = buttons.map((button) => `▸ ${button.label}`).join('\n')
  return [text, lista].filter(Boolean).join('\n\n')
}

/** El `contextInfo` va dentro del mensaje interactivo (según su tipo). */
function applyContextInfo(inner, contextInfo) {
  if (!contextInfo || !inner) return
  const tipo = ['buttonsMessage', 'templateMessage', 'interactiveMessage'].find((key) => inner[key])
  if (!tipo) return
  inner[tipo] = inner[tipo] || {}
  inner[tipo].contextInfo = { ...(inner[tipo].contextInfo || {}), ...contextInfo }
}

/**
 * Construye el contenido de un mensaje con botones para `@itsliaaa/baileys`.
 *
 *   - horizontal → `{ buttons }`      → `buttonsMessage` (una fila)
 *   - vertical   → `{ templateButtons }` → `templateMessage` (apilados)
 *
 * @param {object} options
 * @param {string} [options.text]    texto del mensaje
 * @param {string} [options.footer]  pie del mensaje
 * @param {Array}  [options.buttons] botones [{ id, label }]
 * @param {string} [options.layout]  'horizontal' | 'vertical'
 * @returns {object} contenido listo para `generateWAMessage` / `sendMessageLia`
 */
export function buildButtonsContent({ text = '', footer = '', buttons = [], layout = BUTTON_LAYOUT.HORIZONTAL } = {}) {
  const opciones = normalizeButtons(buttons)
  const vertical = String(layout).toLowerCase() === BUTTON_LAYOUT.VERTICAL
  const contenido = vertical
    ? { text, templateButtons: opciones.map((b) => ({ id: b.id, text: b.label })) }
    : { text, buttons: opciones.map((b) => ({ id: b.id, text: b.label })) }
  if (footer) contenido.footer = footer
  return contenido
}

/**
 * Envía un mensaje con botones (respuesta rápida).
 *
 * @param {object} sock socket de Baileys
 * @param {object} options
 * @param {string} options.chatJid      chat de destino
 * @param {string} [options.text]       texto del mensaje
 * @param {string} [options.footer]     pie del mensaje
 * @param {Array}  [options.buttons]    botones [{ id, label }]
 * @param {string} [options.layout]     'horizontal' | 'vertical'
 * @param {object} [options.quoted]     mensaje citado
 * @param {object} [options.contextInfo] contexto extra (p. ej. "reenviado")
 * @param {object} [options.logger]     logger
 * @returns {Promise<object|null>} el mensaje enviado (o null si no había botones)
 */
export async function sendButtonsMessage(sock, options = {}) {
  const {
    chatJid,
    text = '',
    footer = '',
    buttons = [],
    layout = BUTTON_LAYOUT.HORIZONTAL,
    quoted = null,
    contextInfo = null,
    logger = null
  } = options

  const opciones = normalizeButtons(buttons)
  if (!opciones.length) return null

  // Sin socket con relay no hay botones posibles: texto plano.
  if (typeof sock?.relayMessage !== 'function') {
    logger?.warn?.('El socket no puede retransmitir mensajes: el menú se manda como texto.')
    return sock.sendMessage(
      chatJid,
      { text: buildFallbackText(text, footer, opciones) },
      quoted ? { quoted } : undefined
    )
  }

  let lia
  let biz
  try {
    ;[lia, biz] = await Promise.all([loadLia(), loadBizUtils()])
  } catch (error) {
    logger?.warn?.(`Interactivos no disponibles (${error.message}): el menú se manda como texto.`)
    return sock.sendMessage(
      chatJid,
      { text: buildFallbackText(text, footer, opciones) },
      quoted ? { quoted } : undefined
    )
  }

  const { generateWAMessage, normalizeMessageContent, shouldIncludeBizBinaryNode } = lia

  // `buttons` → buttonsMessage (horizontal).
  // `templateButtons` → templateMessage (vertical, botones apilados).
  const contenido = buildButtonsContent({ text, footer, buttons: opciones, layout })

  try {
    const msg = await generateWAMessage(
      chatJid,
      contenido,
      {
        userJid: sock.user?.id || sock.user?.jid,
        upload: sock.waUploadToServer,
        ...(quoted ? { quoted } : {})
      }
    )

    const inner = normalizeMessageContent(msg.message) || msg.message
    const relayOptions = { messageId: msg.key.id }

    // Contexto extra (modo "mensajes reenviados").
    applyContextInfo(inner, contextInfo)

    // WhatsApp solo muestra los botones si el mensaje lleva su nodo <biz>.
    if (shouldIncludeBizBinaryNode(inner)) {
      relayOptions.additionalNodes = [biz.getBizBinaryNode(inner)]
    }

    await sock.relayMessage(chatJid, msg.message, relayOptions)
    return msg
  } catch (error) {
    logger?.warn?.(`No se pudieron enviar los botones (${error.message}): el menú se manda como texto.`)
    return sock.sendMessage(
      chatJid,
      { text: buildFallbackText(text, footer, opciones) },
      quoted ? { quoted } : undefined
    )
  }
}
