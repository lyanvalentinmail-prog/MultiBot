/**
 * Cargador compartido de comandos.
 *
 * TODOS los comandos del repo viven en `commands/<categoría>/<comando>.js` y
 * respetan el mismo contrato:
 *
 *   export default {
 *     name: 'kick',
 *     aliases: ['expulsar'],
 *     category: 'grupos',
 *     description: 'Elimina a un usuario del grupo',
 *     usage: '.kick @usuario',
 *     examples: ['.kick @usuario'],
 *     async run(ctx) { ... }
 *   }
 *
 * Cada bot declara qué comandos usa en su manifiesto `commands.json`
 * (bots/<id>/commands.json). Este módulo lee ese manifiesto, carga los
 * ficheros correspondientes y arma el registro (nombre/alias → comando).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getBrand } from './runtime.js'

/** Raíz del repo: `lib/` vive en la raíz. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Carpeta única con todos los comandos del repo. */
export const COMMANDS_DIR = path.join(REPO_ROOT, 'commands')

/** Categorías válidas (las que define commands/categories.json). */
export function loadCategories(dir = COMMANDS_DIR) {
  const file = path.join(dir, 'categories.json')
  if (!existsSync(file)) return []
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  return (raw.categories || []).map((c) => (typeof c === 'string' ? c : c.id))
}

/**
 * Lee el manifiesto de comandos de un bot.
 * @param {string} manifestPath ruta a commands.json
 */
export function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    throw new Error(`No existe el manifiesto de comandos: ${manifestPath}`)
  }
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const list = Array.isArray(raw) ? raw : raw.commands
  if (!Array.isArray(list)) {
    throw new Error(`Manifiesto inválido (falta la lista "commands"): ${manifestPath}`)
  }
  return {
    bot: raw.bot ?? path.basename(path.dirname(manifestPath)),
    description: raw.description ?? '',
    commands: list
  }
}

/**
 * Comprueba que un comando respeta el contrato canónico.
 * @param {object} command
 * @param {string} id identificador del comando (ruta relativa a commands/)
 */
export function assertCanonical(command, id) {
  if (!command || typeof command !== 'object') {
    throw new Error(`Comando inválido (${id}): se esperaba un objeto`)
  }
  if (!command.name || typeof command.name !== 'string') {
    throw new Error(`Comando inválido (${id}): falta "name"`)
  }
  if (!command.category || typeof command.category !== 'string') {
    throw new Error(`Comando inválido (${id}): falta "category"`)
  }
  if (typeof command.description !== 'string') {
    throw new Error(`Comando inválido (${id}): falta "description"`)
  }
  if (typeof command.run !== 'function') {
    throw new Error(`Comando inválido (${id}): falta "run(ctx)"`)
  }
  if (command.aliases !== undefined && !Array.isArray(command.aliases)) {
    throw new Error(`Comando inválido (${id}): "aliases" debe ser una lista`)
  }
  return command
}

/** Convierte un id del manifiesto en ruta absoluta dentro de commands/. */
export function resolveCommandPath(id, commandsDir = COMMANDS_DIR) {
  const clean = String(id).replace(/^\/+/, '').replace(/\.js$/, '')
  const file = path.join(commandsDir, `${clean}.js`)
  if (!existsSync(file)) {
    throw new Error(`El manifiesto apunta a un comando inexistente: ${id}`)
  }
  return file
}

/**
 * Carga un comando suelto por su id.
 * @param {string} id ruta relativa a commands/ (con o sin .js)
 * @param {{commandsDir?: string, bust?: boolean}} options
 */
export async function loadCommand(id, { commandsDir = COMMANDS_DIR, bust = false } = {}) {
  const file = resolveCommandPath(id, commandsDir)
  const url = pathToFileURL(file).href + (bust ? `?t=${Date.now()}` : '')
  const module = await import(url)
  const command = assertCanonical(module.default, id)
  command.id = id.replace(/^\/+/, '').replace(/\.js$/, '')
  command.file = file
  return command
}

/**
 * Resuelve las plantillas de la metadata de un comando.
 * Soporta: {{bot}}, {{emoji}}, {{emoji2}}, {{emoji3}}, {{emoji4}}, {{emojis}}.
 * La marca se lee en cada acceso, así que da igual cuándo se configure.
 */
export function resolveTemplate(value) {
  if (Array.isArray(value)) return value.map((item) => resolveTemplate(item))
  if (typeof value !== 'string') return value
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const brand = getBrand()
    const emojis = brand.emojis || []
    if (key === 'emojis') return emojis.join('')
    const emojiMatch = /^emoji(\d*)$/.exec(key)
    if (emojiMatch) {
      const index = emojiMatch[1] ? Number(emojiMatch[1]) - 1 : 0
      return emojis[index] || ''
    }
    return brand[key] ?? ''
  })
}

