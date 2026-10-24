import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { unwatchFile } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const handlerFile = path.join(repoRoot, 'bots', 'universal-bot', 'handler.js')

// main.js crea estos helpers antes de importar el handler.
globalThis.__filename = (url) => fileURLToPath(url)
globalThis.__dirname = (url) => path.dirname(fileURLToPath(url))

const { protoType, serialize } = await import('../../bots/universal-bot/lib/simple.js')
protoType()
serialize()
const { handler } = await import('../../bots/universal-bot/handler.js')
const menuCommand = (await import('../../commands/info/main-menu2.js')).default
const groupInfoCommand = (await import('../../commands/grupos/infogrupo.js')).default
const gameCenterCommand = (await import('../../commands/juegos/game-center.js')).default
const snakeGameCommand = (await import('../../commands/juegos/game-html-snake.js')).default
const { clearGameSessions, findGameSession } = await import('../../lib/games/sessions.js')
// El handler se autovigila en producción; la prueba no debe dejar ese watcher abierto.
unwatchFile(handlerFile)

const BOT_JID = '59890000000@s.whatsapp.net'
const OWNER_JID = '59891111111@s.whatsapp.net'
const GLOBAL_KEYS = [
  'db', 'loadDatabase', 'owner', 'ownerLid', 'mods', 'prems', 'conn', 'plugins',
  'opts', 'prefix', 'rcanal', 'modoPublico', 'comandosEnabled', 'menuBotones',
  'menuBotonesLayout', 'baileysInteractive', 'namebot', 'botBanner', 'moneda',
  'conns', 'mainBotJid', 'dfail'
]

function normalizePlugin(command) {
  return {
    ...command,
    command: [command.name, ...(command.aliases || [])].filter(Boolean),
    tags: command.tags || [],
    help: command.help || (command.description ? [command.description] : [])
  }
}

function setupRuntime(t, plugins) {
  const saved = new Map(GLOBAL_KEYS.map((key) => [key, {
    existed: Object.hasOwn(globalThis, key),
    value: globalThis[key]
  }]))
  t.after(() => {
    for (const [key, entry] of saved) {
      if (entry.existed) globalThis[key] = entry.value
      else delete globalThis[key]
    }
  })

  const sent = { files: [], messages: [], interactive: [] }
  const conn = {
    user: { id: BOT_JID, jid: BOT_JID },
    chats: {},
    ev: new EventEmitter(),
    msgqueque: [],
    decodeJid: (jid) => jid,
    pushMessage: async () => {},
    groupMetadata: async () => ({ participants: [] }),
    readMessages: async () => {},
    sendFile: async (...args) => {
      sent.files.push(args)
      return { key: { id: `file-${sent.files.length}` } }
    },
    sendMessage: async (...args) => {
      sent.messages.push(args)
      return { key: { id: `message-${sent.messages.length}` } }
    },
    sendMessageLia: async (...args) => {
      sent.interactive.push(args)
      return { key: { id: `interactive-${sent.interactive.length}` } }
    }
  }

  globalThis.conn = conn
  globalThis.plugins = plugins
  globalThis.owner = [[OWNER_JID.split('@')[0], 'Owner']]
  globalThis.ownerLid = []
  globalThis.mods = []
  globalThis.prems = []
  globalThis.opts = { noprint: true }
  globalThis.prefix = /^[.]/
  globalThis.rcanal = { contextInfo: {} }
  globalThis.modoPublico = true
  globalThis.comandosEnabled = true
  globalThis.menuBotones = false
  globalThis.menuBotonesLayout = 'horizontal'
  globalThis.baileysInteractive = false
  globalThis.namebot = 'Universal Bot'
  globalThis.botBanner = ''
  globalThis.moneda = 'USD'
  globalThis.conns = []
  globalThis.mainBotJid = BOT_JID.split('@')[0]
  globalThis.db = {
    data: {
      users: {},
      chats: {},
      stats: {},
      msgs: {},
      sticker: {},
      settings: { [BOT_JID]: { autoread: false } },
      botGroups: {},
      modoSub: {},
      muted: {},
      soloAdmin: {},
      antiprefijo: {}
    }
  }
  globalThis.loadDatabase = async () => globalThis.db.data

  return { conn, sent }
}

