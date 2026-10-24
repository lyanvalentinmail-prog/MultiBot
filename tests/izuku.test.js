import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defaultConfigFile, loadConfig } from '../bots/izuku-bot/src/config.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const botDir = path.join(repoRoot, 'bots', 'izuku-bot')

test('izuku: manifiesto válido y solo-Termux (sin runtime web)', async () => {
  const manifest = JSON.parse(await readFile(path.join(botDir, 'bot.json'), 'utf8'))
  assert.equal(manifest.id, 'izuku-bot')
  assert.equal(manifest.name, 'Izuku Bot')
  assert.equal(manifest.executionMode, 'termux')
  assert.equal(manifest.webRuntime, false)
  assert.equal(manifest.supportsPairingCode, true)
  assert.equal(manifest.supportsQr, true)
  assert.equal(manifest.adultContent, false)
  const pkg = JSON.parse(await readFile(path.join(botDir, 'package.json'), 'utf8'))
  assert.equal(pkg.name, 'izuku-bot')
  assert.ok(pkg.scripts.start)
  assert.ok(pkg.scripts.setup)
})

test('izuku: la terminal lo detecta con su nombre', () => {
  const result = spawnSync('bash', [path.join(repoRoot, 'termux.sh'), '--list-bots'], {
    encoding: 'utf8', timeout: 60000,
    env: { ...process.env, TERM: 'dumb' },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /izuku-bot/)
  assert.match(result.stdout, /Izuku Bot/)
})

test('izuku: estilo Deku en la config (nombre, team, emojis, estado, banner)', async () => {
  assert.equal(existsSync(path.join(botDir, 'config.json')), false, 'config.json no se commitea')
  assert.equal(defaultConfigFile(), path.join(botDir, 'config.example.json'))
  const config = loadConfig()
  assert.deepEqual(config.prefixes, ['.'])
  assert.equal(config.menu.categories.length, 7)
  assert.equal(config.login, 'ask')
  assert.equal(config.bot.name, '𝕴𝖟𝖚𝖐𝖚')
  assert.equal(config.bot.team, '💚 𝕴𝖟𝖚𝖐𝖚 ⚡')
  assert.deepEqual(config.bot.emojis, ['💚', '⚡', '👊', '💥', '🌪️'])
  assert.equal(config.bot.status, '𝙿𝙻𝚄𝚂 𝚄𝙻𝚃𝚁𝙰')
  assert.ok(config.menu.phrases.some((p) => p.includes('Plus Ultra')))
  assert.equal(config.stickers.packName, 'Izuku')
  assert.equal(config.pack.defaultName, 'Izuku Pack')

  const banner = await readFile(path.join(botDir, String(config.menu.image)))
  assert.ok(banner.length > 1000, 'banner incluido')
  assert.equal(banner[0], 0xff)
  assert.equal(banner[1], 0xd8)
  assert.equal(banner[2], 0xff)
})

test('izuku: respeta método/teléfono de la terminal MultiBot', () => {
  const beforeMethod = process.env.MULTIBOT_LOGIN_METHOD
  const beforePhone = process.env.MULTIBOT_LOGIN_PHONE
  try {
    process.env.MULTIBOT_LOGIN_METHOD = 'code'
    process.env.MULTIBOT_LOGIN_PHONE = '+598 99 123-456'
    const pairing = loadConfig()
    assert.equal(pairing.login, 'pairing')
    assert.equal(pairing.pairingPhone, '59899123456')

    process.env.MULTIBOT_LOGIN_METHOD = 'qr'
    delete process.env.MULTIBOT_LOGIN_PHONE
    assert.equal(loadConfig().login, 'qr')
  } finally {
    if (beforeMethod === undefined) delete process.env.MULTIBOT_LOGIN_METHOD
    else process.env.MULTIBOT_LOGIN_METHOD = beforeMethod
    if (beforePhone === undefined) delete process.env.MULTIBOT_LOGIN_PHONE
    else process.env.MULTIBOT_LOGIN_PHONE = beforePhone
  }
})

test('izuku: setup guarda owner y nombre en config.json (copia temporal)', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'izuku-setup-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(path.join(dir, 'scripts'), { recursive: true })
  await copyFile(path.join(botDir, 'scripts', 'setup-config.js'), path.join(dir, 'scripts', 'setup-config.js'))
  await copyFile(path.join(botDir, 'config.example.json'), path.join(dir, 'config.example.json'))

  const run = (args) => spawnSync('node', [path.join(dir, 'scripts', 'setup-config.js'), ...args], { encoding: 'utf8', timeout: 30000 })
  assert.notEqual(run(['--owner', '123']).status, 0, 'número inválido debe fallar')

  const ok = run(['--owner', '59899123456', '--name', 'Mi Izuku', '--yes'])
  assert.equal(ok.status, 0, ok.stderr)
  const saved = JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'))
  assert.deepEqual(saved.owner.numbers, ['59899123456'])
  assert.equal(saved.bot.name, 'Mi Izuku')
  assert.ok(saved.menu, 'conserva el resto del ejemplo')
})

