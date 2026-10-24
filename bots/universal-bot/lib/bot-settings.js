/**
 * bot-settings.js — Lectura/escritura de la personalización del bot en config.js.
 *
 * Funciones puras (sin dependencias de Baileys) para que la terminal Termux
 * pueda editar: nombre, stickers (pack/autor), moneda, banner, owners, mods
 * y los interruptores (comandos, reenviados, modo de respuesta, menú lista,
 * modo público).
 *
 * Usado por scripts/bot-settings.js (CLI para termux.sh).
 */
import { normalizeOwnerPhone, isValidOwnerPhone, OWNER_PLACEHOLDER } from './config-repair.js'

export const STRING_KEYS = ['namebot', 'packname', 'author', 'moneda', 'botBanner']
export const BOOL_KEYS = ['comandosEnabled', 'mensajesReenviados', 'quotedVerificado', 'menuLista', 'modoPublico']
export const ALL_KEYS = [...STRING_KEYS, ...BOOL_KEYS]

const DEFAULTS = {
  namebot: 'UNIVERSAL BOT',
  packname: 'UNIVERSAL BOT',
  author: 'MultiBot',
  moneda: 'USD',
  botBanner: '',
  comandosEnabled: true,
  mensajesReenviados: true,
  quotedVerificado: true,
  menuLista: false,
  modoPublico: true,
}

export function settingDefault(key) {
  return DEFAULTS[key]
}

/** Escapa un valor para escribirlo como string JS con comillas simples. */
export function jsString(value = '') {
  const clean = String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120)
  return `'${clean.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Lee un ajuste escalar. Devuelve { present, value }. */
export function readSetting(source = '', key = '') {
  const text = String(source)
  if (!ALL_KEYS.includes(key)) return { present: false, value: undefined }
  const match = text.match(new RegExp(`^global\\.${key}\\s*=\\s*(.+?)\\s*$`, 'm'))
  if (!match) return { present: false, value: DEFAULTS[key] }
  const raw = match[1].replace(/;$/, '').trim()
  if (BOOL_KEYS.includes(key)) {
    return { present: true, value: raw === 'true' }
  }
  const str = raw.match(/^(['"`])([\s\S]*)\1$/)
  if (!str) return { present: true, value: raw }
  const quote = str[1]
  return { present: true, value: str[2].replace(/\\(.)/g, quote === "'" ? "$1" : '$1') }
}

/** Escribe (o agrega) un ajuste escalar. Devuelve el source nuevo. */
export function setSetting(source = '', key = '', value = '') {
  if (!ALL_KEYS.includes(key)) throw new Error(`Ajuste desconocido: ${key}`)
  const text = String(source)
  const literal = BOOL_KEYS.includes(key) ? (value === true || value === 'true' ? 'true' : 'false') : jsString(value)
  const linePattern = new RegExp(`^global\\.${key}\\s*=\\s*.+$`, 'm')
  if (linePattern.test(text)) {
    return text.replace(linePattern, `global.${key} = ${literal}`)
  }
  // No existe: insertarlo antes del watcher de config, o al final.
  const anchor = '\nlet file = fileURLToPath(import.meta.url)'
  const block = `\n// Personalización (termux.sh)\nglobal.${key} = ${literal}\n`
  if (text.includes(anchor)) return text.replace(anchor, `${block}${anchor}`)
  return `${text.replace(/\s*$/, '')}\n${block}`
}

/** Lee todos los ajustes escalares. */
export function readAllSettings(source = '') {
  const out = {}
  for (const key of ALL_KEYS) out[key] = readSetting(source, key).value
  return out
}

// ── Owners (global.owner = [['tel','nombre',true], ...]) ──────────

function extractArrayBlock(source, key) {
  const text = String(source)
  const pattern = new RegExp(`global\\.${key}\\s*=\\s*\\[`)
  const match = pattern.exec(text)
  if (!match) return null
  let depth = 0
  let quote = ''
  for (let i = match.index + match[0].length - 1; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') { i += 1; continue }
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        return { start: match.index, end: i + 1, inner: text.slice(match.index + match[0].length, i) }
      }
    }
  }
  return null
}

function formatOwnerBlock(entries) {
  if (!entries.length) return 'global.owner = []'
  const rows = entries.map((e) => `  ['${e.phone}', ${JSON.stringify(e.name)}, true],`).join('\n')
  return `global.owner = [\n${rows}\n]`
}

