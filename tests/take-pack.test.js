import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, createZip } from '../bots/universal-bot/lib/zip.js'
import PackSessionStore from '../bots/universal-bot/lib/pack-session.js'
import { buildWastickerZip, packStickerFileName, safeFileName } from '../bots/universal-bot/lib/wasticker.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const botDir = path.join(repoRoot, 'bots', 'universal-bot')
// Todos los comandos viven en la carpeta compartida commands/.
const commandsDir = path.join(repoRoot, 'commands')

/** Extrae un archivo de un ZIP "store" (los datos siguen al nombre) */
function extractStored(zip, name) {
  const at = zip.indexOf(Buffer.from(name, 'utf8'))
  assert.ok(at !== -1, `el ZIP no contiene ${name}`)
  const dataStart = at + Buffer.byteLength(name)
  const nextLocal = zip.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart)
  const nextCentral = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart)
  const end = [nextLocal, nextCentral].filter((i) => i !== -1).sort((a, b) => a - b)[0]
  return zip.subarray(dataStart, end === undefined ? undefined : end)
}

test('zip: crc32 coincide con el vector de prueba estándar', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926)
})

test('zip: createZip arma un archivo válido con método store', () => {
  const zip = createZip([
    { name: 'hola.txt', data: Buffer.from('hola mundo') },
    { name: 'otra.txt', data: Buffer.from('segundo') }
  ])
  assert.equal(zip.subarray(0, 4).toString('hex'), '504b0304')
  assert.ok(zip.includes('hola.txt'))
  assert.ok(zip.includes('hola mundo'))
  assert.ok(zip.includes('PK\x05\x06'), 'trae fin de directorio central')
  assert.deepEqual(extractStored(zip, 'hola.txt'), Buffer.from('hola mundo'))
  assert.deepEqual(extractStored(zip, 'otra.txt'), Buffer.from('segundo'))
})

test('zip: createZip valida la entrada', () => {
  assert.throws(() => createZip([]), /al menos un archivo/)
  assert.throws(() => createZip(null), /al menos un archivo/)
})

test('wasticker: nombres seguros y de archivo por hash', () => {
  assert.equal(safeFileName('Olas del mar!'), 'Olas_del_mar')
  assert.equal(safeFileName(''), 'pack')
  const file = packStickerFileName(Buffer.from('fake-webp'))
  assert.match(file, /^[A-Za-z0-9+=-]+\.webp$/)
  assert.ok(!file.includes('/'))
})

test('wasticker: el ZIP trae contents.json con el pack completo', () => {
  const first = Buffer.from('RIFF....WEBP-fake-1')
  const second = Buffer.from('RIFF....WEBP-fake-2')
  const zip = buildWastickerZip({
    stickers: [
      { buffer: first, emojis: ['🌊'], animated: false },
      { buffer: second, emojis: [], animated: true }
    ],
    tray: Buffer.from('fake-png'),
    packId: 'packabc123',
    name: 'Olas del mar',
    publisher: 'Yo'
  })
  assert.equal(zip.subarray(0, 2).toString(), 'PK')
  const contents = JSON.parse(extractStored(zip, 'contents.json').toString('utf8'))
  const [pack] = contents.sticker_packs
  assert.equal(pack.identifier, 'packabc123')
  assert.equal(pack.name, 'Olas del mar')
  assert.equal(pack.publisher, 'Yo')
  assert.equal(pack.tray_image_file, 'packabc123.png')
  assert.equal(pack.animated_sticker_pack, true)
  assert.equal(pack.stickers.length, 2)
  assert.deepEqual(pack.stickers[0].emojis, ['🌊'])
  assert.equal(pack.stickers[1].isAnimated, true)
  assert.ok(zip.includes(pack.stickers[0].image_file))
  assert.ok(zip.includes('packabc123.png'))
})

test('wasticker: valida stickers e id', () => {
  assert.throws(() => buildWastickerZip({ stickers: [], packId: 'x' }), /al menos un sticker/)
  assert.throws(() => buildWastickerZip({ stickers: [{ buffer: Buffer.alloc(1) }] }), /Falta el id/)
})