/**
 * Convierte la metadata de un comando en getters perezosos: las plantillas se
 * resuelven cuando se leen, con la marca que tenga el bot en ese momento.
 */
function applyTemplates(command) {
  for (const key of ['description', 'usage']) {
    if (typeof command[key] !== 'string') continue
    const raw = command[key]
    Object.defineProperty(command, key, {
      configurable: true,
      enumerable: true,
      get: () => resolveTemplate(raw)
    })
  }
  if (Array.isArray(command.examples)) {
    const raw = command.examples
    Object.defineProperty(command, 'examples', {
      configurable: true,
      enumerable: true,
      get: () => resolveTemplate(raw)
    })
  }
  return command
}

/**
 * Arma el registro (nombre/alias → comando) a partir de una lista de comandos.
 * @param {object[]} commandList
 */
export function buildRegistry(commandList) {
  for (const command of commandList) applyTemplates(command)
  const commands = new Map()
  const duplicateAliases = []
  const duplicateNames = []
  for (const command of commandList) {
    if (commands.has(command.name)) {
      // Gana el primero (igual que antes, cuando cada bot recorre sus
      // plugins en orden alfabético). Se anota para poder avisar.
      duplicateNames.push({ name: command.name, command: command.name, owner: commands.get(command.name).name })
      continue
    }
    commands.set(command.name, command)
    for (const alias of command.aliases || []) {
      const actual = commands.get(alias)
      if (actual) {
        // Si es el mismo comando (el alias repite su nombre) no hay conflicto.
        if (actual === command) continue
        duplicateAliases.push({ alias, command: command.name, owner: actual.name })
        continue
      }
      commands.set(alias, command)
    }
  }
  const visibleCommands = commandList.filter((command) => !command.hidden && !command.disabled)
  const findCommand = (name) => {
    if (!name) return null
    return commands.get(String(name).toLowerCase()) || null
  }
  const isCommandRegistered = (command) => commandList.includes(command)
  return {
    commandList,
    visibleCommands,
    commands,
    findCommand,
    isCommandRegistered,
    duplicateAliases,
    duplicateNames
  }
}

/**
 * Carga todos los comandos que declara un bot y devuelve su registro.
 * @param {string} manifestPath ruta a bots/<id>/commands.json
 * @param {{commandsDir?: string}} options
 */
export async function loadCommands(manifestPath, { commandsDir = COMMANDS_DIR } = {}) {
  const manifest = readManifest(manifestPath)
  const commandList = []
  for (const id of manifest.commands) {
    commandList.push(await loadCommand(id, { commandsDir }))
  }
  const registry = buildRegistry(commandList)
  return { manifest, ...registry }
}

/**
 * Atajo: carga el manifiesto de un bot a partir de su carpeta.
 * @param {string} botDir carpeta del bot (contiene commands.json)
 */
export async function loadBotCommands(botDir, options = {}) {
  return loadCommands(path.join(botDir, 'commands.json'), options)
}

/**
 * Lista todos los ficheros de comando del repo (recorre las categorías).
 * @param {string} commandsDir
 * @returns {Array<{id: string, category: string, file: string, size: number}>}
 */
export function listCommandFiles(commandsDir = COMMANDS_DIR) {
  if (!existsSync(commandsDir)) return []
  const out = []
  for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const category = entry.name
    const dir = path.join(commandsDir, category)
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.js')) continue
      const full = path.join(dir, file)
      out.push({
        id: `${category}/${file}`,
        category,
        file: full,
        size: statSync(full).size
      })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Resuelve el nombre de un comando a su fichero.
 * Acepta "kick.js" o "grupos/kick.js".
 * @param {string} name
 * @param {string} commandsDir
 */
export function resolveCommandFile(name, commandsDir = COMMANDS_DIR) {
  const clean = String(name).trim().replace(/^\/+/, '')
  const direct = path.join(commandsDir, clean)
  if (existsSync(direct)) return direct
  const withExt = clean.endsWith('.js') ? clean : `${clean}.js`
  const matches = listCommandFiles(commandsDir).filter((entry) => path.basename(entry.id) === withExt)
  if (matches.length === 1) return matches[0].file
  if (matches.length > 1) {
    throw new Error(`El nombre "${name}" es ambiguo: ${matches.map((m) => m.id).join(', ')}`)
  }
  return direct
}

export default loadCommands
