process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason || '')
  if (msg.includes('sharp') || msg.includes('android-arm64')) {
    console.error('[sharp] rechazo controlado (imagen):', msg.split('\n')[0])
    return
  }
  console.error('unhandledRejection', reason)
})

import { PROJECT_TMP, cleanupTmpFiles, startTmpCleanupInterval } from './lib/tmp-cleanup.js'
import './config-loader.js'
import './lib/bot-uptime.js'
import { createRequire } from 'module'
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import * as ws from 'ws'
const { CONNECTING } = ws
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, watch, mkdirSync, rmSync } from 'fs'
import yargs from 'yargs'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import { format } from 'util'
import pino from 'pino'
import { Boom } from '@hapi/boom'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import { initViewOnceAntiListener } from './lib/viewOnce.js'
import { Low, JSONFile } from 'lowdb'
import lodash from 'lodash' 
import readline from 'readline'
import NodeCache from 'node-cache'
import qrcode from 'qrcode-terminal'
import { enforceTermuxOnly, isAuthorizedWebRuntime } from './lib/termux-guard.js'

const webRuntime = isAuthorizedWebRuntime()
const runtimeLoginMethod = process.env.MULTIBOT_LOGIN_METHOD === 'pairing-code' ? 'code' : 'qr'
enforceTermuxOnly()


const { proto } = (await import('@whiskeysockets/baileys')).default
const {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} = await import('@whiskeysockets/baileys')

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true))
};
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}

global.ensureTmpDir = function() {
  return PROJECT_TMP
}

global.API = (name, path = '/', query = {}, apikeyqueryname) =>
  (name in global.APIs ? global.APIs[name] : name) +
  path +
  (query || apikeyqueryname
    ? '?' +
      new URLSearchParams(
        Object.entries({
          ...query,
          ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}),
        })
      )
    : '')

global.timestamp = { start: new Date() }

const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp(
  '^[' +
    (opts['prefix'] || '‎z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') +
    ']'
)

global.db = new Low(new JSONFile(`storage/databases/database.json`))

global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ)
    return new Promise((resolve) =>
      setInterval(async function () {
        if (!global.db.READ) {
          clearInterval(this)
          resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
        }
      }, 1 * 1000)
    )
  if (global.db.data !== null) return
  global.db.READ = true
  await global.db.read().catch(console.error)
  global.db.READ = null
  const normalizeModeMap = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    botGroups: {},
    modoSub: {},
    antiImg: {},
    antiVer: {},
    antiPalabra: global.db.data?.antiPalabra || {},
    bienvenidas: {},
    publicaciones: {},
    ...(global.db.data || {}),
    alquiler: global.db.data?.alquiler || {},
    alquilerNotify: global.db.data?.alquilerNotify || {},
    modoDescargas: normalizeModeMap(global.db.data?.modoDescargas),
    modoIA: normalizeModeMap(global.db.data?.modoIA),
    modoIlegal: normalizeModeMap(global.db.data?.modoIlegal),
    modoHuman: normalizeModeMap(global.db.data?.modoHuman),
    modoSad: normalizeModeMap(global.db.data?.modoSad),
    modoPsico: normalizeModeMap(global.db.data?.modoPsico),
    modoCustom: normalizeModeMap(global.db.data?.modoCustom),
    modoCustomCfg: global.db.data?.modoCustomCfg && typeof global.db.data.modoCustomCfg === 'object' && !Array.isArray(global.db.data.modoCustomCfg)
      ? global.db.data.modoCustomCfg
      : {},
    modoSub: global.db.data?.modoSub && typeof global.db.data.modoSub === 'object' && !Array.isArray(global.db.data.modoSub)
      ? global.db.data.modoSub
      : {},
    stickerBan: global.db.data?.stickerBan && typeof global.db.data.stickerBan === 'object' && !Array.isArray(global.db.data.stickerBan)
      ? global.db.data.stickerBan
      : {},
  }
  global.db.chain = lodash.chain(global.db.data) 
}

global.authFile = `sessions`
const { state, saveCreds } = await useMultiFileAuthState(global.authFile)

const { version } = await fetchLatestBaileysVersion()

