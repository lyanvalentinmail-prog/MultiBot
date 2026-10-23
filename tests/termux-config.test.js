import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  applyOwnerSettings,
  hasPlaceholderOwner,
  isShellNoiseLine,
  isValidOwnerPhone,
  normalizeOwnerPhone,
  readOwnerSettings,
  repairConfigSource,
} from '../bots/universal-bot/lib/config-repair.js'

const botDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bots', 'universal-bot')
const template = await readFile(path.join(botDir, 'config.example.js'), 'utf8')

// Reproduce el reporte de Termux: `npm start` pegado al inicio de config.js.
const brokenConfig = `npm start${template}`
const brokenSource = 'file:///data/data/com.termux/files/home/MultiBot/bots/universal-bot/config.js:1\nnpm start/* Universal Bot — MultiBot\n    ^^^^^\nSyntaxError: Unexpected identifier \'start\''

test('config repair: removes pasted Termux commands without touching JS', () => {
  const { changed, source } = repairConfigSource(brokenConfig)
  assert.equal(changed, true)
  assert.ok(!source.startsWith('npm start'))
  assert.ok(source.startsWith('/* Universal Bot — MultiBot'))
  assert.match(source, /global\.owner = \[/)
  assert.ok(!/SyntaxError/.test(source))
})

test('config repair: keeps clean files byte for byte and ignores real code', () => {
  assert.deepEqual(repairConfigSource(template), { changed: false, source: template })
  assert.equal(isShellNoiseLine('import chalk from "chalk"'), false)
  assert.equal(isShellNoiseLine('  global.owner = []'), false)
  assert.equal(isShellNoiseLine('// comentario con npm start'), false)
  assert.equal(isShellNoiseLine('npm start'), true)
  assert.equal(isShellNoiseLine('$ npm install'), true)
  assert.equal(isShellNoiseLine('echo "hola"'), true)
})

test('owner helpers: normalize, validate, rewrite and read back', () => {
  assert.equal(normalizeOwnerPhone('+598 99 123 456'), '59899123456')
  assert.equal(isValidOwnerPhone('+598 99 123 456'), true)
  assert.equal(isValidOwnerPhone('123'), false)
  assert.equal(hasPlaceholderOwner(template), true)

  const updated = applyOwnerSettings(template, { phone: '+598 99 123 456', name: 'Ana', lid: '987654321' })
  assert.equal(hasPlaceholderOwner(updated), false)
  assert.match(updated, /global\.owner = \[\n  \['59899123456', "Ana", true\],\n\]/)
  assert.match(updated, /global\.ownerLid = \[\n  \['987654321', "Ana", true\],\n\]/)
  // El resto de la configuración se conserva.
  assert.match(updated, /global\.namebot = 'UNIVERSAL BOT'/)
  assert.match(updated, /global\.APIs = \{/)
  assert.deepEqual(readOwnerSettings(updated), { phone: '59899123456', name: 'Ana', lid: '987654321' })
})

test('check-config repairs a broken config.js with a backup', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'multibot-termux-config-'))
  const file = path.join(dir, 'config.js')
  const backFile = path.join(dir, 'backup.js')
  await writeFile(file, brokenConfig)
  t.after(() => rm(dir, { recursive: true, force: true }))

  // Ejercita el mismo camino que `npm run check:config -- --fix`.
  const { repairConfigFile, inspectConfig } = await import(path.join(botDir, 'scripts', 'check-config.js'))
  const broken = inspectConfig({ file })
  assert.equal(broken.ok, false)
  assert.equal(broken.reason, 'syntax')
  assert.match(broken.syntax, /Unexpected identifier 'start'/)

  const result = repairConfigFile({ file, backup: false })
  assert.equal(result.repaired, true)
  assert.equal(inspectConfig({ file }).ok, true)
  assert.match(await readFile(file, 'utf8'), /^\/\* Universal Bot/)

  // El comando también responde en el repo y mantiene el archivo válido.
  const cli = spawnSync(process.execPath, [path.join(botDir, 'scripts', 'check-config.js')], { encoding: 'utf8' })
  assert.equal(typeof cli.status, 'number')
  await writeFile(backFile, brokenConfig)
  await rm(backFile, { force: true })
})

test('setup-config writes a valid config.js non-interactively', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'multibot-termux-setup-'))
  t.after(() => rm(dir, { recursive: true, force: true }))

  const result = spawnSync(process.execPath, [
    path.join(botDir, 'scripts', 'setup-config.js'),
    '--owner', '+598 99 123 456', '--name', 'Ana', '--yes',
  ], { encoding: 'utf8', cwd: botDir })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Configuración guardada/)

  const written = await readFile(path.join(botDir, 'config.js'), 'utf8')
  const settings = readOwnerSettings(written)
  assert.equal(settings.phone, '59899123456')
  assert.equal(settings.name, 'Ana')

  const syntax = spawnSync(process.execPath, ['--check', path.join(botDir, 'config.js')], { encoding: 'utf8' })
  assert.equal(syntax.status, 0, syntax.stderr)
  // Restaura el estado del árbol de trabajo (config.js está en .gitignore).
  await rm(path.join(botDir, 'config.js'), { force: true })
  await rm(path.join(botDir, 'config.js.bak'), { force: true })
})

test('repaired config is valid JavaScript for the reported Termux error', () => {
  const repaired = repairConfigSource(brokenConfig)
  assert.equal(repaired.changed, true)
  assert.ok(brokenSource.includes("Unexpected identifier 'start'"))
  const dir = mkdtempSync(path.join(os.tmpdir(), 'multibot-loader-'))
  const file = path.join(dir, 'config.js')
  writeFileSync(file, repaired.source)
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  rmSync(dir, { recursive: true, force: true })
})
