import {
  downloadMedia,
  getContent,
  getMediaContent,
  getMentionedJids,
  getQuoted,
  getText,
  resolveMediaTarget
} from '../../../lib/wa/message.js'
import { buildRegistry } from '../../../lib/commands.js'
import { jidToNumber, parseCommand, truncate } from '../../../lib/ai/text.js'
import { writeStickerMetadata } from '../../../lib/media/sticker.js'
import {
  finishLiveMessage,
  retireLiveMessages,
  sendLiveMessage
} from '../../../lib/wa/live-messages.js'
import { readMenuButtons, sendButtonsMessage } from '../../../lib/wa/interactive.js'
import { getUniversalConfig } from './shared-config.js'
import { getUniversalStore } from './shared-store.js'

let cachedPlugins = null
let cachedRegistry = null

/** Registro canónico derivado de los plugins ya cargados por main.js. */
export function getUniversalRegistry(plugins = globalThis.plugins || {}) {
  if (plugins === cachedPlugins && cachedRegistry) return cachedRegistry
  cachedPlugins = plugins
  cachedRegistry = buildRegistry(Object.values(plugins).filter(Boolean))
  return cachedRegistry
}

/** Menú de respaldo para los comandos canónicos; el menú propio sigue ganando. */
export const universalMenu = {
  buildMenu({ config, commands = new Map(), sender = {} }) {
    const unique = [...new Set(commands.values())].filter((command) => !command.hidden && !command.disabled)
    const categories = new Map()
    for (const command of unique) {
      const category = command.category || 'extras'
      if (!categories.has(category)) categories.set(category, [])
      categories.get(category).push(command)
    }
    const lines = [
      `✨ *${config.bot.name}*`,
      `🤖 ${config.bot.team}`,
      sender.label ? `👤 Hola, ${truncate(sender.label, 28)}` : null,
      `▸ Prefijo: ${config.prefixes[0]} · ${unique.length} comandos`,
      ''
    ]
    for (const [category, list] of categories) {
      lines.push(`╭─ *${category.toUpperCase()}*`)
      for (const command of list) lines.push(`│ ${config.prefixes[0]}${command.name}`)
      lines.push('╰──────────────')
    }
    return lines.filter((line) => line !== null).join('\n')
  },

  buildCommandHelp({ config, command }) {
    const prefix = config.prefixes[0]
    return [
      `✨ *${prefix}${command.name}*`,
      command.description || 'Sin descripción',
      `▸ Uso: ${command.usage || `${prefix}${command.name}`}`,
      command.aliases?.length ? `▸ Alias: ${command.aliases.map((alias) => `${prefix}${alias}`).join(' · ')}` : null,
      ...(command.examples || []).map((example) => `▸ ${example}`)
    ].filter(Boolean).join('\n')
  },

  buildButtonsText({ config, sender = {} }) {
    return [
      `✨ *${config.bot.name}*`,
      sender.label ? `Hola, ${truncate(sender.label, 28)}.` : null,
      'Toca un botón para abrir el menú o ver tu perfil.'
    ].filter(Boolean).join('\n')
  },

  buildButtonsFooter({ config }) {
    return `${config.bot.team} · MultiBot`
  }
}

/**
 * Superconjunto del contexto histórico de Universal y del contrato canónico.
 * Los helpers son propiedades propias para que sigan disponibles cuando el
 * dispatcher crea `{ ...baseCtx, command, args }` para cada plugin.
 */