const rl = webRuntime ? null : readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver))

const logger = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
}).child({ class: 'client' })
logger.level = 'fatal'

const connectionOptions = {
  version: version,
  logger,
  printQRInTerminal: false,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),
  },
  browser: Browsers.ubuntu('Chrome'),
  markOnlineOnclientect: true,
  generateHighQualityLinkPreview: true,
  syncFullHistory: true,
  retryRequestDelayMs: 10,
  transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
  maxMsgRetryCount: 15,
  appStateMacVerification: {
    patch: false,
    snapshot: false,
  },
  getMessage: async (key) => {
    const msg = global.conn?.loadMessage?.(key.id)
    return msg?.message || ''
  },
}

global.conn = makeWASocket(connectionOptions)
/** Alias vivo del socket principal (se actualiza en reloadHandler). */
let conn = global.conn
const pendingConnectionUpdates = []
let connectionHandlersReady = false
const qrListeners = new WeakSet()
let latestQrPayload = ''
let termuxQrSelected = false

function emitRuntimeEvent(type, value = undefined) {
  if (!webRuntime) return
  const event = value === undefined ? { type } : { type, value }
  try { process.stdout.write(`MULTIBOT_RUNTIME_EVENT:${JSON.stringify(event)}\n`) } catch {}
}

function attachRuntimeQrListener(sock) {
  if (!sock?.ev || qrListeners.has(sock)) return
  qrListeners.add(sock)
  sock.ev.on('connection.update', ({ qr, connection }) => {
    if (qr) {
      latestQrPayload = qr
      if (webRuntime && runtimeLoginMethod === 'qr') emitRuntimeEvent('qr', qr)
      else if (!webRuntime && termuxQrSelected) qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') latestQrPayload = ''
  })
}

attachRuntimeQrListener(conn)
const bufferEarlyConnectionUpdate = (update) => {
  if (!connectionHandlersReady && pendingConnectionUpdates.length < 50) pendingConnectionUpdates.push(update)
}
conn.ev.on('connection.update', bufferEarlyConnectionUpdate)

global.mainBotJid = null

async function waitForWebSocketOpen(sock, timeoutMs = 20000) {
  if (sock?.ws?.readyState === ws.OPEN) return
  const socket = sock?.ws
  if (!socket?.once) throw new Error('No se pudo esperar la apertura de la conexión de WhatsApp.')
  await new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      clearTimeout(timer)
      socket.off?.('open', onOpen)
      socket.off?.('error', onError)
      sock.ev.off?.('connection.update', onUpdate)
    }
    const finish = (error = null) => {
      if (settled) return
      settled = true
      cleanup()
      error ? reject(error) : resolve()
    }
    const onOpen = () => finish()
    const onError = (error) => finish(error || new Error('Falló la conexión de WhatsApp.'))
    const onUpdate = ({ connection } = {}) => {
      if (connection === 'close') finish(new Error('WhatsApp cerró la conexión antes de generar el código.'))
    }
    const timer = setTimeout(() => finish(new Error('Tiempo agotado esperando la conexión de WhatsApp.')), timeoutMs)
    timer.unref?.()
    socket.once('open', onOpen)
    socket.once('error', onError)
    sock.ev.on('connection.update', onUpdate)
    if (socket.readyState === ws.OPEN) finish()
  })
}

function normalizePairingPhone(raw) {
  let phoneNumber = String(raw || '').replace(/\D/g, '').replace(/^0+/, '')

  // México: WhatsApp usa 521. Si ya trae 521, no volver a insertar el 1.
  if (phoneNumber.startsWith('521') && phoneNumber.length >= 12 && phoneNumber.length <= 13) {
    // ok
  } else if (phoneNumber.startsWith('52') && !phoneNumber.startsWith('521') && phoneNumber.length === 12) {
    phoneNumber = `521${phoneNumber.slice(2)}`
  }
  return phoneNumber
}

let lastPairingRequestAt = 0
let pairingAttempts = 0

/**
 * Solicita un Pairing Code desde el runtime web. Se vuelve a llamar cuando
 * Baileys recrea el socket (por ejemplo tras restartRequired), porque el código
 * anterior deja de ser válido y el panel debe mostrar uno nuevo.
 */
