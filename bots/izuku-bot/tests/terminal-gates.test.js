import test from 'node:test'
import assert from 'node:assert/strict'
import { commands } from '../src/registry.js'
import { createStore, handleMessage } from '../src/handler.js'
import { buildEstadoQuote } from '../src/lib/quoted.js'
import { commandContext, fakeSock, sentTexts, silentLogger, testConfig, textMessage } from './helpers.js'

/**
 * Comportamientos que maneja la terminal raíz (./termux.sh → Personalizar):
 * comandos, modo público, reenviados, respuesta (estado/responder) y mods.
 */
function setup(overrides = {}) {
  const config = testConfig(overrides)
  config.menu = { ...config.menu, image: '', listMode: false, buttons: { ...config.menu.buttons, enabled: false } }
  const store = createStore(config, silentLogger)
  const sock = fakeSock()
  return { config, store, sock }
}

test('comandos apagados: solo el dueño usa el bot', async () => {
  const off = setup({ behavior: { commandsEnabled: false } })
  await handleMessage({
    sock: off.sock,
    msg: textMessage('.help take'),
    config: off.config,
    logger: silentLogger,
    store: off.store,
    commands
  })
  assert.equal(sentTexts(off.sock).length, 0, 'un usuario común queda en silencio')

  const owner = setup({ behavior: { commandsEnabled: false }, owner: { numbers: ['59891111111'], mods: [] } })
  await handleMessage({
    sock: owner.sock,
    msg: textMessage('.help take'),
    config: owner.config,
    logger: silentLogger,
    store: owner.store,
    commands
  })
  assert.equal(sentTexts(owner.sock).length, 1, 'el dueño sigue usando el bot')
})

test('modo privado: en DM solo el dueño, en grupos todos', async () => {
  const dm = setup({ behavior: { publicMode: false } })
  await handleMessage({
    sock: dm.sock,
    msg: textMessage('.help take'),
    config: dm.config,
    logger: silentLogger,
    store: dm.store,
    commands
  })
  assert.equal(sentTexts(dm.sock).length, 0, 'en privado no responde a desconocidos')

  const group = setup({ behavior: { publicMode: false } })
  const groupMsg = textMessage('.help take', { jid: '120363000000000000@g.us' })
  groupMsg.key.participant = '59892222222@s.whatsapp.net'
  await handleMessage({
    sock: group.sock,
    msg: groupMsg,
    config: group.config,
    logger: silentLogger,
    store: group.store,
    commands
  })
  assert.equal(sentTexts(group.sock).length, 1, 'en grupos sigue abierto')

  const owner = setup({ behavior: { publicMode: false }, owner: { numbers: ['59891111111'], mods: [] } })
  await handleMessage({
    sock: owner.sock,
    msg: textMessage('.help take'),
    config: owner.config,
    logger: silentLogger,
    store: owner.store,
    commands
  })
  assert.equal(sentTexts(owner.sock).length, 1, 'al dueño le responde en privado')
})

test('reenviados: los mensajes salen marcados solo cuando está activo', async () => {
  const on = testConfig({ behavior: { forwardedStyle: true } })
  const { ctx, sock } = commandContext('.help take', { config: on })
  await ctx.reply('hola')
  assert.deepEqual(sock.sent[0].content.contextInfo, { forwardingScore: 999, isForwarded: true })

  const off = testConfig({ behavior: { forwardedStyle: false } })
  const plain = commandContext('.help take', { config: off })
  await plain.ctx.reply('hola')
  assert.equal(plain.sock.sent[0].content.contextInfo, undefined)
})

test('respuesta estado: cita con tarjeta de contacto; responder: cita el mensaje', async () => {
  const estado = testConfig({ behavior: { estadoQuote: true } })
  const { ctx, sock } = commandContext('.help take', { config: estado })
  await ctx.reply('hola')
  const quoted = sock.sent[0].options.quoted
  assert.equal(quoted.key.remoteJid, 'status@broadcast')
  assert.equal(quoted.message.contactMessage.displayName, 'Tester')
  assert.ok(quoted.message.contactMessage.vcard.includes('waid=59891111111'))

  const responder = testConfig({ behavior: { estadoQuote: false } })
  const plain = commandContext('.help take', { config: responder })
  await plain.ctx.reply('hola')
  assert.equal(plain.sock.sent[0].options.quoted, plain.ctx.msg)
})

test('buildEstadoQuote arma una cita válida con nombre y waid', () => {
  const first = buildEstadoQuote({ name: 'Lyan', waid: '59899001122@s.whatsapp.net' })
  assert.equal(first.participant, '0@s.whatsapp.net')
  assert.equal(first.message.contactMessage.displayName, 'Lyan')
  assert.ok(first.message.contactMessage.vcard.includes('FN:Lyan'))
  assert.ok(first.message.contactMessage.vcard.includes('waid=59899001122'))

  const second = buildEstadoQuote({ name: 'Lyan', waid: '59899001122' })
  assert.notEqual(second.key.id, first.key.id, 'cada cita trae su propio id')

  const anon = buildEstadoQuote({})
  assert.equal(anon.message.contactMessage.displayName, 'Usuario')
  const long = buildEstadoQuote({ name: 'x'.repeat(50), waid: '1' })
  assert.equal(long.message.contactMessage.displayName.length, 40)
})

test('los mods no esperan cooldown (los demás sí)', async () => {
  const { config, store, sock } = setup({
    behavior: { cooldownMs: 60000 },
    owner: { numbers: [], mods: ['59891111111'] }
  })
  await handleMessage({ sock, msg: textMessage('.help take'), config, logger: silentLogger, store, commands })
  await handleMessage({ sock, msg: textMessage('.help take'), config, logger: silentLogger, store, commands })
  assert.equal(sentTexts(sock).length, 2, 'el mod repite sin esperar')

  const userJid = '59893333333@s.whatsapp.net'
  await handleMessage({
    sock,
    msg: textMessage('.help take', { jid: userJid }),
    config,
    logger: silentLogger,
    store,
    commands
  })
  await handleMessage({
    sock,
    msg: textMessage('.help take', { jid: userJid }),
    config,
    logger: silentLogger,
    store,
    commands
  })
  assert.equal(sentTexts(sock).length, 3, 'el usuario común cae en cooldown')
})

test('isOwner e isMod se calculan desde owner.numbers y owner.mods', () => {
  const config = testConfig({ owner: { numbers: ['59891111111'], mods: ['59892222222'] } })
  assert.equal(commandContext('.x', { config }).ctx.isOwner, true)
  assert.equal(commandContext('.x', { config }).ctx.isMod, false)

  const mod = commandContext('.x', { config, jid: '59892222222@s.whatsapp.net' }).ctx
  assert.equal(mod.isOwner, false)
  assert.equal(mod.isMod, true)

  const user = commandContext('.x', { config, jid: '59893333333@s.whatsapp.net' }).ctx
  assert.equal(user.isOwner, false)
  assert.equal(user.isMod, false)
})