test('izuku: aparece en el catálogo web como solo-Termux', async (t) => {
  const { createApplication, createDatabase } = await import('../scripts/serve-web.js')
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'izuku-catalog-'))
  const app = await createApplication({ database: createDatabase({ dataDir }) })
  const address = await app.listen(0, '127.0.0.1')
  const base = `http://127.0.0.1:${address.port}`
  t.after(async () => {
    await app.close()
    await rm(dataDir, { recursive: true, force: true })
  })

  const response = await fetch(`${base}/api/bots`)
  assert.equal(response.status, 200)
  const catalog = await response.json()
  const izuku = catalog.bots.find((bot) => bot.id === 'izuku-bot')
  assert.ok(izuku, 'izuku-bot debe estar en el catálogo')
  assert.equal(izuku.name, 'Izuku Bot')
  assert.equal(izuku.termuxOnly, true)
  assert.equal(izuku.executionMode, 'termux')
  assert.equal(izuku.webRuntime, false)
})

test('izuku: bot-settings CLI edita config.json para la terminal (copia temporal)', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'izuku-settings-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(path.join(dir, 'scripts'), { recursive: true })
  await copyFile(path.join(botDir, 'scripts', 'bot-settings.js'), path.join(dir, 'scripts', 'bot-settings.js'))
  await copyFile(path.join(botDir, 'config.example.json'), path.join(dir, 'config.example.json'))

  const run = (args) => spawnSync('node', [path.join(dir, 'scripts', 'bot-settings.js'), ...args], { encoding: 'utf8', timeout: 30000 })
  const list = run(['list'])
  assert.equal(list.status, 0, list.stderr)
  assert.match(list.stdout, /^namebot=.+/m)
  assert.match(list.stdout, /^menuLista=true/m)
  assert.ok(!/^moneda=/m.test(list.stdout), 'izuku no trae moneda')

  assert.equal(run(['set', 'nombre', 'Deku Test']).status, 0)
  assert.equal(run(['set', 'respuesta', 'estado']).status, 0)
  assert.equal(run(['set', 'comandos', 'off']).status, 0)
  assert.notEqual(run(['set', 'moneda', 'USD']).status, 0, 'moneda debe fallar')
  assert.equal(run(['owner-add', '59899123456', 'Lyan']).status, 0)
  assert.equal(run(['mod-add', '59899765432']).status, 0)

  const saved = JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'))
  assert.equal(saved.bot.name, 'Deku Test')
  assert.equal(saved.behavior.estadoQuote, true)
  assert.equal(saved.behavior.commandsEnabled, false)
  assert.deepEqual(saved.owner.numbers, ['59899123456'])
  assert.equal(saved.owner.names['59899123456'], 'Lyan')
  assert.deepEqual(saved.owner.mods, ['59899765432'])

  const owners = run(['owners'])
  assert.match(owners.stdout, /owner\.0=59899123456\|Lyan/)
  const mods = run(['mods'])
  assert.match(mods.stdout, /mod\.0=59899765432/)
})