async function requestWebPairingCode(sock, { force = false } = {}) {
  if (!webRuntime || runtimeLoginMethod !== 'code') return false
  if (!sock || sock.authState?.creds?.registered) return false
  if (sock.__multibotPairingRequested) return false
  if (pairingAttempts >= 8) return false
  if (!force && Date.now() - lastPairingRequestAt < 15000) return false

  const phoneNumber = normalizePairingPhone(process.env.MULTIBOT_LOGIN_PHONE || '')
  if (phoneNumber.length < 8 || phoneNumber.length > 15) {
    emitRuntimeEvent('pairing-error', 'El número ingresado para Pairing Code no es válido.')
    return false
  }
  if (typeof sock.requestPairingCode !== 'function') {
    emitRuntimeEvent('pairing-error', 'Esta versión de Baileys no soporta Pairing Code.')
    return false
  }

  sock.__multibotPairingRequested = true
  lastPairingRequestAt = Date.now()
  pairingAttempts += 1
  try {
    if (sock.ws?.readyState !== ws.OPEN) await waitForWebSocketOpen(sock)
    let code = await sock.requestPairingCode(phoneNumber)
    code = code?.match(/.{1,4}/g)?.join('-') || code
    if (!code) throw new Error('WhatsApp no devolvió un Pairing Code.')
    emitRuntimeEvent('pairing-code', code)
    return true
  } catch (error) {
    sock.__multibotPairingRequested = false
    const message = String(error?.message || error || 'No se pudo solicitar el Pairing Code.')
      .split('\n')[0].slice(0, 180)
    emitRuntimeEvent('pairing-error', message)
    return false
  }
}

async function handleLogin() {
  if (conn.authState.creds.registered) {
    console.log(chalk.green('Sesión ya está registrada.'))
    return
  }

  let loginMethod = webRuntime ? runtimeLoginMethod : await question(
    chalk.green(
      '¿Cómo deseas iniciar sesión?\nEscribe "qr" para escanear el código QR o "code" para usar un código de 8 dígitos:\n'
    )
  )
  loginMethod = String(loginMethod).toLowerCase().trim()

  if (loginMethod === 'code' || loginMethod === 'pairing-code') {
    if (webRuntime) {
      // El número llega desde el panel web (MULTIBOT_LOGIN_PHONE).
      await requestWebPairingCode(conn, { force: true })
      return
    }

    const phoneNumber = normalizePairingPhone(
      await question(chalk.blue('Ingresa el número de WhatsApp (incluye el código de país, sin necesidad de +):\n'))
    )

    if (typeof conn.requestPairingCode !== 'function') {
      console.log(chalk.red('Tu versión de Baileys no soporta emparejamiento por código.'))
      return
    }
    try {
      if (conn.ws?.readyState !== ws.OPEN) await waitForWebSocketOpen(conn)
      let code = await conn.requestPairingCode(phoneNumber)
      code = code?.match(/.{1,4}/g)?.join('-') || code
      console.log(chalk.cyan('Tu código de emparejamiento es:', code))
    } catch (e) {
      console.log(chalk.red('Error al solicitar código de emparejamiento:'), e.message || e)
    }
  } else {
    console.log(chalk.yellow(webRuntime ? 'Esperando el QR real de WhatsApp...' : 'Generando código QR, escanéalo con tu WhatsApp...'))
    if (!webRuntime) {
      termuxQrSelected = true
      if (latestQrPayload) qrcode.generate(latestQrPayload, { small: true })
    }
  }
}

conn.isInit = false
conn.well = false

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write()
      if (opts['autocleartmp']) {
        cleanupTmpFiles({ maxAgeMs: 3 * 60 * 1000 })
      }
    }, 30 * 1000)
  }
}

startTmpCleanupInterval({ verbose: true })

/**
 * Reconexión con espera incremental (1,5 s → 30 s) en Termux y en web.
 * Evita bucles cerrados que saturan WhatsApp o piden Pairing Codes en cadena
 * cuando la red está caída. El retardo se reinicia al conectar.
 */
