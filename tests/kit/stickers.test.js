import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  construirUrlDelirius,
  construirUrlTenor,
  extraerUrlMedia,
  normalizarResultados,
} from '../../bots/universal-bot/lib/sticker-search.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const botDir = path.join(repoRoot, 'bots', 'universal-bot')
// Todos los comandos viven en la carpeta compartida commands/.
const commandsDir = path.join(repoRoot, 'commands')

test('sticker-search: URLs bien formadas y codificadas', () => {
  assert.equal(construirUrlDelirius('gato feliz'), 'https://api.delirius.online/search/tenor?q=gato%20feliz')
  const tenor = construirUrlTenor('gato feliz')
  assert.match(tenor, /^https:\/\/g\.tenor\.com\/v1\/search\?q=gato%20feliz&key=.+&limit=8&media_filter=minimal$/)
})

test('sticker-search: extrae URL de strings, delirius y Tenor v1', () => {
  assert.equal(extraerUrlMedia('https://x.com/a.mp4'), 'https://x.com/a.mp4')
  assert.equal(extraerUrlMedia('no-url'), null)
  assert.equal(extraerUrlMedia(null), null)
  assert.equal(extraerUrlMedia(42), null)
  assert.equal(extraerUrlMedia({ mp4: 'https://x.com/a.mp4', gif: 'https://x.com/a.gif' }), 'https://x.com/a.mp4')
  assert.equal(extraerUrlMedia({ gif: 'https://x.com/a.gif' }), 'https://x.com/a.gif')
  assert.equal(extraerUrlMedia({ url: 'https://x.com/a.gif' }), 'https://x.com/a.gif')
  assert.equal(
    extraerUrlMedia({ media: [{ mp4: { url: 'https://x.com/t.mp4' }, gif: { url: 'https://x.com/t.gif' } }] }),
    'https://x.com/t.mp4',
  )
  assert.equal(extraerUrlMedia({ media: { gif: { url: 'https://x.com/t.gif' } } }), 'https://x.com/t.gif')
  assert.equal(extraerUrlMedia({ medias: [{ url: 'https://x.com/m.mp4' }] }), 'https://x.com/m.mp4')
  assert.equal(extraerUrlMedia({ nada: 1 }), null)
})

test('sticker-search: normaliza data/result/results/arreglo y deduplica', () => {
  const a = { mp4: 'https://x.com/a.mp4' }
  const b = { gif: 'https://x.com/b.gif' }
  assert.deepEqual(normalizarResultados({ status: true, data: [a, b, a] }), ['https://x.com/a.mp4', 'https://x.com/b.gif'])
  assert.deepEqual(normalizarResultados({ result: [b] }), ['https://x.com/b.gif'])
  assert.deepEqual(normalizarResultados({ results: [a] }), ['https://x.com/a.mp4'])
  assert.deepEqual(normalizarResultados([a]), ['https://x.com/a.mp4'])
  assert.deepEqual(normalizarResultados({ status: false }), [])
  assert.deepEqual(normalizarResultados(null), [])
  assert.deepEqual(normalizarResultados('basura'), [])
})

test('stickers .s: el pad va sobre rgba (fondo transparente, no negro)', async () => {
  const source = await readFile(path.join(commandsDir, 'stickers', 'stickers-sticker.js'), 'utf8')
  const vf = source.match(/format=rgba,pad=512:512:[^']*/g) || []
  assert.equal(vf.length, 2, 'vf estático y animado deben forzar rgba antes del pad')
  assert.ok(vf.every((f) => f.includes('color=0x00000000')))
  assert.doesNotMatch(source, /pad=[^']*color=(black|0xff000000|0x000000[^0-9a-f])/)
})

test('bsticker: usa respaldo Tenor, await getName y parseo flexible', async () => {
  const source = await readFile(path.join(commandsDir, 'busqueda', 'search-sticker.js'), 'utf8')
  assert.match(source, /construirUrlTenor/)
  assert.match(source, /normalizarResultados/)
  assert.match(source, /await conn\.getName\(m\.sender\)/)
  assert.match(source, /'bsticker'/)
})
