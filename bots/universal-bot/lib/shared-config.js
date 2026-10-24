import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setBrand, setRoot } from '../../../lib/runtime.js'

export const UNIVERSAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const digits = (value) => String(value || '').replace(/\D/g, '')
const numbersFrom = (value) => {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return [...new Set(list.map((entry) => digits(Array.isArray(entry) ? entry[0] : entry)).filter(Boolean))]
}

/**
 * Configuración del kit compartido a partir de los ajustes vivos de Universal.
 * No crea un segundo archivo de configuración: respeta config.js, el panel y
 * los cambios hechos desde termux.sh.
 */
export function getUniversalConfig() {
  const name = globalThis.namebot || globalThis.packname || 'UNIVERSAL BOT'
  const author = globalThis.author || 'MultiBot'
  const data = path.join(UNIVERSAL_ROOT, 'data')
  const sessionDir = path.resolve(UNIVERSAL_ROOT, globalThis.sessions || 'sessions')
  const prefixes = ['.']
  const emojis = ['✨', '🤖', '⚡', '💫']

  const config = {
    bot: {
      id: 'UniversalBot',
      name,
      team: author,
      emojis,
      aiEmojis: { chatgpt: '🤖', deepseek: '⚡', gemini: '✨' },
      prefix: prefixes[0],
      prefixes,
      version: '1.0',
      status: 'online',
      year: String(new Date().getFullYear())
    },
    prefixes,
    owner: {
      numbers: numbersFrom(globalThis.owner),
      mods: numbersFrom(globalThis.mods),
      names: {},
      allowFromMe: true
    },
    sessionDir,
    tmpDir: path.join(data, 'tmp'),
    paths: {
      root: UNIVERSAL_ROOT,
      data,
      session: sessionDir,
      tmp: path.join(data, 'tmp')
    },
    stickers: {
      packName: globalThis.packname || name,
      packAuthor: author,
      defaultEmojis: emojis.slice(0, 3),
      size: 512,
      fps: 15,
      maxAnimatedSeconds: 6.5,
      quality: 82,
      lossless: false,
      maxStaticKB: 100,
      maxAnimatedKB: 500,
      maxInputMB: 30
    },
    pack: {
      maxStickers: 30,
      sessionMinutes: 10,
      defaultName: `${name} Pack`,
      defaultAuthor: author,
      traySize: 96,
      acceptPhotos: true,
      acceptVideos: true,
      autoDoneAfter: 0
    },
    emojimix: {
      enabled: true,
      metadataUrl: 'https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/main/app/metadata.json',
      cacheFile: path.join(data, 'emojimix-index.json'),
      timeoutMs: 600000
    },
    search: {
      enabled: true,
      provider: 'stickerly',
      baseUrl: 'http://api.sticker.ly',
      customBaseUrl: '',
      userAgent: 'androidapp.stickerly/1.17.3 (Redmi 7; U; Android 29; es-ES; es;)',
      referer: 'https://sticker.ly/',
      timeoutMs: 20000,
      maxResults: 3,
      sessionMinutes: 10,
      packStickerLimit: 30,
      maxBytes: 8388608,
      language: 'es'
    },
    ai: {
      enabled: true,
      baseUrl: 'https://opencode.ai/inference/v1',
      openaiBaseUrl: 'https://opencode.ai/inference/openai/v1',
      anthropicBaseUrl: 'https://opencode.ai/inference/anthropic/v1',
      googleBaseUrl: 'https://opencode.ai/inference/google/v1beta',
      apiKey: process.env.OPENCODE_API_KEY || '',
      userAgent: 'opencode/1.18.30',
      timeoutMs: 90000,
      maxTokens: 1024,
      temperature: 0.7,
      maxInputChars: 6000,
      maxChars: 3500,
      retriesPerModel: 2,
      freeTierFallback: true,
      models: {
        gemini: ['gemini-3-flash', 'gemini-3.5-flash-lite'],
        chatgpt: ['gpt-5.6-terra', 'gpt-5-nano'],
        deepseek: ['deepseek-v4.1-flash', 'deepseek-v4.1-flash-free', 'deepseek-v4-pro']
      },
      freeModels: [
        'deepseek-v4.1-flash-free',
        'glm-5.3-flash-free',
        'big-pickle',
        'beam-free',
        'mimo-v2.6-flash-free',
        'nemotron-3.5-lightning-free',
        'minimax-m3.1-flash-free',
        'flint-40b-free'
      ]
    },
    performance: {
      stickerCache: true,
      stickerCacheEntries: 24,
      stickerCacheMB: 32,
      warmUp: true
    },
    behavior: {
      cooldownMs: 0,
      reactToCommands: false,
      sendTyping: true,
      markOnline: true,
      respondInGroups: true,
      requirePrefixInDM: true,
      replyUnknownCommand: false,
      commandsEnabled: globalThis.comandosEnabled !== false,
      publicMode: globalThis.modoPublico !== false,
      forwardedStyle: globalThis.mensajesReenviados === true,
      estadoQuote: false
    },
    menu: {
      image: globalThis.botBanner || '',
      imageCacheMinutes: 720,
      imageTimeoutMs: 25000,
      sendAsCaption: true,
      buttons: {
        enabled: globalThis.menuBotones !== false,
        layout: globalThis.menuBotonesLayout === 'vertical' ? 'vertical' : 'horizontal',
        options: [
          { id: 'menu', label: 'Menu' },
          { id: 'perfil', label: 'Perfil' }
        ]
      },
      showDescriptions: false,
      showUser: true,
      phrases: [],
      categories: []
    },
    logging: { level: 'info', baileys: 'silent' }
  }

  setRoot(UNIVERSAL_ROOT)
  setBrand({
    name: config.bot.id,
    displayName: name,
    team: author,
    emojis,
    packName: config.stickers.packName,
    packAuthor: author,
    stickerEmojis: config.stickers.defaultEmojis,
    slug: 'universal-bot',
    tmpEnv: 'UNIVERSAL_BOT_TMPDIR',
    tmpPrefix: 'universal-bot-',
    accent: emojis[0]
  })
  return config
}

export default getUniversalConfig