let reloadTimer = null
let reconnectDelayMs = 1500
function cancelScheduledReload() {
  if (reloadTimer) clearTimeout(reloadTimer)
  reloadTimer = null
}
function scheduleReload(delayMs = reconnectDelayMs) {
  if (reloadTimer) return
  const delay = Math.max(500, delayMs)
  reconnectDelayMs = Math.min(30000, reconnectDelayMs * 2)
  reloadTimer = setTimeout(() => {
    reloadTimer = null
    global.reloadHandler(true).catch(console.error)
  }, delay)
  reloadTimer.unref?.()
}

/**
 * Cuando WhatsApp cierra la sesión (logout o sesión inválida), el panel debe
 * volver a mostrar un QR/Pairing Code. Borramos las credenciales efímeras y
 * terminamos el proceso: al desplegar de nuevo, Baileys parte de cero.
 */
function resetWebSession(message) {
  if (!webRuntime) return false
  try { rmSync('./sessions', { recursive: true, force: true }) } catch {}
  emitRuntimeEvent('pairing-error', message)
  setTimeout(() => process.exit(0), 250).unref?.()
  return true
}

async function connectionUpdate(update) {
  const sock = this?.ev ? this : conn
  const { connection, lastDisconnect, isNewLogin } = update
  global.stopped = connection
  if (connection === 'open') {
    reconnectDelayMs = 1500
    cancelScheduledReload()
    pairingAttempts = 0
    emitRuntimeEvent('connected')
  } else if (connection === 'close') emitRuntimeEvent('disconnected')
  if (isNewLogin) sock.isInit = true
  const code =
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.output?.payload?.statusCode
  if (code && code !== DisconnectReason.loggedOut && sock?.ws.socket == null) {
    scheduleReload()
    global.timestamp.connect = new Date()
  }
  if (global.db.data == null) await loadDatabase()
  if (connection === 'open') {
    console.log(chalk.yellow('Conectado correctamente.'))
    global.mainBotJid = sock.user?.jid?.split('@')[0] || sock.user?.id?.split('@')[0]
    try {
      const { markBotStart } = await import('./lib/bot-uptime.js')
      markBotStart(sock) 
    } catch {
      if (!sock.startTime) sock.startTime = Date.now()
    }
    try {
      const { resolveCanalConfig } = await import('./lib/newsletter-rcanal.js')
      await resolveCanalConfig(sock)
    } catch (err) {
      console.error('[canal] Error al resolver config:', err?.message || err)
    }
  }
  const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
  if (reason === 405) {
    if (existsSync('./sessions/creds.json')) unlinkSync('./sessions/creds.json')
    console.log(
      chalk.bold.redBright(
        `Conexión reemplazada, por favor espera un momento. Reiniciando...\nSi aparecen errores, vuelve a iniciar con: npm start`
      )
    )
    if (typeof process.send === 'function') process.send('reset')
    else setTimeout(() => process.exit(1), 1000).unref()
  }
  if (connection === 'close') {
    switch (reason) {
      case DisconnectReason.badSession:
        sock.logger.error(`Sesión incorrecta, elimina la carpeta ${global.authFile} y escanea nuevamente.`)
        if (resetWebSession('La sesión guardada no es válida. Vuelve a vincular con QR o Pairing Code.')) break
        try { rmSync(global.authFile, { recursive: true, force: true }) } catch {}
        setTimeout(() => process.exit(1), 500)
        break
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        sock.logger.warn(`Conexión perdida o cerrada, reconectando...`)
        scheduleReload()
        break
      case DisconnectReason.connectionReplaced:
        sock.logger.error(
          `Conexión reemplazada, se abrió otra sesión. Cierra esta sesión primero.`
        )
        break
      case DisconnectReason.loggedOut:
        sock.logger.error(`Sesión cerrada, elimina la carpeta ${global.authFile} y escanea nuevamente.`)
        if (resetWebSession('La sesión de WhatsApp se cerró. Vuelve a vincular con QR o Pairing Code.')) break
        try { rmSync(global.authFile, { recursive: true, force: true }) } catch {}
        console.log(chalk.cyan('Iniciando de nuevo para vincular…'))
        setTimeout(() => process.exit(1), 500)
        break
      case DisconnectReason.restartRequired:
        sock.logger.info(`Reinicio necesario, reinicia el servidor si hay problemas.`)
        scheduleReload(500)
        break
      default:
        sock.logger.warn(`Desconexión desconocida: ${reason || ''} - Estado: ${connection || ''}`)
        scheduleReload()
        break
    }
  }
}