export function createUniversalContext({ sock, msg, base = {}, text, logger, store } = {}) {
  const config = getUniversalConfig()
  const registry = getUniversalRegistry()
  const liveStore = store || getUniversalStore(logger || sock?.logger || console)
  const fullText = typeof text === 'string' ? text : getText(msg)
  const parsed = parseCommand(fullText, config.prefixes)
  const content = getContent(msg)
  const chatJid = msg?.key?.remoteJid || msg?.chat || base.m?.chat || ''
  const senderJid = base.m?.sender || msg?.sender || (base.isGroup ? msg?.key?.participant : chatJid) || ''
  const botJid = sock?.decodeJid?.(sock?.user?.id) || sock?.user?.jid || sock?.user?.id || ''
  const startedAt = Date.now()
  const mediaCache = new Map()

  const ctx = {
    ...base,
    sock,
    msg,
    message: msg,
    config,
    logger: logger || sock?.logger || console,
    store: liveStore,
    menu: universalMenu,
    menuButtons: readMenuButtons(config),
    commandList: registry.commandList,
    visibleCommands: registry.visibleCommands,
    commands: registry.commands,
    chatJid,
    fromMe: Boolean(msg?.key?.fromMe ?? base.m?.fromMe),
    isGroup: String(chatJid).endsWith('@g.us'),
    botJid,
    botNumber: jidToNumber(botJid),
    senderJid,
    senderNumber: jidToNumber(senderJid),
    pushName: msg?.pushName || base.m?.pushName || base.m?.name || '',
    isMod: Boolean(base.isMod),
    content,
    current: getMediaContent(content),
    quoted: getQuoted(msg),
    mentionedJids: getMentionedJids(msg),
    text: fullText,
    prefixes: config.prefixes,
    parsed,
    command: parsed?.command ?? null,
    args: parsed?.args ?? [],
    argsText: parsed?.argsText ?? '',
    prefix: parsed?.prefix ?? config.prefixes[0],
    startedAt,

    get latency() {
      return Date.now() - startedAt
    },
    get quotedParticipant() {
      return ctx.quoted?.participant || null
    },
    get mediaTarget() {
      return resolveMediaTarget(ctx)
    },
    get displayName() {
      return truncate(ctx.pushName || ctx.senderNumber || 'desconocido', 32)
    },

    decorate(message = {}) {
      if (config.behavior.forwardedStyle !== true) return message
      return {
        ...message,
        contextInfo: {
          ...(message.contextInfo || {}),
          forwardingScore: 999,
          isForwarded: true
        }
      }
    },

    async reply(value, options = {}) {
      return sock.sendMessage(chatJid, ctx.decorate({ text: String(value) }), {
        quoted: msg,
        ...options
      })
    },

    async send(value, options = {}) {
      return sock.sendMessage(chatJid, ctx.decorate({ text: String(value) }), options)
    },

    async sendMention(value, mentions = []) {
      return sock.sendMessage(chatJid, ctx.decorate({ text: String(value), mentions: [...mentions] }), {
        quoted: msg
      })
    },

    async sendButtons({ text: body, footer = '', buttons = null, layout = null } = {}) {
      const options = ctx.menuButtons
      return sendButtonsMessage(sock, {
        chatJid,
        text: body,
        footer,
        buttons: buttons || options.options,
        layout: layout || options.layout,
        quoted: msg,
        logger: ctx.logger
      })
    },

    async react(emoji) {
      try {
        return await sock.sendMessage(chatJid, { react: { text: emoji, key: msg.key } })
      } catch (error) {
        ctx.logger?.debug?.(`No se pudo reaccionar: ${error.message}`)
        return null
      }
    },

    async typing(mode = 'composing') {
      if (!config.behavior.sendTyping) return
      try {
        await sock.sendPresenceUpdate?.(mode, chatJid)
      } catch {
        // La presencia es decorativa; nunca debe impedir ejecutar el comando.
      }
    },

    requireMedia(allowedKinds, message = 'Responde a un sticker, imagen, GIF o video con este comando.') {
      const target = ctx.mediaTarget
      if (!target || (allowedKinds && !allowedKinds.includes(target.kind))) throw new Error(message)
      return target
    },

    async download(target = ctx.mediaTarget) {
      if (!target) throw new Error('No encontré ningún archivo multimedia en el mensaje.')
      const cacheKey = `${target.origin || 'current'}:${target.type}:${target.key?.id || ''}`
      if (mediaCache.has(cacheKey)) return mediaCache.get(cacheKey)
      const maxBytes = Math.max(1, config.stickers.maxInputMB || 30) * 1024 * 1024
      const buffer = await downloadMedia(
        { key: target.key || msg.key, message: target.message || msg.message },
        { sock, logger: ctx.logger, maxBytes }
      )
      mediaCache.set(cacheKey, buffer)
      return buffer
    },

    async sendSticker(buffer, options = {}) {
      const {
        packName = config.stickers.packName,
        packAuthor = config.stickers.packAuthor,
        emojis = [],
        withMetadata = true,
        quoted = true
      } = options
      let output = buffer
      if (withMetadata) {
        try {
          output = await writeStickerMetadata(buffer, { packName, packAuthor, emojis })
        } catch (error) {
          ctx.logger?.warn?.(`No se pudo escribir el EXIF del sticker: ${error.message}`)
        }
      }
      return sock.sendMessage(chatJid, ctx.decorate({ sticker: output }), quoted ? { quoted: msg } : undefined)
    },

    async sendImage(buffer, caption = '', options = {}) {
      return sock.sendMessage(chatJid, ctx.decorate({ image: buffer, caption, ...options }), { quoted: msg })
    },

    async sendVideo(buffer, caption = '', options = {}) {
      return sock.sendMessage(chatJid, ctx.decorate({ video: buffer, caption, ...options }), { quoted: msg })
    },

    async sendDocument(buffer, fileName, mimetype = 'application/octet-stream', caption = '') {
      return sock.sendMessage(
        chatJid,
        ctx.decorate({ document: buffer, fileName, mimetype, caption }),
        { quoted: msg }
      )
    },

    rememberLive(slot, sent, meta) {
      return liveStore.messages.remember(chatJid, slot, sent, meta) || []
    },
    sendLive(slot, value, options = {}) {
      return sendLiveMessage(ctx, slot, value, options)
    },
    retireLive(slot, value) {
      return retireLiveMessages(ctx, slot, value)
    },
    finishLive(slot, value) {
      return finishLiveMessage(ctx, slot, value)
    }
  }

  return ctx
}

export default createUniversalContext