test('pack-session: ciclo de vida completo', () => {
  const store = new PackSessionStore({ ttlMinutes: 10, maxStickers: 2 })
  try {
    assert.equal(store.get('chat@g.us', 'a@s.whatsapp.net'), null)
    const session = store.start({ chatJid: 'chat@g.us', senderJid: 'a@s.whatsapp.net', name: 'P', author: 'A' })
    assert.equal(session.stickers.length, 0)
    assert.equal(store.get('chat@g.us', 'a@s.whatsapp.net'), session)
    assert.equal(store.findByChat('chat@g.us', 'a@s.whatsapp.net'), session)
    assert.equal(store.findByChat('chat@g.us'), session)
    assert.equal(store.findByChat('otro@g.us'), null)

    assert.deepEqual(store.add(session, { buffer: Buffer.alloc(1) }), { ok: true, count: 1 })
    assert.deepEqual(store.add(session, { buffer: Buffer.alloc(2) }), { ok: true, count: 2 })
    assert.deepEqual(store.add(session, { buffer: Buffer.alloc(3) }), { ok: false, reason: 'lleno' })

    assert.equal(store.finish(session), session)
    assert.equal(store.get('chat@g.us', 'a@s.whatsapp.net'), null)
    assert.equal(store.size, 0)
  } finally {
    store.destroy()
  }
})

test('pack-session: expira por inactividad y cancela', () => {
  const store = new PackSessionStore({ ttlMinutes: 10 })
  try {
    const session = store.start({ chatJid: 'c@g.us', senderJid: 's@s.whatsapp.net', name: 'P', author: 'A' })
    session.updatedAt = Date.now() - 11 * 60 * 1000
    assert.equal(store.get('c@g.us', 's@s.whatsapp.net'), null)
    assert.equal(store.findByChat('c@g.us'), null)

    const other = store.start({ chatJid: 'c@g.us', senderJid: 's@s.whatsapp.net', name: 'P', author: 'A' })
    assert.equal(store.cancel(other), true)
    assert.equal(store.cancel(other), false)
    assert.equal(store.size, 0)
  } finally {
    store.destroy()
  }
})

test('take: plugin registrado con comando, alias y metadatos', async () => {
  const source = await readFile(path.join(commandsDir, 'stickers', 'stickers-take.js'), 'utf8')
  assert.match(source, /handler\.command = \['take', 'robar', 'rename', 'autor'\]/)
  assert.match(source, /handler\.tags = \['stickers'\]/)
  assert.ok(source.includes("from '../../bots/universal-bot/lib/sticker.js'"), 'usa addExif del lib')
  assert.ok(source.includes('addExif(webp, name, author)'))
  assert.ok(source.includes('resolverMetaSticker'), 'respeta .setmeta del usuario')
  assert.ok(source.includes('citado.download()'), 'descarga el citado o el propio mensaje')
  assert.ok(source.includes('export function splitNombreAutor'), 'divide nombre,autor')
})

test('pack: plugin con comando, auto-colección y ZIP', async () => {
  const source = await readFile(path.join(commandsDir, 'stickers', 'pack-stickers.js'), 'utf8')
  assert.match(source, /handler\.command = \['pack', 'packsticker', 'stickerpack'\]/)
  assert.match(source, /handler\.all = async function/)
  assert.ok(source.includes("from '../../bots/universal-bot/lib/pack-session.js'"))
  assert.ok(source.includes("from '../../bots/universal-bot/lib/wasticker.js'"))
  assert.ok(source.includes('lastAddedId'), 'deduplica pie de foto vs auto-add')
  assert.ok(source.includes('.wasticker'), 'envía el archivo .wasticker')
  assert.ok(source.includes("DONE.has(first)"), 'soporta .pack done')
  assert.ok(source.includes('CANCEL.has(first)'), 'soporta .pack cancel')
  assert.ok(source.includes('findByChat(m.chat, m.sender)'), 'agrega solo al dueño de la sesión')
})