process.on('uncaughtException', console.error)

let isInit = true
let handler = await import('./handler.js')
global.reloadHandler = async function (restartConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error)
    if (Handler && Object.keys(Handler).length) handler = Handler
  } catch (e) {
    console.error(e)
  }

  if (restartConn) {
    try {
      if (global.conn.ws) global.conn.ws.close()
    } catch {}
    global.conn.ev.removeAllListeners()
    
    
    const preservedStartTime = global.conn.startTime
    let preservedBotId = ''
    try {
      preservedBotId = String(global.conn.user?.jid || '').split('@')[0].replace(/\D/g, '')
    } catch {}
    
    global.conn = makeWASocket(connectionOptions)
    conn = global.conn
    attachRuntimeQrListener(conn)
    // El código anterior caduca con el socket: pide uno nuevo si aún no hay sesión.
    setTimeout(() => { void requestWebPairingCode(global.conn, { force: true }) }, 800).unref?.()
    
   
    if (preservedStartTime) {
      global.conn.startTime = preservedStartTime
    }
    try {
      const { setBotStartTime, getBotStartTime, markBotStart } = await import('./lib/bot-uptime.js')
      const kept = preservedStartTime || (preservedBotId && getBotStartTime(preservedBotId))
      if (kept) {
        setBotStartTime(global.conn, kept)
        if (preservedBotId) setBotStartTime(preservedBotId, kept)
      } else {
        markBotStart(global.conn)
      }
    } catch {}

    isInit = true
  }

  if (!isInit) {
    global.conn.ev.off('messages.upsert', global.conn.handler)
    global.conn.ev.off('connection.update', global.conn.connectionUpdate)
    global.conn.ev.off('creds.update', global.conn.credsUpdate)
  }

  global.conn.handler = handler.handler.bind(global.conn)
  global.conn.connectionUpdate = connectionUpdate.bind(global.conn)
  global.conn.credsUpdate = saveCreds.bind(global.conn, true)

  initViewOnceAntiListener(global.conn)
  global.conn.ev.on('messages.upsert', global.conn.handler)
  global.conn.ev.on('connection.update', global.conn.connectionUpdate)
  global.conn.ev.on('creds.update', global.conn.credsUpdate)

  if (!connectionHandlersReady) {
    connectionHandlersReady = true
    global.conn.ev.off('connection.update', bufferEarlyConnectionUpdate)
    const queuedUpdates = pendingConnectionUpdates.splice(0)
    for (const update of queuedUpdates) queueMicrotask(() => global.conn.connectionUpdate?.(update))
  }

  isInit = false
  return true
}

const pluginFolder = join(__dirname, 'plugins')
const pluginFilter = (filename) => /\.js$/.test(filename)

function normalizePlugin(plugin) {
  if (typeof plugin === 'function') {
    return {
      handler: plugin,
      command: plugin.command || [],
      tags: plugin.tags || [],
      help: plugin.help || [],
      all: plugin.all,
      before: plugin.before,
      customPrefix: plugin.customPrefix,
      disabled: false,
    }
  }
  if (plugin.command && typeof plugin.command === 'string') {
    plugin.command = [plugin.command]
  }
  return plugin
}

global.plugins = {}

async function filesInit() {
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename))
      const module = await import(file)
      global.plugins[filename] = normalizePlugin(module.default || module)
    } catch (e) {
      conn.logger.error(`Error cargando plugin ${filename}:`, e)
      delete global.plugins[filename]
    }
  }
}
await filesInit()

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true)
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(`Updated plugin - '${filename}'`)
      else {
        conn.logger.warn(`Deleted plugin - '${filename}'`)
        return delete global.plugins[filename]
      }
    } else conn.logger.info(`New plugin - '${filename}'`)

    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    })
    if (err) conn.logger.error(`Syntax error while loading '${filename}':\n${format(err)}`)
    else {
      try {
        const module = await import(`${global.__filename(dir)}?update=${Date.now()}`)
        global.plugins[filename] = normalizePlugin(module.default || module)
      } catch (e) {
        conn.logger.error(`Error requiring plugin '${filename}':\n${format(e)}`)
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
      }
    }
  }
}
Object.freeze(global.reload)