function buttonMessage(id) {
  return {
    key: { remoteJid: OWNER_JID, fromMe: false, id: `tap-${id}` },
    pushName: 'Owner',
    message: {
      buttonsResponseMessage: {
        selectedButtonId: id,
        selectedDisplayText: id === 'menu' ? 'Menu' : 'Perfil',
        type: 1
      }
    }
  }
}

function textMessage(text, jid = OWNER_JID) {
  return {
    key: { remoteJid: jid, fromMe: false, id: `text-${text}` },
    pushName: jid === OWNER_JID ? 'Owner' : 'Invitado',
    message: { conversation: text }
  }
}

function reactionEmojis(sent) {
  return sent.messages.filter(([, content]) => content?.react).map(([, content]) => content.react.text)
}

test('Universal: tocar Menu envía el menú una sola vez', async (t) => {
  const { conn, sent } = setupRuntime(t, {
    'info/main-menu2.js': normalizePlugin(menuCommand)
  })

  await handler.call(conn, { messages: [buttonMessage('menu')], type: 'notify' })

  assert.equal(sent.files.length, 1, 'el hook y el despachador no deben enviar el menú dos veces')
  assert.equal(sent.interactive.length, 0)
})

test('Universal: tocar Perfil ejecuta el perfil una sola vez', async (t) => {
  let profileCalls = 0
  const profilePlugin = normalizePlugin({
    name: 'profile',
    aliases: ['perfil'],
    category: 'perfiles',
    description: 'Perfil de prueba',
    async run() {
      profileCalls += 1
    }
  })
  const { conn } = setupRuntime(t, {
    'info/main-menu2.js': normalizePlugin(menuCommand),
    'perfiles/perfiles-perfil.js': profilePlugin
  })

  await handler.call(conn, { messages: [buttonMessage('perfil')], type: 'notify' })

  assert.equal(profileCalls, 1, 'el perfil abierto por el botón no debe volver a ejecutarse como comando')
})

test('Universal: los comandos canónicos reciben respuesta, socket y metadatos de grupo', async (t) => {
  const { conn, sent } = setupRuntime(t, {
    'grupos/infogrupo.js': normalizePlugin(groupInfoCommand)
  })
  const groupJid = '120363000000000000@g.us'
  conn.groupMetadata = async () => ({
    subject: 'Grupo Universal',
    creation: 1700000000,
    owner: OWNER_JID,
    desc: 'Prueba del contexto completo',
    participants: [
      { id: OWNER_JID, admin: 'admin' },
      { id: BOT_JID, admin: 'admin' }
    ]
  })

  await handler.call(conn, {
    messages: [{
      key: { remoteJid: groupJid, participant: OWNER_JID, fromMe: false, id: 'group-info' },
      pushName: 'Owner',
      message: { conversation: '.infogrupo' }
    }],
    type: 'notify'
  })

  const replies = sent.messages.filter(([, content]) => !content?.react)
  assert.equal(replies.length, 1)
  assert.equal(replies[0][0], groupJid)
  assert.match(replies[0][1].text, /Grupo Universal/)
  assert.match(replies[0][1].text, /Miembros: \*2\*/)
  assert.match(replies[0][1].text, /Prueba del contexto completo/)
  assert.deepEqual(reactionEmojis(sent), ['🕘', '✅️'])
})

test('Universal: un comando con aliases duplicados solo ejecuta el primer plugin', async (t) => {
  const calls = []
  const makePlugin = (id) => normalizePlugin({
    name: id,
    aliases: ['compartido'],
    category: 'extras',
    description: 'Plugin de prueba',
    async run() {
      calls.push(id)
    }
  })
  const { conn } = setupRuntime(t, {
    'extras/primero.js': makePlugin('primero'),
    'extras/segundo.js': makePlugin('segundo')
  })

  await handler.call(conn, { messages: [textMessage('.compartido')], type: 'notify' })

  assert.deepEqual(calls, ['primero'])
})

