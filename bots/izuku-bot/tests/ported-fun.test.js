import test from 'node:test'
import assert from 'node:assert/strict'
import { findCommand } from '../src/commands/index.js'
import { formatMs, parseDurationMs, stripDurations } from '../src/commands/timer.js'
import { splitLyrics } from '../src/commands/lyrics.js'

function funCtx(argsText = '') {
  const replies = []
  const videos = []
  return {
    replies,
    videos,
    ctx: {
      args: argsText ? argsText.split(/\s+/) : [],
      argsText,
      prefix: '.',
      reply: async (text) => replies.push(text),
      sendVideo: async (buffer, caption) => videos.push({ buffer, caption }),
      typing: async () => {}
    }
  }
}

test('dado y moneda responden con el resultado', async () => {
  const dado = funCtx()
  const summary = await findCommand('dado').run(dado.ctx)
  assert.match(dado.replies[0], /Salió el \*[1-6]\*/)
  assert.match(summary, /^dado [1-6]$/)

  const moneda = funCtx()
  await findCommand('moneda').run(moneda.ctx)
  assert.match(moneda.replies[0], /Salió \*(cara|sello)\*/)
})

test('timer entiende horas, minutos y segundos', () => {
  assert.equal(parseDurationMs('25s'), 25000)
  assert.equal(parseDurationMs('3m'), 180000)
  assert.equal(parseDurationMs('1h 20m'), 4800000)
  assert.equal(parseDurationMs('2 horas'), 7200000)
  assert.equal(parseDurationMs('10 segundos'), 10000)
  assert.equal(parseDurationMs('hola'), 0)
  assert.equal(parseDurationMs(''), 0)
  assert.equal(stripDurations('Vamos a jugar 25s'), 'Vamos a jugar')
  assert.equal(formatMs(90000), '1m 30s')
  assert.equal(formatMs(0), '0s')
})

test('timer valida mensaje, tiempo y máximo', async () => {
  await assert.rejects(findCommand('timer').run(funCtx('').ctx), /Uso:/)
  await assert.rejects(findCommand('timer').run(funCtx('hola sin tiempo').ctx), /tiempo válido/)
  await assert.rejects(findCommand('timer').run(funCtx('x 8 días').ctx), /tiempo válido/)
  await assert.rejects(findCommand('timer').run(funCtx('x 200h').ctx), /máximo/)
})

test('timer avisa cuando se cumple el tiempo', async () => {
  const { ctx, replies } = funCtx('tomar agua 1s')
  const summary = await findCommand('timer').run(ctx)
  assert.equal(summary, 'timer 1s')
  assert.ok(replies[0].includes('te aviso en *1s*'))
  await new Promise((resolve) => setTimeout(resolve, 1300))
  assert.equal(replies.length, 2)
  assert.ok(replies[1].includes('Recordatorio:'))
  assert.ok(replies[1].includes('tomar agua'))
})

test('fb descarga el video y lo manda con datos', async () => {
  const realFetch = globalThis.fetch
  const seen = []
  globalThis.fetch = async (url) => {
    seen.push(String(url))
    if (String(url).includes('vreden')) {
      const json = { status: true, result: { download: { hd: 'https://cdn/x.mp4' }, titulo: 'Mi video', durasi: '0:30' } }
      return { ok: true, headers: { get: () => null }, arrayBuffer: async () => Buffer.from(JSON.stringify(json)) }
    }
    return { ok: true, headers: { get: () => null }, arrayBuffer: async () => Buffer.from('fake-mp4') }
  }
  try {
    const { ctx, videos } = funCtx('https://www.facebook.com/share/r/abc/')
    await findCommand('fb').run(ctx)
    assert.equal(videos.length, 1)
    assert.equal(videos[0].buffer.toString(), 'fake-mp4')
    assert.ok(videos[0].caption.includes('Mi video'))
    assert.ok(seen[0].includes('api.vreden.my.id'))

    await assert.rejects(findCommand('fb').run(funCtx('').ctx), /enlace de Facebook/)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('fb avisa si la API no trae video', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => null },
    arrayBuffer: async () => Buffer.from(JSON.stringify({ status: false }))
  })
  try {
    await assert.rejects(findCommand('fb').run(funCtx('https://www.facebook.com/x').ctx), /No se pudo obtener/)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('lyrics manda ficha y letra (parte si es larga)', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => null },
    arrayBuffer: async () =>
      Buffer.from(
        JSON.stringify({
          status: true,
          data: { title: 'Song', artists: 'Band', album: 'Album', duration: '3:00', lyrics: 'la la la\nna na na' }
        })
      )
  })
  try {
    const { ctx, replies } = funCtx('song band')
    await findCommand('lyrics').run(ctx)
    assert.equal(replies.length, 2)
    assert.ok(replies[0].includes('*Título:* Song'))
    assert.ok(replies[0].includes('*Artista:* Band'))
    assert.ok(replies[1].includes('la la la'))

    await assert.rejects(findCommand('lyrics').run(funCtx('').ctx), /nombre de la canción/)
  } finally {
    globalThis.fetch = realFetch
  }

  assert.deepEqual(splitLyrics('a\nb'), ['a\nb'])
  const long = `${'x'.repeat(2000)}\n${'y'.repeat(2000)}`
  const parts = splitLyrics(long)
  assert.equal(parts.length, 2)
  assert.ok(parts.every((part) => part.length <= 3800))
})