watch(pluginFolder, global.reload)
await global.reloadHandler()
await handleLogin()

global.reconnectSubBots = async function() {
  if (!global.conns || !Array.isArray(global.conns)) {
    global.conns = []
  }

  const serbotDir = './Serbot'
  if (!existsSync(serbotDir)) {
    console.log(chalk.yellow('No se encontró la carpeta Serbot'))
    return
  }

  const subBotFolders = readdirSync(serbotDir).filter(folder => {
    const folderPath = join(serbotDir, folder)
    return statSync(folderPath).isDirectory() && existsSync(join(folderPath, 'creds.json'))
  })

  if (subBotFolders.length === 0) {
    console.log(chalk.yellow('No se encontraron sub-bots para reconectar'))
    return
  }

  console.log(chalk.cyan(`\nReconectando ${subBotFolders.length} sub-bots...`))

  for (const folder of subBotFolders) {
    try {
      const botPath = join(serbotDir, folder)
      const credsPath = join(botPath, 'creds.json')
      
      if (!existsSync(credsPath)) {
        console.log(chalk.red(`No se encontró creds.json en ${folder}`))
        continue
      }

     
      const isSubBotAlive = (c) => {
        if (!c?.user?.jid) return false
        try {
          if (c.ws?.isOpen === true) return true
          const st = c.ws?.socket?.readyState
          return st === 1 || st === CONNECTING
        } catch {
          return false
        }
      }

      const folderDigits = String(folder).replace(/\D/g, '')
      const isAlreadyConnected = global.conns.some(c => {
        if (!isSubBotAlive(c)) return false
        const jidDigits = String(c.user.jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')
        return jidDigits && folderDigits && jidDigits === folderDigits
      })

      if (isAlreadyConnected) {
        console.log(chalk.green(`Sub-bot ${folder} ya está conectado`))
        continue
      }

      // Quitar entradas muertas del mismo número antes de reconectar
      global.conns = global.conns.filter(c => {
        if (!c?.user?.jid) return isSubBotAlive(c)
        const jidDigits = String(c.user.jid || '').split('@')[0].split(':')[0].replace(/\D/g, '')
        if (jidDigits === folderDigits && !isSubBotAlive(c)) return false
        return true
      })

      
      const serbotModule = await import('./plugins/serbot-serbot.js')
      if (serbotModule.AYBot) {
        await serbotModule.AYBot({
          pathAYBot: botPath,
          m: null,
          conn: global.conn,
          args: [],
          usedPrefix: '.',
          command: 'qr',
          fromCommand: false
        })
        console.log(chalk.green(`Sub-bot ${folder} reconectado exitosamente`))
      } else {
        console.log(chalk.red(`No se pudo importar Pain Bot para ${folder}`))
      }

     
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error) {
      console.log(chalk.red(`Error reconectando sub-bot ${folder}:`, error.message))
    }
  }

  console.log(chalk.cyan(`\nProceso de reconexión de sub-bots completado`))
}

const originalConnectionUpdate = connectionUpdate
connectionUpdate = async function(update) {
  await originalConnectionUpdate.call(this, update)
  
 
  if (update.connection === 'open' && !this.subBotsReconnected) {
    this.subBotsReconnected = true
    console.log(chalk.cyan('\nBot principal conectado, iniciando reconexión de sub-bots...'))
    setTimeout(() => {
      global.reloadHandler().then(() => {
        global.reconnectSubBots().catch(console.error)
      })
    }, 5000) 
  }
}

setTimeout(() => {
  if (global.conn && global.conn.user) {
    console.log(chalk.cyan('\nIniciando reconexión automática de sub-bots..'))
    global.reconnectSubBots().catch(console.error)
  }
}, 10000) 

const publicationTimers = new Map()
const publicationQueue = new Map()