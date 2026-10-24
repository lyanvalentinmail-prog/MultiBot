import test from 'node:test'
import assert from 'node:assert/strict'
import { CommandContext } from '../src/lib/context.js'
import { readButtonSelection } from '../../../lib/wa/interactive.js'
import { commands, findCommand } from '../src/registry.js'
import * as menu from '../src/menu.js'
import { createStore, handleMessage } from '../src/handler.js'
import { fakeSock, sentTexts, silentLogger, testConfig, textMessage } from './helpers.js'

const config = testConfig()

/** Config con el menú de botones apagado (menú clásico). */
function configSinBotones(extra = {}) {
  return testConfig({
    ...extra,
    menu: {
      ...config.menu,
      ...(extra.menu || {}),
      buttons: { ...config.menu.buttons, enabled: false }
    }
  })
}

/** Mensaje de respuesta a un botón (como el que llega al tocar). */
function botonPulsado(id, texto) {
  return {
    key: { remoteJid: '59891111111@s.whatsapp.net', fromMe: false, id: `tap-${id}` },
    pushName: 'Tester',
    message: {
      buttonsResponseMessage: {
        selectedButtonId: id,
        selectedDisplayText: texto,
        type: 1
      }
    }
  }
}

test('el menú se manda con botones (Menu y Perfil) y su nodo biz', async () => {
  const active = testConfig()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({ sock, msg: textMessage('.menu'), config: active, logger: silentLogger, store, commands })

  // Los botones NO pueden ir por sendMessage: Baileys los descartaría.
  assert.equal(sentTexts(sock).length, 0, 'no se manda como texto plano')
  assert.equal(sock.relayed.length, 1, 'se retransmite el mensaje ya construido')

  const { message, options } = sock.relayed[0]
  assert.ok(message.buttonsMessage, 'el mensaje es un buttonsMessage')
  assert.ok(message.buttonsMessage.contentText.includes(config.bot.name))
  assert.deepEqual(
    message.buttonsMessage.buttons.map((button) => button.buttonId),
    ['menu', 'perfil']
  )
  assert.deepEqual(
    message.buttonsMessage.buttons.map((button) => button.buttonText.displayText),
    ['Menu', 'Perfil']
  )

  // WhatsApp solo muestra los botones si el mensaje lleva su nodo <biz>.
  const biz = (options.additionalNodes || []).find((node) => node.tag === 'biz')
  assert.ok(biz, 'el mensaje lleva el nodo <biz> que exige WhatsApp')
})

test('en modo vertical los botones salen apilados (templateMessage)', async () => {
  const active = testConfig()
  active.menu = {
    ...active.menu,
    image: '',
    buttons: { ...active.menu.buttons, layout: 'vertical' }
  }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({ sock, msg: textMessage('.menu'), config: active, logger: silentLogger, store, commands })

  assert.equal(sock.relayed.length, 1)
  const { message } = sock.relayed[0]
  assert.ok(message.templateMessage, 'el mensaje es un templateMessage')
  const botones = message.templateMessage.hydratedFourRowTemplate.hydratedButtons
  assert.deepEqual(
    botones.map((button) => button.quickReplyButton.id),
    ['menu', 'perfil']
  )
})

test('con los botones apagados el menú sale como texto (banner o texto)', async () => {
  const active = configSinBotones()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({ sock, msg: textMessage('.menu'), config: active, logger: silentLogger, store, commands })

  assert.equal(sock.relayed.length, 0, 'sin botones no hay nada que retransmitir')
  const texts = sentTexts(sock)
  assert.equal(texts.length, 1)
  assert.ok(texts[0].content.text.includes(config.bot.name))
})

