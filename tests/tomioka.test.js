import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defaultConfigFile, loadConfig } from '../bots/tomioka/src/config.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const botDir = path.join(repoRoot, 'bots', 'tomioka')

test('tomioka: manifiesto válido y solo-Termux (sin runtime web)', async () => {
  const manifest = JSON.parse(await readFile(path.join(botDir, 'bot.json'), 'utf8'))
  assert.equal(manifest.id, 'tomioka')
  assert.equal(manifest.name, 'TomiOka')
  assert.equal(manifest.executionMode, 'termux')
  assert.equal(manifest.webRuntime, false)
  assert.equal(manifest.supportsPairingCode, true)
  assert.equal(manifest.supportsQr, true)
  assert.equal(manifest.adultContent, false)
  const pkg = JSON.parse(await readFile(path.join(botDir, 'package.json'), 'utf8'))
  assert.ok(pkg.scripts.start)
  assert.ok(pkg.scripts.setup)
})

test('tomioka: la terminal lo detecta con su nombre', () => {
  const result = spawnSync('bash', [path.join(repoRoot, 'termux.sh'), '--list-bots'], {
    encoding: 'utf8', timeout: 60000,
    env: { ...process.env, TERM: 'dumb' },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /tomioka/)
  assert.match(result.stdout, /TomiOka/)
})

test('tomioka: sin config.json privada usa config.example.json', () => {
  assert.equal(existsSync(path.join(botDir, 'config.json')), false, 'config.json no se commitea')
  assert.equal(defaultConfigFile(), path.join(botDir, 'config.example.json'))
  const config = loadConfig()
  assert.deepEqual(config.prefixes, ['.'])
  assert.equal(config.menu.categories.length, 7)
  assert.equal(config.login, 'ask')
})

test('tomioka: respeta método/teléfono de la terminal MultiBot', () => {
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

test('tomioka: setup guarda owner y nombre en config.json (copia temporal)', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tomioka-setup-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(path.join(dir, 'scripts'), { recursive: true })
  await copyFile(path.join(botDir, 'scripts', 'setup-config.js'), path.join(dir, 'scripts', 'setup-config.js'))
  await copyFile(path.join(botDir, 'config.example.json'), path.join(dir, 'config.example.json'))

  const run = (args) => spawnSync('node', [path.join(dir, 'scripts', 'setup-config.js'), ...args], { encoding: 'utf8', timeout: 30000 })
  assert.notEqual(run(['--owner', '123']).status, 0, 'número inválido debe fallar')

  const ok = run(['--owner', '59899123456', '--name', 'Mi TomiOka', '--yes'])
  assert.equal(ok.status, 0, ok.stderr)
  const saved = JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'))
  assert.deepEqual(saved.owner.numbers, ['59899123456'])
  assert.equal(saved.bot.name, 'Mi TomiOka')
  assert.ok(saved.menu, 'conserva el resto del ejemplo')
})

test('tomioka: aparece en el catálogo web como solo-Termux', async (t) => {
  const { createApplication, createDatabase } = await import('../scripts/serve-web.js')
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'tomioka-catalog-'))
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
  const tomioka = catalog.bots.find((bot) => bot.id === 'tomioka')
  assert.ok(tomioka, 'tomioka debe estar en el catálogo')
  assert.equal(tomioka.name, 'TomiOka')
  assert.equal(tomioka.termuxOnly, true)
  assert.equal(tomioka.executionMode, 'termux')
  assert.equal(tomioka.webRuntime, false)
})

test('tomioka: bot-settings CLI edita config.json para la terminal (copia temporal)', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tomioka-settings-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(path.join(dir, 'scripts'), { recursive: true })
  await copyFile(path.join(botDir, 'scripts', 'bot-settings.js'), path.join(dir, 'scripts', 'bot-settings.js'))
  await copyFile(path.join(botDir, 'config.example.json'), path.join(dir, 'config.example.json'))

  const run = (args) => spawnSync('node', [path.join(dir, 'scripts', 'bot-settings.js'), ...args], { encoding: 'utf8', timeout: 30000 })
  const list = run(['list'])
  assert.equal(list.status, 0, list.stderr)
  assert.match(list.stdout, /^namebot=.+/m)
  assert.match(list.stdout, /^menuBotones=true/m)
  assert.match(list.stdout, /^menuBotonesLayout=horizontal/m)
  assert.ok(!/^moneda=/m.test(list.stdout), 'tomioka no trae moneda')

  assert.equal(run(['set', 'nombre', 'Tomi Test']).status, 0)
  assert.equal(run(['set', 'respuesta', 'estado']).status, 0)
  assert.equal(run(['set', 'comandos', 'off']).status, 0)
  assert.notEqual(run(['set', 'moneda', 'USD']).status, 0, 'moneda debe fallar')
  assert.equal(run(['owner-add', '59899123456', 'Lyan']).status, 0)
  assert.equal(run(['mod-add', '59899765432']).status, 0)

  const saved = JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8'))
  assert.equal(saved.bot.name, 'Tomi Test')
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
