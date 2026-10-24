#!/usr/bin/env node
/**
 * Lee y escribe los ajustes del bot (config.json) para la terminal raíz.
 * Es el mismo contrato que scripts/bot-settings.js de universal-bot:
 *
 *   list                       → líneas `clave=valor` con todo (+ owners/mods)
 *   get <ajuste>               → `clave=valor`
 *   set <ajuste> <valor>       → escribe y muestra `clave=valor`
 *   owners | mods             → `owner.N=tel|nombre` / `mod.N=tel`
 *   owner-add <tel> [nombre]  → agrega dueño
 *   owner-del <tel>           → quita dueño
 *   mod-add <tel> | mod-del <tel>
 *
 * Ajustes: namebot, packname, author, botBanner,
 *   comandosEnabled, mensajesReenviados, quotedVerificado, menuBotones,
 *   menuBotonesLayout, modoPublico
 * Alias: nombre, stickers-pack/nombre-stickers, stickers-autor/autor-stickers,
 *   banner, comandos, reenviados, respuesta (estado|responder),
 *   menu-botones (menu-lista), menu-layout, publico/modo-publico
 *
 * Variables: BOT_SETTINGS_CONFIG=<ruta config.json> (para pruebas).
 * Salida pensada para bash: líneas `clave=valor`.
 * Sin dependencias externas.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const botDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = process.env.BOT_SETTINGS_CONFIG || path.join(botDir, 'config.json')
const TEMPLATE_PATH = path.join(botDir, 'config.example.json')

const ALL_KEYS = [
  'namebot',
  'packname',
  'author',
  'botBanner',
  'comandosEnabled',
  'mensajesReenviados',
  'quotedVerificado',
  'menuBotones',
  'menuBotonesLayout',
  'modoPublico'
]
const BOOL_KEYS = ['comandosEnabled', 'mensajesReenviados', 'quotedVerificado', 'menuBotones', 'modoPublico']

// Misma llave que universal-bot → ruta dentro del config.json
const PATHS = {
  namebot: ['bot', 'name'],
  packname: ['stickers', 'packName'],
  author: ['stickers', 'packAuthor'],
  botBanner: ['menu', 'image'],
  comandosEnabled: ['behavior', 'commandsEnabled'],
  mensajesReenviados: ['behavior', 'forwardedStyle'],
  quotedVerificado: ['behavior', 'estadoQuote'],
  menuBotones: ['menu', 'buttons', 'enabled'],
  menuBotonesLayout: ['menu', 'buttons', 'layout'],
  modoPublico: ['behavior', 'publicMode']
}

// Valores vigentes cuando el config.json (viejo) todavía no trae la llave
const DEFAULTS = {
  namebot: '',
  packname: '',
  author: '',
  botBanner: '',
  comandosEnabled: true,
  mensajesReenviados: false,
  quotedVerificado: false,
  menuBotones: true,
  menuBotonesLayout: 'horizontal',
  modoPublico: true
}

const ALIASES = {
  nombre: 'namebot',
  'nombre-bot': 'namebot',
  'stickers-pack': 'packname',
  'nombre-stickers': 'packname',
  pack: 'packname',
  'stickers-autor': 'author',
  'autor-stickers': 'author',
  autor: 'author',
  banner: 'botBanner',
  'banner-bot': 'botBanner',
  comandos: 'comandosEnabled',
  reenviados: 'mensajesReenviados',
  respuesta: 'quotedVerificado',
  'menu-lista': 'menuBotones', // alias viejo (la lista ahora son botones)
  'menu-botones': 'menuBotones',
  botones: 'menuBotones',
  'menu-layout': 'menuBotonesLayout',
  'layout-menu': 'menuBotonesLayout',
  publico: 'modoPublico',
  'modo-publico': 'modoPublico'
}
for (const key of ALL_KEYS) ALIASES[key.toLowerCase()] = key

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

function resolveKey(raw = '') {
  const key = ALIASES[String(raw).trim().toLowerCase()]
  if (!key) {
    console.error(`✖ Ajuste desconocido: ${raw}`)
    console.error(`  Válidos: ${ALL_KEYS.join(', ')}`)
    process.exit(1)
  }
  return key
}

function parseBool(raw = '') {
  const v = String(raw).trim().toLowerCase()
  if (['1', 'true', 'on', 'si', 'sí', 's', 'y', 'yes', 'estado'].includes(v)) return true
  if (['0', 'false', 'off', 'no', 'n', 'responder'].includes(v)) return false
  fail(`Valor no válido: ${raw} (usa on/off)`)
}

function loadJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail(`No se pudo leer ${file}: ${error.message}`)
  }
}

function readConfig() {
  if (existsSync(CONFIG_PATH)) return loadJson(CONFIG_PATH)
  if (existsSync(TEMPLATE_PATH)) return loadJson(TEMPLATE_PATH)
  fail('No existe config.json ni config.example.json')
}

function ensureWritableConfig() {
  if (!existsSync(CONFIG_PATH)) {
    if (!existsSync(TEMPLATE_PATH)) fail('No existe config.json ni config.example.json')
    copyFileSync(TEMPLATE_PATH, CONFIG_PATH)
  }
  return loadJson(CONFIG_PATH)
}

function writeConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

function getPath(config, segments) {
  let node = config
  for (const segment of segments) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[segment]
  }
  return node
}

function setPath(config, segments, value) {
  let node = config
  for (const segment of segments.slice(0, -1)) {
    if (node[segment] === null || typeof node[segment] !== 'object') node[segment] = {}
    node = node[segment]
  }
  node[segments.at(-1)] = value
}

function readSetting(config, key) {
  const value = getPath(config, PATHS[key])
  return value === undefined ? DEFAULTS[key] : value
}

function formatValue(key, value) {
  return BOOL_KEYS.includes(key) ? (value ? 'true' : 'false') : String(value ?? '')
}

function listOwners(config) {
  const numbers = Array.isArray(config?.owner?.numbers) ? config.owner.numbers : []
  const names = config?.owner?.names && typeof config.owner.names === 'object' ? config.owner.names : {}
  return numbers.map((phone) => ({ phone: String(phone), name: String(names[phone] || 'Owner') }))
}

function listMods(config) {
  const mods = Array.isArray(config?.owner?.mods) ? config.owner.mods : []
  return mods.map((phone) => String(phone))
}

function normalizePhone(phone = '') {
  return String(phone || '').replace(/\D/g, '')
}

function checkPhone(digits) {
  if (!/^\d{8,15}$/.test(digits)) fail('Número no válido (8-15 dígitos con código de país).')
}

function safeName(name) {
  return String(name || 'Owner').replace(/["\\\n]/g, ' ').trim().slice(0, 40) || 'Owner'
}

function cmdList() {
  const config = readConfig()
  for (const key of ALL_KEYS) console.log(`${key}=${formatValue(key, readSetting(config, key))}`)
  listOwners(config).forEach((o, i) => console.log(`owner.${i}=${o.phone}|${o.name}`))
  listMods(config).forEach((m, i) => console.log(`mod.${i}=${m}`))
}

function cmdGet(rawKey) {
  const key = resolveKey(rawKey)
  console.log(`${key}=${formatValue(key, readSetting(readConfig(), key))}`)
}

function cmdSet(rawKey, ...rest) {
  const key = resolveKey(rawKey)
  if (!rest.length && key !== 'botBanner') fail('Falta el valor.')
  let value = rest.join(' ').trim()
  if (BOOL_KEYS.includes(key)) value = parseBool(value)
  if (key === 'botBanner' && value !== '' && !/^(https?:\/\/|\.{0,2}\/|[A-Za-z]:[\\/]|~\/|\/)/.test(value)) {
    fail('Banner no válido: usa una ruta (./storage/...) o una URL https://')
  }
  const config = ensureWritableConfig()
  setPath(config, PATHS[key], value)
  writeConfig(config)
  console.log(`${key}=${formatValue(key, value)}`)
}

function cmdOwners() {
  const owners = listOwners(readConfig())
  if (!owners.length) console.log('# (sin owners)')
  owners.forEach((o, i) => console.log(`owner.${i}=${o.phone}|${o.name}`))
}

function cmdMods() {
  const mods = listMods(readConfig())
  if (!mods.length) console.log('# (sin mods)')
  mods.forEach((m, i) => console.log(`mod.${i}=${m}`))
}

function cmdOwnerAdd(phone, name) {
  const digits = normalizePhone(phone)
  checkPhone(digits)
  const config = ensureWritableConfig()
  if (!Array.isArray(config.owner?.numbers)) {
    if (config.owner === null || typeof config.owner !== 'object') config.owner = {}
    config.owner.numbers = []
  }
  if (config.owner.names === null || typeof config.owner.names !== 'object') config.owner.names = {}
  if (!config.owner.numbers.includes(digits)) config.owner.numbers.push(digits)
  config.owner.names[digits] = safeName(name)
  writeConfig(config)
  console.log(`ok=owner ${phone} agregado`)
}

function cmdOwnerDel(phone) {
  const digits = normalizePhone(phone)
  const config = ensureWritableConfig()
  const before = Array.isArray(config.owner?.numbers) ? config.owner.numbers.length : 0
  if (Array.isArray(config.owner?.numbers)) {
    config.owner.numbers = config.owner.numbers.filter((n) => String(n) !== digits)
  }
  if (config.owner?.names && typeof config.owner.names === 'object') delete config.owner.names[digits]
  const removed = before - (Array.isArray(config.owner?.numbers) ? config.owner.numbers.length : 0)
  if (!removed) fail(`Ese número no está en owners: ${phone}`)
  writeConfig(config)
  console.log(`ok=owner ${phone} eliminado`)
}

function cmdModAdd(phone) {
  const digits = normalizePhone(phone)
  checkPhone(digits)
  const config = ensureWritableConfig()
  if (!Array.isArray(config.owner?.mods)) {
    if (config.owner === null || typeof config.owner !== 'object') config.owner = {}
    config.owner.mods = []
  }
  if (!config.owner.mods.includes(digits)) config.owner.mods.push(digits)
  writeConfig(config)
  console.log(`ok=mod ${phone} agregado`)
}

function cmdModDel(phone) {
  const digits = normalizePhone(phone)
  const config = ensureWritableConfig()
  const before = Array.isArray(config.owner?.mods) ? config.owner.mods.length : 0
  if (Array.isArray(config.owner?.mods)) {
    config.owner.mods = config.owner.mods.filter((n) => String(n) !== digits)
  }
  const removed = before - (Array.isArray(config.owner?.mods) ? config.owner.mods.length : 0)
  if (!removed) fail(`Ese número no está en mods: ${phone}`)
  writeConfig(config)
  console.log(`ok=mod ${phone} eliminado`)
}

function main() {
  const [cmd, ...args] = process.argv.slice(2)
  switch ((cmd || 'list').toLowerCase()) {
    case 'list': return cmdList()
    case 'get': return cmdGet(args[0])
    case 'set': return cmdSet(args[0], ...args.slice(1))
    case 'owners': return cmdOwners()
    case 'mods': return cmdMods()
    case 'owner-add': return cmdOwnerAdd(args[0], args.slice(1).join(' ') || 'Owner')
    case 'owner-del': return cmdOwnerDel(args[0])
    case 'mod-add': return cmdModAdd(args[0])
    case 'mod-del': return cmdModDel(args[0])
    default:
      console.error(`✖ Comando desconocido: ${cmd}`)
      console.error('  Usa: list | get | set | owners | mods | owner-add | owner-del | mod-add | mod-del')
      process.exit(1)
  }
}

try {
  main()
} catch (error) {
  console.error(`✖ ${error?.message || error}`)
  process.exit(1)
}