test('tocar "Menu" abre el menú completo (no vuelve a pedir los botones)', async () => {
  const active = testConfig()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({
    sock,
    msg: botonPulsado('menu', 'Menu'),
    config: active,
    logger: silentLogger,
    store,
    commands
  })

  assert.equal(sock.relayed.length, 0, 'no se manda otro mensaje de botones')
  const texts = sentTexts(sock)
  assert.equal(texts.length, 1)
  assert.ok(texts[0].content.text.includes(config.bot.name), 'muestra el menú del bot')
})

test('tocar "Perfil" muestra el perfil del usuario', async () => {
  const active = testConfig()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({
    sock,
    msg: botonPulsado('perfil', 'Perfil'),
    config: active,
    logger: silentLogger,
    store,
    commands
  })

  const texts = sentTexts(sock)
  assert.equal(texts.length, 1)
  assert.ok(texts[0].content.text.includes('Tester'), 'sale el nombre del usuario')
  assert.ok(texts[0].content.text.includes('59891111111'), 'sale su número')
})

test('un botón desconocido no rompe el bot', async () => {
  const active = testConfig()
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({
    sock,
    msg: botonPulsado('otro', 'Otro'),
    config: active,
    logger: silentLogger,
    store,
    commands
  })

  assert.equal(sock.relayed.length, 0)
  assert.equal(sentTexts(sock).length, 0)
})

test('si el socket no puede retransmitir, el menú se manda como texto', async () => {
  const active = testConfig()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  delete sock.relayMessage
  await handleMessage({ sock, msg: textMessage('.menu'), config: active, logger: silentLogger, store, commands })

  assert.equal(sock.relayed.length, 0)
  const texts = sentTexts(sock)
  assert.equal(texts.length, 1)
  assert.ok(texts[0].content.text.includes(config.bot.name))
  assert.ok(texts[0].content.text.includes('Menu'), 'el texto plano lista las opciones')
})

test('readButtonSelection lee el botón que tocó el usuario', () => {
  const seleccion = readButtonSelection(botonPulsado('perfil', 'Perfil'))
  assert.equal(seleccion.id, 'perfil')
  assert.equal(seleccion.label, 'Perfil')
  assert.equal(readButtonSelection(textMessage('hola')), null)
})

test('ctx.sendButtons manda un buttonsMessage real con su nodo biz', async () => {
  const sock = fakeSock()
  const ctx = new CommandContext({
    sock,
    msg: textMessage('.menu'),
    config: testConfig(),
    logger: silentLogger,
    store: createStore(testConfig(), silentLogger),
    text: '.menu'
  })
  await ctx.sendButtons({ text: 'Hola', footer: 'Pie' })

  assert.equal(sock.sent.length, 0, 'no se manda como texto plano')
  assert.equal(sock.relayed.length, 1)
  const { message, options } = sock.relayed[0]
  assert.ok(message.buttonsMessage)
  assert.equal(message.buttonsMessage.contentText, 'Hola')
  assert.equal(message.buttonsMessage.footerText, 'Pie')
  assert.equal(message.buttonsMessage.buttons.length, 2)
  assert.ok((options.additionalNodes || []).some((node) => node.tag === 'biz'))
})

test('el texto del menú con botones usa los datos del bot', () => {
  const text = menu.buildButtonsText({ config, sender: { label: 'Tester' } })
  assert.ok(text.includes(config.bot.name))
  assert.ok(text.includes(config.bot.team))
  assert.ok(text.includes('Tester'))
  assert.ok(!text.includes('undefined'))

  const footer = menu.buildButtonsFooter({ config })
  assert.ok(footer.includes(config.bot.version))
  assert.ok(!footer.includes('undefined'))
})

test('.help <comando> sigue mandando la tarjeta de texto', async () => {
  const replies = []
  const ctx = {
    config,
    commands,
    menu,
    args: ['sticker'],
    argsText: 'sticker',
    reply: async (text) => replies.push(text)
  }
  const result = await findCommand('help').run(ctx)
  assert.equal(result, 'help sticker')
  assert.equal(replies.length, 1)
  assert.ok(replies[0].includes('.sticker'))
})