export function listOwners(source = '') {
  const block = extractArrayBlock(source, 'owner')
  if (!block) return []
  const entries = []
  const rowPattern = /\[\s*['"`]([^'"`]*?)['"`]\s*,\s*['"`]([^'"`]*?)['"`]/g
  let row
  while ((row = rowPattern.exec(block.inner)) !== null) {
    if (OWNER_PLACEHOLDER.test(row[1])) continue // número de ejemplo sin configurar
    const phone = normalizeOwnerPhone(row[1])
    if (!phone) continue
    entries.push({ phone, name: row[2] || '' })
  }
  return entries
}

/**
 * Agrega (o actualiza) un owner. Si solo existe el número de ejemplo,
 * lo reemplaza en vez de duplicar.
 */
export function addOwner(source = '', phone = '', name = 'Owner') {
  const digits = normalizeOwnerPhone(phone)
  if (!isValidOwnerPhone(digits)) throw new Error('Número no válido (8-15 dígitos con código de país).')
  const safeName = String(name || 'Owner').replace(/['"\\\n]/g, ' ').trim().slice(0, 40) || 'Owner'
  let entries = listOwners(source).filter((e) => !OWNER_PLACEHOLDER.test(e.phone))
  const existing = entries.find((e) => e.phone === digits)
  if (existing) existing.name = safeName
  else entries.push({ phone: digits, name: safeName })
  const block = extractArrayBlock(source, 'owner')
  const replacement = formatOwnerBlock(entries)
  const text = String(source)
  if (!block) {
    const anchor = '\nlet file = fileURLToPath(import.meta.url)'
    if (text.includes(anchor)) return text.replace(anchor, `\n${replacement}\n${anchor}`)
    return `${text.replace(/\s*$/, '')}\n${replacement}\n`
  }
  return `${text.slice(0, block.start)}${replacement}${text.slice(block.end)}`
}

export function removeOwner(source = '', phone = '') {
  const digits = normalizeOwnerPhone(phone)
  const entries = listOwners(source).filter((e) => e.phone !== digits)
  const removed = listOwners(source).length - entries.length
  const block = extractArrayBlock(source, 'owner')
  if (!block) return { source: String(source), removed: 0 }
  const text = String(source)
  return {
    source: `${text.slice(0, block.start)}${formatOwnerBlock(entries)}${text.slice(block.end)}`,
    removed,
  }
}

// ── Mods/admins (global.mods = ['tel', ...]) ───────────────────────

function formatModsBlock(entries) {
  if (!entries.length) return 'global.mods = []'
  return `global.mods = [${entries.map((p) => `'${p}'`).join(', ')}]`
}

export function listMods(source = '') {
  const block = extractArrayBlock(source, 'mods')
  if (!block) return []
  const entries = []
  const itemPattern = /['"`]([^'"`]+)['"`]/g
  let item
  while ((item = itemPattern.exec(block.inner)) !== null) {
    const phone = normalizeOwnerPhone(item[1])
    if (phone && !entries.includes(phone)) entries.push(phone)
  }
  return entries
}

export function addMod(source = '', phone = '') {
  const digits = normalizeOwnerPhone(phone)
  if (!isValidOwnerPhone(digits)) throw new Error('Número no válido (8-15 dígitos con código de país).')
  const entries = listMods(source)
  if (!entries.includes(digits)) entries.push(digits)
  const block = extractArrayBlock(source, 'mods')
  const replacement = formatModsBlock(entries)
  const text = String(source)
  if (!block) {
    const anchor = '\nlet file = fileURLToPath(import.meta.url)'
    if (text.includes(anchor)) return text.replace(anchor, `\n${replacement}\n${anchor}`)
    return `${text.replace(/\s*$/, '')}\n${replacement}\n`
  }
  return `${text.slice(0, block.start)}${replacement}${text.slice(block.end)}`
}

export function removeMod(source = '', phone = '') {
  const digits = normalizeOwnerPhone(phone)
  const entries = listMods(source).filter((p) => p !== digits)
  const removed = listMods(source).length - entries.length
  const block = extractArrayBlock(source, 'mods')
  if (!block) return { source: String(source), removed: 0 }
  const text = String(source)
  return {
    source: `${text.slice(0, block.start)}${formatModsBlock(entries)}${text.slice(block.end)}`,
    removed,
  }
}

export { normalizeOwnerPhone, isValidOwnerPhone }
