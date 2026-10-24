import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  ALL_KEYS,
  addMod,
  addOwner,
  listMods,
  listOwners,
  readAllSettings,
  readSetting,
  removeMod,
  removeOwner,
  setSetting,
} from '../bots/universal-bot/lib/bot-settings.js'
import { sinMarcasReenviado, quiereReenviado } from '../bots/universal-bot/lib/salida.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const botDir = path.join(repoRoot, 'bots', 'universal-bot')
const template = await readFile(path.join(botDir, 'config.example.js'), 'utf8')

test('bot-settings: get/set escalares con defaults sanos', () => {
  const all = readAllSettings(template)
  assert.equal(all.namebot, 'UNIVERSAL BOT')
  assert.equal(all.packname, 'UNIVERSAL BOT')
  assert.equal(all.author, 'MultiBot')
  assert.equal(all.moneda, 'USD')
  assert.equal(all.botBanner, '')
  assert.equal(all.comandosEnabled, true)
  assert.equal(all.mensajesReenviados, true)
  assert.equal(all.quotedVerificado, true)
  assert.equal(all.menuLista, false)
  assert.equal(all.modoPublico, true)

  let next = setSetting(template, 'packname', 'Mis Stickers')
  assert.equal(readSetting(next, 'packname').value, 'Mis Stickers')
  next = setSetting(next, 'menuLista', true)
  assert.equal(readSetting(next, 'menuLista').value, true)
  next = setSetting(next, 'comandosEnabled', false)
  assert.equal(readSetting(next, 'comandosEnabled').value, false)
  next = setSetting(next, 'modoPublico', false)
  assert.equal(readSetting(next, 'modoPublico').value, false)
  // No rompe el resto del archivo.
  assert.match(next, /global\.APIs = \{/)
  assert.match(next, /watchFile\(file/)
  assert.throws(() => setSetting(next, 'noexiste', 'x'), /desconocido/)
})

test('bot-settings: inserta claves que faltan en configs viejas', () => {
  const vieja = "global.owner = []\nlet file = fileURLToPath(import.meta.url)\nwatchFile(file, () => {})\n"
  const next = setSetting(vieja, 'moneda', 'UYU')
  assert.equal(readSetting(next, 'moneda').value, 'UYU')
  assert.ok(next.indexOf('global.moneda') < next.indexOf('let file ='))
})

test('bot-settings: owners (placeholder se reemplaza, agregar/actualizar/quitar)', () => {
  assert.deepEqual(listOwners(template), [])
  let next = addOwner(template, '59899123456', 'Lyan')
  assert.deepEqual(listOwners(next), [{ phone: '59899123456', name: 'Lyan' }])
  assert.doesNotMatch(next, /521XXXXXXXXXX/)
  next = addOwner(next, '+598 76 123-456', 'Amigo')
  assert.deepEqual(listOwners(next), [
    { phone: '59899123456', name: 'Lyan' },
    { phone: '59876123456', name: 'Amigo' },
  ])
  next = addOwner(next, '59899123456', 'Lyan Nuevo')
  assert.equal(listOwners(next)[0].name, 'Lyan Nuevo')
  const { source, removed } = removeOwner(next, '59876123456')
  assert.equal(removed, 1)
  assert.deepEqual(listOwners(source), [{ phone: '59899123456', name: 'Lyan Nuevo' }])
  assert.equal(removeOwner(source, '00000000').removed, 0)
  assert.throws(() => addOwner(source, '123'), /no válido/i)
})

test('bot-settings: mods (agregar sin duplicar, quitar)', () => {
  assert.deepEqual(listMods(template), [])
  let next = addMod(template, '59899123456')
  next = addMod(next, '59899123456')
  assert.deepEqual(listMods(next), ['59899123456'])
  next = addMod(next, '59876123456')
  assert.deepEqual(listMods(next), ['59899123456', '59876123456'])
  const { source, removed } = removeMod(next, '59899123456')
  assert.equal(removed, 1)
  assert.deepEqual(listMods(source), ['59876123456'])
  assert.throws(() => addMod(source, 'abc'), /no válido/i)
})

test('bot-settings CLI: list/set/get/owners/mods sobre config temporal', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'multibot-settings-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const config = path.join(dir, 'config.js')
  await writeFile(config, template)
  const run = (args) => spawnSync('node', [path.join(botDir, 'scripts', 'bot-settings.js'), ...args], {
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, BOT_SETTINGS_CONFIG: config },
  })

  const list = run(['list'])
  assert.equal(list.status, 0, list.stderr)
  assert.match(list.stdout, /^moneda=USD$/m)

  assert.equal(run(['set', 'moneda', 'UYU']).status, 0)
  assert.match(run(['get', 'moneda']).stdout, /^moneda=UYU$/m)
  assert.equal(run(['set', 'comandos', 'off']).status, 0)
  assert.match(run(['get', 'comandosEnabled']).stdout, /^comandosEnabled=false$/m)
  assert.equal(run(['set', 'respuesta', 'responder']).status, 0)
  assert.match(run(['get', 'quotedVerificado']).stdout, /^quotedVerificado=false$/m)
  assert.equal(run(['set', 'respuesta', 'estado']).status, 0)
  assert.equal(run(['set', 'publico', 'off']).status, 0)
  assert.match(run(['get', 'modoPublico']).stdout, /^modoPublico=false$/m)
  assert.equal(run(['owner-add', '59899123456', 'Lyan']).status, 0)
  assert.match(run(['owners']).stdout, /59899123456\|Lyan/)
  assert.equal(run(['mod-add', '59876123456']).status, 0)
  assert.match(run(['mods']).stdout, /59876123456/)

  assert.notEqual(run(['set', 'noexiste', 'x']).status, 0)
  assert.notEqual(run(['owner-add', '123']).status, 0)
  assert.notEqual(run(['set', 'banner', 'no-es-ruta']).status, 0)

  // La config resultante sigue siendo JS válido.
  const check = spawnSync('node', ['--check', config], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
})

test('salida: quitar marcas de reenviado clona sin mutar', () => {
  const original = { text: 'hola', contextInfo: { isForwarded: true, forwardingScore: 5, forwardedNewsletterMessageInfo: { newsletterJid: 'x' }, mentionedJid: ['a'] } }
  const limpio = sinMarcasReenviado(original)
  assert.equal(limpio.contextInfo.isForwarded, undefined)
  assert.equal(limpio.contextInfo.forwardingScore, undefined)
  assert.equal(limpio.contextInfo.forwardedNewsletterMessageInfo, undefined)
  assert.deepEqual(limpio.contextInfo.mentionedJid, ['a'])
  assert.equal(limpio.text, 'hola')
  // El original (p. ej. global.rcanal reutilizado) queda intacto.
  assert.equal(original.contextInfo.isForwarded, true)
  assert.equal(sinMarcasReenviado({ text: 'x' }).text, 'x')

  delete global.mensajesReenviados
  assert.equal(quiereReenviado(), true)
  global.mensajesReenviados = false
  assert.equal(quiereReenviado(), false)
  delete global.mensajesReenviados
})

test('banner por defecto: existe y es un JPEG válido', async () => {
  const banner = await readFile(path.join(botDir, 'storage', 'img', 'banner-default.jpg'))
  assert.ok(banner.length > 1000)
  assert.equal(banner[0], 0xff)
  assert.equal(banner[1], 0xd8)
  assert.equal(banner[2], 0xff)
})

test('bot: personalización cableada (comandos, reenviados, banner, lista, stickers)', async () => {
  const handler = await readFile(path.join(botDir, 'handler.js'), 'utf8')
  assert.match(handler, /global\.comandosEnabled === false/)
  // Modo público: el alquiler y el candado de privado solo aplican en modo cerrado.
  const gates = handler.match(/global\.modoPublico === false/g) || []
  assert.equal(gates.length, 2)
  assert.match(handler, /modoPublico === false && m\.isGroup && !isRentalBypassCommand/)
  assert.match(handler, /modoPublico === false && !m\.isGroup && !comandosPrivadosPermitidos/)
  assert.match(template, /global\.modoPublico = true/)
  const simple = await readFile(path.join(botDir, 'lib', 'simple.js'), 'utf8')
  assert.match(simple, /aplicarPreferenciaReenviado\(content\)/)
  assert.match(simple, /toPTT\(archivo/)
  assert.match(simple, /audio\/ogg; codecs=opus/)
  assert.doesNotMatch(simple, /audio\/mpeg; codecs=opus/)
  assert.match(simple, /sendAudio:\s*\{/)
  assert.match(simple, /sendAlbum:\s*\{/)
  const dual = await readFile(path.join(botDir, 'lib', 'baileys-dual.js'), 'utf8')
  assert.match(dual, /aplicarPreferenciaReenviado\(content\)/)
  const menuCtx = await readFile(path.join(botDir, 'lib', 'menu-categories.js'), 'utf8')
  assert.match(menuCtx, /global\.botBanner \|\| '.\/storage\/img\/banner-default\.jpg'/)
  const menu = await readFile(path.join(botDir, 'plugins', 'main-menu2.js'), 'utf8')
  assert.match(menu, /global\.menuLista === true/)
  assert.match(menu, /enviarMenuLista/)
  const sticker = await readFile(path.join(botDir, 'plugins', 'stickers-sticker.js'), 'utf8')
  assert.match(sticker, /global\.packname/)
  assert.match(sticker, /global\.author/)
})

test('bot: álbumes y audios usan los helpers', async () => {
  for (const plugin of ['download-img.js', 'download-pinterest.js', 'tiktok-2.js', 'tiktok-search.js']) {
    const source = await readFile(path.join(botDir, 'plugins', plugin), 'utf8')
    assert.match(source, /conn\.sendAlbum\(/, plugin)
  }
  for (const plugin of ['audio-slow.js', 'audio-speed.js', 'audio-toaudio.js', 'tiktok-2.js']) {
    const source = await readFile(path.join(botDir, 'plugins', plugin), 'utf8')
    assert.match(source, /conn\.sendAudio\(/, plugin)
  }
  const tagall = await readFile(path.join(botDir, 'plugins', 'tag-all.js'), 'utf8')
  assert.match(tagall, /esNotaVoz/)
  // Resultados numerados (cada foto con su leyenda) siguen por separado.
  for (const plugin of ['download-igsearch.js', 'search-wallcraft.js']) {
    const source = await readFile(path.join(botDir, 'plugins', plugin), 'utf8')
    assert.doesNotMatch(source, /conn\.sendAlbum\(/, plugin)
  }
})

test('termux.sh: --customize edita la config del bot', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'multibot-custom-root-'))
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-custom-home-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  t.after(() => rm(home, { recursive: true, force: true }))
  const fake = path.join(root, 'bots', 'fake')
  await mkdir(path.join(fake, 'scripts'), { recursive: true })
  await mkdir(path.join(fake, 'lib'), { recursive: true })
  await copyFile(path.join(repoRoot, 'termux.sh'), path.join(root, 'termux.sh'))
  await copyFile(path.join(botDir, 'scripts', 'bot-settings.js'), path.join(fake, 'scripts', 'bot-settings.js'))
  await copyFile(path.join(botDir, 'lib', 'bot-settings.js'), path.join(fake, 'lib', 'bot-settings.js'))
  await copyFile(path.join(botDir, 'lib', 'config-repair.js'), path.join(fake, 'lib', 'config-repair.js'))
  await copyFile(path.join(botDir, 'config.example.js'), path.join(fake, 'config.example.js'))
  await writeFile(path.join(fake, 'package.json'), JSON.stringify({ name: 'fake' }))
  await writeFile(path.join(fake, 'index.js'), 'console.log(1)\n')

  // 4 (moneda) → UYU, 7 (toggle comandos), 11 (toggle modo público), 0 (volver).
  const result = spawnSync('bash', [path.join(root, 'termux.sh'), '--bot', 'fake', '--customize'], {
    cwd: root, input: '4\nUYU\n7\n11\n0\n', encoding: 'utf8', timeout: 90000,
    env: { ...process.env, HOME: home, TERM: 'dumb' },
  })
  assert.equal(result.status, 0, result.stderr)
  const config = await readFile(path.join(fake, 'config.js'), 'utf8')
  assert.match(config, /global\.moneda = 'UYU'/)
  assert.match(config, /global\.comandosEnabled = false/)
  assert.match(config, /global\.modoPublico = false/)
})

test('menú: propietarios dinámicos desde global.owner', async () => {
  const { construirLineasOwners } = await import('../bots/universal-bot/lib/menu-categories.js')
  const antes = global.owner
  try {
    global.owner = [['59899123456', 'Lyan', true]]
    const una = construirLineasOwners(null, 'UNIVERSAL BOT')
    assert.match(una, /wa\.me\/59899123456/)
    assert.match(una, /\*Lyan\*/)
    assert.doesNotMatch(una, /Sunkovv/)

    global.owner = [['59899123456', 'Lyan', true], ['52122222222', 'Mod', true]]
    assert.equal(construirLineasOwners(null, 'UNIVERSAL BOT').split('\n').length, 2)

    // Placeholder o vacío → respaldo con el número del propio bot.
    global.owner = [['521XXXXXXXXXX', 'TuNombre', true]]
    const fb = construirLineasOwners({ user: { id: '59800000000@s.whatsapp.net' } }, 'UNIVERSAL BOT')
    assert.match(fb, /wa\.me\/59800000000/)
    assert.match(fb, /\*UNIVERSAL BOT\*/)
    assert.doesNotMatch(fb, /X/)

    // Sin owners y sin conexión → solo el nombre (nunca explota).
    global.owner = []
    assert.match(construirLineasOwners(null, 'UNIVERSAL BOT'), /\*UNIVERSAL BOT\*/)
    global.owner = undefined
    assert.match(construirLineasOwners(null, 'UNIVERSAL BOT'), /\*UNIVERSAL BOT\*/)
  } finally {
    global.owner = antes
  }
})

test('menú: encabezado con el formato pedido (sin hosting/canales, TIPO exacto)', async () => {
  const { construirEncabezadoMenu, construirLineasOwners } = await import('../bots/universal-bot/lib/menu-categories.js')
  const antes = global.owner
  try {
    global.owner = [['59899123456', 'Sunkovv', true]]
    const ctx = {
      rentalLine: '> 𓂃 ࣪ ִֶָ☾.  𝙰𝙻𝚀𝚄𝙸𝙻𝙴𝚁:  Sin plan ❌\n',
      userRole: '👑 Staff Bot y Grupo',
      nombreBot: 'UNIVERSAL BOT',
      tipo: 'Principal bot Bot',
      botFormatUptime: '00:00:28',
      totalf: 200,
      processRamMB: 218,
      totalRamMB: 3589,
      lineasOwners: construirLineasOwners(null, 'UNIVERSAL BOT'),
    }
    const texto = construirEncabezadoMenu({ sender: '59899123456@s.whatsapp.net' }, ctx)
    const lineas = texto.split('\n')
    assert.ok(lineas[0].includes('𝙱𝙸𝙴𝙽𝚅𝙴𝙽𝙸𝙳𝙾/𝙰') && lineas[0].includes('@59899123456'))
    assert.match(texto, /𝚃𝙸𝙿𝙾:  Principal bot Bot/)
    assert.match(texto, /𝚁𝙾𝙻:  👑 Staff Bot y Grupo/)
    assert.match(texto, /𝙼𝙴𝙼𝙾𝚁𝙸𝙰: 218\/3589 MB/)
    assert.match(texto, /wa\.me\/59899123456.*\*Sunkovv\*/)
    assert.ok(texto.trimEnd().endsWith('𓂃 ࣪ ִֶָ☾. *𝙴𝙻𝙸𝙶𝙴 𝚄𝙽𝙰 𝙲𝙰𝚃𝙴𝙶𝙾𝚁Í𝙰* 𓂃 ࣪ ִֶָ☾.'))
    // Orden: propietarios → línea owner → ELIGE.
    assert.ok(
      texto.indexOf('𝙿𝚁𝙾𝙿𝙸𝙴𝚃𝙰𝚁𝙸𝙾𝚂') < texto.indexOf('wa.me/59899123456') &&
      texto.indexOf('wa.me/59899123456') < texto.indexOf('𝙴𝙻𝙸𝙶𝙴 𝚄𝙽𝙰 𝙲𝙰𝚃𝙴𝙶𝙾𝚁Í𝙰'),
    )
    // Fuera branding ajeno hardcodeado.
    assert.doesNotMatch(texto, /nexcodea/)
    assert.doesNotMatch(texto, /whatsapp\.com\/channel/)
    assert.doesNotMatch(texto, /𝙷𝙾𝚂𝚃𝙸𝙽𝙶/)
    assert.doesNotMatch(texto, /𝙲𝙰𝙽𝙰𝙻𝙴𝚂 𝙾𝙵𝙸𝙲𝙸𝙰𝙻𝙴𝚂/)
    assert.doesNotMatch(texto, /wa\.me\/@Sunkovv/)
  } finally {
    global.owner = antes
  }
})

test('menú: TIPO y carga diferida de modo-sub en el código', async () => {
  const source = await readFile(path.join(botDir, 'lib', 'menu-categories.js'), 'utf8')
  assert.match(source, /'Principal bot Bot'/)
  assert.match(source, /'Sub bot Bot'/)
  assert.match(source, /await import\('..\/plugins\/modo-sub\.js'\)/)
  assert.doesNotMatch(source, /from '..\/plugins\/modo-sub\.js'/)
})

test('alquiler: línea del menú coherente con el modo público', async () => {
  const { obtenerLineaAlquilerMenu } = await import('../bots/universal-bot/lib/alquiler.js')
  const antesDb = global.db
  const antesModo = global.modoPublico
  try {
    global.db = { data: { alquiler: {} } }
    global.modoPublico = true
    assert.equal(obtenerLineaAlquilerMenu('123@g.us'), 'Modo público 🌍')
    delete global.modoPublico // undefined = abierto por defecto
    assert.equal(obtenerLineaAlquilerMenu('123@g.us'), 'Modo público 🌍')
    global.modoPublico = false
    assert.equal(obtenerLineaAlquilerMenu('123@g.us'), 'Sin plan ❌')
    // Con plan vigente se muestra el restante en ambos modos.
    global.db.data.alquiler['123@g.us'] = { type: 'normal', expiresAt: Date.now() + 3600000 }
    global.modoPublico = true
    assert.match(obtenerLineaAlquilerMenu('123@g.us'), /restante/)
  } finally {
    global.db = antesDb
    if (antesModo === undefined) delete global.modoPublico
    else global.modoPublico = antesModo
  }
})