test('Universal: un comando correcto reacciona primero con espera y luego con éxito', async (t) => {
  let calls = 0
  const plugin = normalizePlugin({
    name: 'reaccion-exito',
    description: 'Prueba de reacciones',
    async run() { calls += 1 }
  })
  const { conn, sent } = setupRuntime(t, { 'extras/reaccion-exito.js': plugin })

  await handler.call(conn, { messages: [textMessage('.reaccion-exito')], type: 'notify' })

  assert.equal(calls, 1)
  assert.deepEqual(reactionEmojis(sent), ['🕘', '✅️'])
})

test('Universal: una excepción reacciona con error', async (t) => {
  t.mock.method(console, 'error', () => {})
  const plugin = normalizePlugin({
    name: 'reaccion-error',
    description: 'Prueba de error',
    async run() { throw new Error('fallo controlado') }
  })
  const { conn, sent } = setupRuntime(t, { 'extras/reaccion-error.js': plugin })

  await handler.call(conn, { messages: [textMessage('.reaccion-error')], type: 'notify' })

  assert.deepEqual(reactionEmojis(sent), ['🕘', '⚠️'])
})

test('Universal: un comando bloqueado reacciona con no permitido y no se ejecuta', async (t) => {
  let calls = 0
  const plugin = normalizePlugin({
    name: 'reaccion-denegada',
    description: 'Prueba de permisos',
    async run() { calls += 1 }
  })
  const { conn, sent } = setupRuntime(t, { 'extras/reaccion-denegada.js': plugin })
  globalThis.comandosEnabled = false

  await handler.call(conn, {
    messages: [textMessage('.reaccion-denegada', '59892222222@s.whatsapp.net')],
    type: 'notify'
  })

  assert.equal(calls, 0)
  assert.deepEqual(reactionEmojis(sent), ['🚫'])
})

test('Universal: un comando prefijado inexistente reacciona con ❌️', async (t) => {
  const { conn, sent } = setupRuntime(t, {})

  await handler.call(conn, { messages: [textMessage('.comando-que-no-existe')], type: 'notify' })

  assert.deepEqual(reactionEmojis(sent), ['❌️'])
})

test('Universal: una conversación sin prefijo no se marca como comando inexistente', async (t) => {
  const { conn, sent } = setupRuntime(t, {})

  await handler.call(conn, { messages: [textMessage('Hola, ¿cómo estás?')], type: 'notify' })

  assert.deepEqual(reactionEmojis(sent), [])
})

test('Universal: Snake y sus botones funcionan a través del despachador real', async (t) => {
  t.after(clearGameSessions)
  const { conn, sent } = setupRuntime(t, {
    'juegos/game-html-snake.js': normalizePlugin(snakeGameCommand),
    'juegos/game-center.js': normalizePlugin(gameCenterCommand)
  })

  await handler.call(conn, { messages: [textMessage('.snake')], type: 'notify' })
  const session = findGameSession('snake', {
    sock: conn,
    chatJid: OWNER_JID,
    senderJid: OWNER_JID,
    m: { chat: OWNER_JID, sender: OWNER_JID }
  }, { ownerOnly: true })
  assert.ok(session)
  assert.equal(session.state.moves, 0)
  assert.deepEqual(reactionEmojis(sent), ['🕘', '✅️'])

  const beforeTap = sent.messages.length
  await handler.call(conn, { messages: [buttonMessage(`mbg:${session.id}:forward`)], type: 'notify' })

  assert.equal(session.state.moves, 1)
  const edited = sent.messages.slice(beforeTap).find(([, content]) => content?.edit)
  assert.ok(edited, 'el botón debe editar el tablero original')
  assert.match(edited[1].text, /Movimientos: 1/)
  assert.deepEqual(reactionEmojis({ messages: sent.messages.slice(beforeTap) }), [])
})
