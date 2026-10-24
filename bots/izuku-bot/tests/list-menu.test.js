import test from 'node:test'
import assert from 'node:assert/strict'
import { CommandContext } from '../src/lib/context.js'
import { getText } from '../src/lib/message.js'
import {
  LIST_BUTTON_TEXT,
  buildListFooter,
  buildListSections,
  buildListText
} from '../src/menu.js'
import { commands, commandList, findCommand } from '../src/commands/index.js'
import { createStore, handleMessage } from '../src/handler.js'
import { fakeSock, sentTexts, silentLogger, testConfig, textMessage } from './helpers.js'

const config = testConfig()

test('la lista trae una sección por categoría y una fila por comando', () => {
  const sections = buildListSections({ config, commands })
  assert.equal(sections.length, config.menu.categories.length)
  assert.equal(sections.length, 7)

  const rowIds = []
  for (const [index, section] of sections.entries()) {
    assert.ok(section.title.length > 0 && section.title.length <= 24, `título de sección ${index}`)
    assert.ok(section.rows.length > 0, `la sección ${index} no está vacía`)
    for (const row of section.rows) {
      assert.ok(row.title.startsWith(config.prefixes[0]), `fila ${row.title}`)
      assert.ok(row.title.length <= 24, `título de fila corto: ${row.title}`)
      assert.equal(row.rowId, row.title, 'el rowId es el comando con prefijo')
      assert.ok((row.description || '').length <= 60, 'descripción corta')
      rowIds.push(row.rowId)
    }
  }

  // Todos los comandos registrados aparecen exactamente una vez
  const expected = commandList.map((command) => `${config.prefixes[0]}${command.name}`)
  assert.deepEqual([...rowIds].sort(), [...expected].sort())
})

test('la lista omite categorías vacías o desconocidas', () => {
  const custom = testConfig({
    menu: {
      ...config.menu,
      categories: [
        { emoji: '💚', description: 'Vacía', commands: ['noexiste'] },
        { emoji: '⚡', description: 'Solo sticker', commands: ['sticker'] }
      ]
    }
  })
  const sections = buildListSections({ config: custom, commands })
  assert.equal(sections.length, 1)
  assert.match(sections[0].title, /Solo sticker/)
  assert.deepEqual(
    sections[0].rows.map((row) => row.rowId),
    ['.sticker']
  )
})

test('sin categorías la lista queda vacía (y .help cae al menú de texto)', () => {
  const custom = testConfig({ menu: { ...config.menu, categories: [] } })
  assert.deepEqual(buildListSections({ config: custom, commands }), [])
})

test('el texto y el pie de la lista usan los datos del bot', () => {
  const text = buildListText({ config, sender: { label: 'Tester' } })
  assert.ok(text.includes(config.bot.name))
  assert.ok(text.includes(config.bot.team))
  assert.ok(text.includes('Tester'))
  assert.ok(text.includes(`${config.prefixes[0]}help <comando>`))
  assert.ok(!text.includes('undefined'))
  assert.ok(!/\n\s*\n/.test(text), 'sin líneas vacías')

  const footer = buildListFooter({ config })
  assert.ok(footer.includes(config.bot.version))
  assert.ok(!footer.includes('undefined'))

  assert.ok(LIST_BUTTON_TEXT.length > 0 && LIST_BUTTON_TEXT.length <= 20)
})

test('getText lee la fila elegida en una lista interactiva', () => {
  const msg = {
    key: { remoteJid: '59891111111@s.whatsapp.net', fromMe: false, id: 'list-1' },
    message: { listResponseMessage: { singleSelectReply: { selectedRowId: '.sticker' } } }
  }
  assert.equal(getText(msg), '.sticker')
})

test('.help manda la lista interactiva cuando listMode está activo', async () => {
  const calls = []
  const ctx = {
    config,
    commands,
    args: [],
    pushName: 'Tester',
    senderNumber: '59891111111',
    senderJid: '59891111111@s.whatsapp.net',
    retireLive: async (slot) => calls.push(['retire', slot]),
    sendList: async (payload) => {
      calls.push(['sendList', payload])
      return { key: { id: 'list-1' } }
    },
    rememberLive: (slot, sent, meta) => calls.push(['remember', slot, meta])
  }

  const result = await findCommand('help').run(ctx)
  assert.equal(result, 'menu lista')
  assert.deepEqual(calls[0], ['retire', 'menu'])

  const payload = calls.find((call) => call[0] === 'sendList')[1]
  assert.ok(payload.text.includes(config.bot.name))
  assert.ok(payload.footer.includes(config.bot.version))
  assert.equal(payload.sections.length, 7)
  assert.ok(payload.sections.every((section) => section.rows.length > 0))

  assert.deepEqual(calls.at(-1), ['remember', 'menu', { kind: 'media' }])
})

test('.help <comando> sigue mandando la tarjeta de texto aunque listMode esté activo', async () => {
  const replies = []
  const ctx = {
    config,
    commands,
    args: ['sticker'],
    argsText: 'sticker',
    reply: async (text) => replies.push(text)
  }
  const result = await findCommand('help').run(ctx)
  assert.equal(result, 'help sticker')
  assert.equal(replies.length, 1)
  assert.ok(replies[0].includes('.sticker'))
})

test('ctx.sendList manda texto, pie, botón y secciones citando al usuario', async () => {
  const sock = fakeSock()
  const msg = textMessage('.help')
  const ctx = new CommandContext({
    sock,
    msg,
    config: testConfig(),
    logger: silentLogger,
    store: createStore(testConfig(), silentLogger),
    text: '.help'
  })
  const sections = [{ title: 'Demo', rows: [{ title: '.sticker', rowId: '.sticker', description: 'x' }] }]
  await ctx.sendList({ text: 'Hola', footer: 'Pie', sections })

  assert.equal(sock.sent.length, 1)
  assert.equal(sock.sent[0].content.text, 'Hola')
  assert.equal(sock.sent[0].content.footer, 'Pie')
  assert.equal(sock.sent[0].content.buttonText, LIST_BUTTON_TEXT)
  assert.equal(sock.sent[0].content.sections, sections)
  assert.equal(sock.sent[0].options.quoted, msg)
})

test('tocar una fila de la lista ejecuta el comando (listResponseMessage)', async () => {
  const active = testConfig()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  const msg = {
    key: { remoteJid: '59891111111@s.whatsapp.net', fromMe: false, id: 'tap-1' },
    pushName: 'Tester',
    message: { listResponseMessage: { singleSelectReply: { selectedRowId: '.help take' } } }
  }
  await handleMessage({ sock, msg, config: active, logger: silentLogger, store, commands })

  const texts = sentTexts(sock)
  assert.equal(texts.length, 1)
  assert.ok(texts[0].content.text.includes('.take'), 'ejecutó .help take')
})

test('.menu manda la lista interactiva por defecto', async () => {
  const active = testConfig()
  active.menu = { ...active.menu, image: '' }
  const store = createStore(active, silentLogger)
  const sock = fakeSock()
  await handleMessage({ sock, msg: textMessage('.menu'), config: active, logger: silentLogger, store, commands })

  const lists = sock.sent.filter((item) => item.content?.sections)
  assert.equal(lists.length, 1)
  assert.equal(lists[0].content.sections.length, 7)
  assert.equal(lists[0].content.buttonText, LIST_BUTTON_TEXT)
})
