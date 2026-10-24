#!/usr/bin/env node
/**
 * Asistente de configuración inicial de TomiOka (sin dependencias).
 *
 *   npm run setup -- --owner 59899123456 --name "Mi Nombre" --yes
 *
 * Lee config.json (o config.example.json si no existe), guarda el número
 * del owner (+ LID opcional) y el nombre del bot en config.json.
 * Hace respaldo config.json.bak si ya existía uno.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_FILE = path.join(ROOT, 'config.json')
const EXAMPLE_FILE = path.join(ROOT, 'config.example.json')

function parseArgs(argv) {
  const options = { owner: '', name: '', lid: '', yes: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--owner' || arg === '--phone') options.owner = argv[i + 1] || ''
    else if (arg === '--name') options.name = argv[i + 1] || ''
    else if (arg === '--lid') options.lid = argv[i + 1] || ''
    else if (arg === '--yes' || arg === '-y') options.yes = true
    else if (arg === '--help' || arg === '-h') options.help = true
    if (['--owner', '--phone', '--name', '--lid'].includes(arg)) i += 1
  }
  return options
}

function digits(raw) {
  return String(raw || '').replace(/\D/g, '')
}

function validPhone(phone) {
  return phone.length >= 8 && phone.length <= 15
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('Uso: npm run setup -- --owner 59899123456 --name "Nombre" [--lid N] [--yes]')
    return
  }

  const owner = digits(options.owner)
  if (!validPhone(owner)) {
    console.error('✖ Falta un número de owner válido: --owner 59899123456 (8-15 dígitos con código de país).')
    process.exit(1)
  }

  let base = {}
  if (existsSync(CONFIG_FILE)) base = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
  else if (existsSync(EXAMPLE_FILE)) base = JSON.parse(readFileSync(EXAMPLE_FILE, 'utf8'))

  const lid = digits(options.lid)
  const numbers = [owner]
  if (lid && validPhone(lid) && lid !== owner) numbers.push(lid)

  const next = {
    ...base,
    bot: { ...(base.bot || {}), ...(options.name ? { name: options.name } : {}) },
    owner: { ...(base.owner || {}), numbers },
  }

  if (existsSync(CONFIG_FILE)) copyFileSync(CONFIG_FILE, `${CONFIG_FILE}.bak`)
  writeFileSync(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`✅ config.json guardado (owner: ${numbers.join(', ')})`)
  if (options.name) console.log(`   nombre del bot: ${options.name}`)
}

main()
