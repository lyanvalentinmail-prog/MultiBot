#!/usr/bin/env node
/**
 * bot-settings.js — CLI de personalización para termux.sh (sin dependencias
 * de Baileys, corre con `node` pelado).
 *
 *   node scripts/bot-settings.js list
 *   node scripts/bot-settings.js get <ajuste>
 *   node scripts/bot-settings.js set <ajuste> <valor>
 *   node scripts/bot-settings.js owners | mods
 *   node scripts/bot-settings.js owner-add <teléfono> [nombre]
 *   node scripts/bot-settings.js owner-del <teléfono>
 *   node scripts/bot-settings.js mod-add <teléfono>
 *   node scripts/bot-settings.js mod-del <teléfono>
 *
 * Ajustes: namebot, packname, author, moneda, botBanner,
 *   comandosEnabled, mensajesReenviados, quotedVerificado, menuBotones,
 *   menuBotonesLayout, modoPublico
 * Alias: nombre, stickers-pack/nombre-stickers, stickers-autor/autor-stickers,
 *   banner, comandos, reenviados, respuesta (estado|responder),
 *   menu-botones (menu-lista), menu-layout, publico/modo-publico
 *
 * Variables: BOT_SETTINGS_CONFIG=<ruta config.js> (para pruebas).
 * Salida pensada para bash: líneas `clave=valor`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALL_KEYS,
  BOOL_KEYS,
  addMod,
  addOwner,
  listMods,
  listOwners,
  readAllSettings,
  readSetting,
  removeMod,
  removeOwner,
  setSetting,
} from '../lib/bot-settings.js'

const botDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = process.env.BOT_SETTINGS_CONFIG || path.join(botDir, 'config.js')
const TEMPLATE_PATH = path.join(botDir, 'config.example.js')

const ALIASES = {
  nombre: 'namebot',
  'nombre-bot': 'namebot',
  'stickers-pack': 'packname',
  'nombre-stickers': 'packname',
  pack: 'packname',
  'stickers-autor': 'author',
  'autor-stickers': 'author',
  autor: 'author',
  moneda: 'moneda',
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
  'modo-publico': 'modoPublico',
}
for (const key of ALL_KEYS) ALIASES[key.toLowerCase()] = key

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
  console.error(`✖ Valor no válido: ${raw} (usa on/off)`)
  process.exit(1)
}

function readSource() {
  if (existsSync(CONFIG_PATH)) return readFileSync(CONFIG_PATH, 'utf8')
  if (existsSync(TEMPLATE_PATH)) return readFileSync(TEMPLATE_PATH, 'utf8')
  console.error('✖ No existe config.js ni config.example.js')
  process.exit(1)
}

function ensureWritableSource() {
  if (!existsSync(CONFIG_PATH)) {
    if (!existsSync(TEMPLATE_PATH)) {
      console.error('✖ No existe config.js ni config.example.js')
      process.exit(1)
    }
    writeFileSync(CONFIG_PATH, readFileSync(TEMPLATE_PATH, 'utf8'))
    console.log('# config.js creado desde config.example.js')
  }
  return readFileSync(CONFIG_PATH, 'utf8')
}

function writeSource(next) {
  writeFileSync(CONFIG_PATH, next.endsWith('\n') ? next : `${next}\n`)
}

function cmdList() {
  const source = readSource()
  const all = readAllSettings(source)
  for (const key of ALL_KEYS) console.log(`${key}=${all[key]}`)
  listOwners(source).forEach((o, i) => console.log(`owner.${i}=${o.phone}|${o.name}`))
  listMods(source).forEach((m, i) => console.log(`mod.${i}=${m}`))
}

function cmdGet(rawKey) {
  const key = resolveKey(rawKey)
  console.log(`${key}=${readSetting(readSource(), key).value}`)
}

function cmdSet(rawKey, ...rest) {
  const key = resolveKey(rawKey)
  if (!rest.length && key !== 'botBanner') {
    console.error('✖ Falta el valor.')
    process.exit(1)
  }
  let value = rest.join(' ').trim()
  if (BOOL_KEYS.includes(key)) value = parseBool(value)
  if (key === 'botBanner' && value !== '' && !/^(https?:\/\/|\.{0,2}\/|[A-Za-z]:[\\/]|~\/|\/)/.test(value)) {
    console.error('✖ Banner no válido: usa una ruta (./storage/...) o una URL https://')
    process.exit(1)
  }
  const next = setSetting(ensureWritableSource(), key, value)
  writeSource(next)
  console.log(`${key}=${BOOL_KEYS.includes(key) ? (value ? 'true' : 'false') : value}`)
}

function cmdOwners() {
  const owners = listOwners(readSource())
  if (!owners.length) console.log('# (sin owners)')
  owners.forEach((o, i) => console.log(`owner.${i}=${o.phone}|${o.name}`))
}

function cmdMods() {
  const mods = listMods(readSource())
  if (!mods.length) console.log('# (sin mods)')
  mods.forEach((m, i) => console.log(`mod.${i}=${m}`))
}

function main() {
  const [cmd, ...args] = process.argv.slice(2)
  switch ((cmd || 'list').toLowerCase()) {
    case 'list': return cmdList()
    case 'get': return cmdGet(args[0])
    case 'set': return cmdSet(args[0], ...args.slice(1))
    case 'owners': return cmdOwners()
    case 'mods': return cmdMods()
    case 'owner-add': {
      const next = addOwner(ensureWritableSource(), args[0], args.slice(1).join(' ') || 'Owner')
      writeSource(next)
      console.log(`ok=owner ${args[0]} agregado`)
      return
    }
    case 'owner-del': {
      const { source, removed } = removeOwner(ensureWritableSource(), args[0])
      if (!removed) { console.error(`✖ Ese número no está en owners: ${args[0]}`); process.exit(1) }
      writeSource(source)
      console.log(`ok=owner ${args[0]} eliminado`)
      return
    }
    case 'mod-add': {
      writeSource(addMod(ensureWritableSource(), args[0]))
      console.log(`ok=mod ${args[0]} agregado`)
      return
    }
    case 'mod-del': {
      const { source, removed } = removeMod(ensureWritableSource(), args[0])
      if (!removed) { console.error(`✖ Ese número no está en mods: ${args[0]}`); process.exit(1) }
      writeSource(source)
      console.log(`ok=mod ${args[0]} eliminado`)
      return
    }
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
