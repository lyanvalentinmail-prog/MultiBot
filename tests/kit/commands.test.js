import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const commandsDir = path.join(repoRoot, 'commands')
const botsDir = path.join(repoRoot, 'bots')

/** Todos los ficheros de comando, con su categoría. */
function allCommandFiles(dir = commandsDir, prefix = '') {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const category = entry.name
    for (const file of readdirSync(path.join(dir, category))) {
      if (!file.endsWith('.js')) continue
      out.push({ category, file, id: `${prefix}${category}/${file}` })
    }
  }
  return out
}

const BOTS = ['tomioka', 'izuku-bot', 'universal-bot', '_template']

function readManifest(bot) {
  const file = path.join(botsDir, bot, 'commands.json')
  return JSON.parse(readFileSync(file, 'utf8'))
}

test('commands/ es la única carpeta de comandos del repo', () => {
  // Ningún bot puede volver a traer su propia carpeta de comandos.
  for (const bot of BOTS) {
    assert.equal(
      existsSync(path.join(botsDir, bot, 'plugins')),
      false,
      `${bot}/plugins no debe existir: los comandos viven en commands/`
    )
    assert.equal(
      existsSync(path.join(botsDir, bot, 'src/commands')),
      false,
      `${bot}/src/commands no debe existir: los comandos viven en commands/`
    )
  }
  // Y la carpeta compartida sí existe y está poblada.
  const files = allCommandFiles()
  assert.ok(files.length > 200, `commands/ debería tener todos los comandos (${files.length})`)
})

test('todos los comandos siguen el contrato canónico', async () => {
  const files = allCommandFiles()
  for (const { id, category, file } of files) {
    const module = await import(path.join(commandsDir, category, file))
    const command = module.default
    assert.ok(command && typeof command === 'object', `${id}: debe exportar un objeto`)
    assert.equal(typeof command.name, 'string', `${id}: falta "name"`)
    assert.ok(command.name.length > 0, `${id}: "name" vacío`)
    assert.equal(typeof command.run, 'function', `${id}: falta "run(ctx)"`)
    assert.equal(command.category, category, `${id}: la categoría no coincide con la carpeta`)
    assert.equal(typeof command.description, 'string', `${id}: falta "description"`)
    assert.ok(Array.isArray(command.aliases), `${id}: "aliases" debe ser una lista`)
    assert.ok(Array.isArray(command.examples), `${id}: "examples" debe ser una lista`)
    assert.equal(typeof command.usage, 'string', `${id}: falta "usage"`)
  }
})

test('cada bot declara en commands.json los comandos que usa', () => {
  const available = new Set(allCommandFiles().map((entry) => entry.id))
  for (const bot of BOTS) {
    const manifest = readManifest(bot)
    assert.ok(Array.isArray(manifest.commands), `${bot}: "commands" debe ser una lista`)
    assert.ok(manifest.commands.length > 0, `${bot}: el manifiesto está vacío`)
    for (const id of manifest.commands) {
      assert.ok(available.has(id), `${bot}: el manifiesto apunta a ${id}, que no existe`)
    }
    // Sin duplicados.
    assert.equal(new Set(manifest.commands).size, manifest.commands.length, `${bot}: hay ids repetidos`)
  }
})

test('TomiOka e Izuku usan exactamente los mismos comandos', () => {
  const tomioka = readManifest('tomioka').commands.slice().sort()
  const izuku = readManifest('izuku-bot').commands.slice().sort()
  assert.deepEqual(tomioka, izuku)
})

test('no hay nombres de comando repetidos dentro de un bot', async () => {
  const { buildRegistry } = await import('../../lib/commands.js')
  for (const bot of BOTS) {
    const manifest = readManifest(bot)
    const list = []
    for (const id of manifest.commands) {
      const module = await import(path.join(commandsDir, id))
      list.push(module.default)
    }
    const registry = buildRegistry(list)
    assert.ok(registry.commands.size > 0, `${bot}: registro vacío`)
    // Los bots con catálogo propio no pueden repetir nombres ni alias.
    if (bot !== 'universal-bot') {
      assert.deepEqual(registry.duplicateNames, [], `${bot}: nombres repetidos`)
      assert.deepEqual(registry.duplicateAliases, [], `${bot}: alias repetidos`)
    }
  }
})

test('las categorías declaradas existen', () => {
  const declared = JSON.parse(readFileSync(path.join(commandsDir, 'categories.json'), 'utf8'))
  const ids = new Set(declared.categories.map((entry) => entry.id))
  for (const { category } of allCommandFiles()) {
    assert.ok(ids.has(category), `la categoría "${category}" no está en categories.json`)
  }
})
