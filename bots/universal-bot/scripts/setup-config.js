#!/usr/bin/env node
/**
 * Asistente de configuración (sin nano) para Universal Bot.
 *
 *   npm run setup                       # interactivo
 *   npm run setup -- --fix              # repara un config.js con texto de shell pegado
 *   npm run setup -- --owner 59899123456 --name Ana --lid 1234567890 --yes
 *
 * Escribe bots/universal-bot/config.js a partir de config.example.js y guarda una
 * copia del archivo anterior en config.js.bak.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  applyOwnerSettings,
  hasPlaceholderOwner,
  isValidOwnerPhone,
  readOwnerSettings,
  normalizeOwnerPhone,
  repairConfigSource,
} from '../lib/config-repair.js'

const botDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = path.join(botDir, 'config.js')
const TEMPLATE_PATH = path.join(botDir, 'config.example.js')
const BACKUP_PATH = `${CONFIG_PATH}.bak`

function parseArgs(argv) {
  const options = { fix: false, force: false, yes: false, owner: '', name: '', lid: '', canal: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const nextValue = () => argv[index + 1] ?? ''
    if (arg === '--fix') options.fix = true
    else if (arg === '--force') options.force = true
    else if (arg === '--yes' || arg === '-y') options.yes = true
    else if (arg === '--owner') { options.owner = nextValue(); index += 1 }
    else if (arg === '--name') { options.name = nextValue(); index += 1 }
    else if (arg === '--lid') { options.lid = nextValue(); index += 1 }
    else if (arg === '--canal') { options.canal = nextValue(); index += 1 }
    else if (arg === '--help' || arg === '-h') options.help = true
  }
  return options
}

function help() {
  console.log(`Uso: npm run setup [opciones]

Opciones:
  --owner <número>   Número del owner con código de país (ej. 59899123456)
  --name <nombre>    Nombre visible del owner
  --lid <número>     LID del owner (opcional; lo obtienes con .id en privado)
  --canal <jid>      Canal newsletter (opcional)
  --fix              Repara un config.js con comandos pegados por error
  --force            Sobrescribe sin pedir confirmación
  --yes, -y          Usa valores por defecto sin preguntar
  --help, -h         Muestra esta ayuda`)
}

async function ask(rl, question, { defaultValue = '', validate } = {}) {
  for (;;) {
    const suffix = defaultValue ? ` [${defaultValue}]` : ''
    const answer = (await rl.question(`${question}${suffix}: `)).trim()
    const value = answer || defaultValue
    const error = validate?.(value)
    if (!error) return value
    console.log(`  ! ${error}`)
  }
}

export function writeConfigSource(source, { previous } = {}) {
  if (previous !== undefined && previous !== source) {
    try { writeFileSync(BACKUP_PATH, previous) } catch {}
  }
  writeFileSync(CONFIG_PATH, source.endsWith('\n') ? source : `${source}\n`)
  return CONFIG_PATH
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) return help()

  const previous = existsSync(CONFIG_PATH) ? readFileSync(CONFIG_PATH, 'utf8') : undefined
  const repairedPrevious = previous === undefined ? '' : repairConfigSource(previous)
  const hadShellNoise = previous !== undefined && repairedPrevious.changed
  const template = options.fix && hadShellNoise
    ? repairedPrevious.source
    : existsSync(CONFIG_PATH) && !hadShellNoise
      ? previous
      : readFileSync(TEMPLATE_PATH, 'utf8')

  if (hadShellNoise) console.log('! config.js tenía texto de shell pegado (por ejemplo "npm start"). Se corregirá al guardar.')
  else if (previous === undefined) console.log('· No existía config.js; se creará desde config.example.js.')

  const current = readOwnerSettings(template)
  let phone = normalizeOwnerPhone(options.owner)
  let name = options.name || current.name
  let lid = String(options.lid || '').replace(/\D/g, '')
  let canal = options.canal

  const interactive = Boolean(stdin.isTTY) && !options.yes && !options.owner
  if (interactive) {
    const rl = readline.createInterface({ input: stdin, output: stdout })
    try {
      console.log('\nConfiguración del Universal Bot (Enter acepta el valor entre corchetes)\n')
      phone = normalizeOwnerPhone(await ask(rl, 'Tu número de WhatsApp con código de país (ej. 59899123456)', {
        defaultValue: current.phone,
        validate: (value) => (isValidOwnerPhone(value) ? '' : 'Escribe entre 8 y 15 dígitos, sin + ni espacios.'),
      }))
      name = await ask(rl, 'Tu nombre (para comandos de owner)', { defaultValue: name || 'MultiBot Owner' })
      lid = String(await ask(rl, 'Tu LID (opcional, Enter para omitir)', { defaultValue: lid || current.lid })).replace(/\D/g, '')
      canal = await ask(rl, 'JID del canal newsletter (opcional, Enter para omitir)', { defaultValue: canal || '' })
    } finally {
      rl.close()
    }
  } else {
    if (!options.yes && !isValidOwnerPhone(phone)) {
      console.error('✖ Falta un número válido. Ejemplo:\n  npm run setup -- --owner 59899123456 --name Ana --yes')
      process.exitCode = 1
      return
    }
    name = name || 'MultiBot Owner'
  }

  if (!isValidOwnerPhone(phone) && !current.phone) {
    console.log('! Sin número de owner: el bot arrancará, pero los comandos de owner no funcionarán.')
  }

  // Solo se reescribe el owner si el usuario dio un número o un LID: así una
  // ejecución con --yes no borra la configuración existente.
  let next = isValidOwnerPhone(phone) || lid
    ? applyOwnerSettings(template, { phone, name, lid })
    : template
  if (canal) {
    const safeCanal = String(canal).replace(/['\\\n]/g, '')
    next = next.replace(/global\.canal\s*=\s*'[^']*'/, `global.canal = '${safeCanal}'`)
  }

  if (hasPlaceholderOwner(next)) {
    console.log('! Queda el número de ejemplo. Vuelve a ejecutar `npm run setup` y escribe tu número real.')
  }

  const written = writeConfigSource(next, { previous })
  console.log(`✓ Configuración guardada en ${path.relative(process.cwd(), written) || written}`)
  if (previous !== undefined && previous !== next) console.log(`  Copia del archivo anterior: ${path.basename(BACKUP_PATH)}`)
  console.log(`  Owner: ${isValidOwnerPhone(phone) ? phone : '(sin configurar)'}${lid ? ` · LID ${lid}` : ''}`)
  console.log('\nInicia el bot con: npm start')
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    if (error?.code === 'ABORT_ERR' || /Ctrl\+D|aborted/i.test(String(error?.message || ''))) {
      console.log('\nConfiguración cancelada. No se modificó config.js.')
      process.exitCode = 1
      return
    }
    console.error('No se pudo configurar:', error?.message || error)
    console.error('Alternativa no interactiva: npm run setup -- --owner 59899123456 --name TuNombre --yes')
    process.exitCode = 1
  })
}
