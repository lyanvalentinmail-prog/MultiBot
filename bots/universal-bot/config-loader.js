import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import chalk from 'chalk'
import { hasPlaceholderOwner, repairConfigSource } from './lib/config-repair.js'

const botDir = path.dirname(fileURLToPath(import.meta.url))
const privateConfig = path.join(botDir, 'config.js')
const templateConfig = path.join(botDir, 'config.example.js')

function syntaxProblem(file) {
  // Se valida con el propio parser de Node para detectar texto pegado por error
  // (por ejemplo "npm start" dentro de nano) antes de importar el módulo.
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 30000 })
  if (result.status === 0) return ''
  return `${result.stderr || ''}${result.stdout || ''}`.trim()
}

function autoRepairConfig(file) {
  const original = readFileSync(file, 'utf8')
  const { changed, source } = repairConfigSource(original)
  if (!changed) return false
  writeFileSync(file, source.endsWith('\n') ? source : `${source}\n`)
  if (syntaxProblem(file)) {
    writeFileSync(file, original)
    return false
  }
  try { copyFileSync(file, `${file}.bak`) } catch {}
  return true
}

let selectedConfig = existsSync(privateConfig) ? privateConfig : templateConfig
let usingFallback = false

if (selectedConfig === privateConfig) {
  const problem = syntaxProblem(privateConfig)
  if (problem) {
    const repaired = autoRepairConfig(privateConfig)
    if (!repaired) {
      usingFallback = true
      selectedConfig = templateConfig
      const firstLines = problem.split('\n').slice(0, 4).map((line) => `   ${line}`).join('\n')
      console.error('')
      console.error(chalk.yellow.bold('⚠  config.js no es JavaScript válido; se usará config.example.js.'))
      console.error(chalk.gray(firstLines))
      console.error(chalk.cyan('   Arréglalo sin editor:  npm run setup -- --fix'))
      console.error(chalk.cyan('   O restaura el archivo: rm config.js && cp config.example.js config.js'))
      console.error('')
      if (process.env.MULTIBOT_WEB_RUNTIME === '1') {
        throw new Error('config.js inválido: corrige la configuración del bot antes de iniciar el runtime web.')
      }
    } else {
      console.log(chalk.yellow('⚠  Se corrigió texto de shell pegado en config.js (copia en config.js.bak).'))
    }
  } else if (!readFileSync(privateConfig, 'utf8').trim()) {
    usingFallback = true
    selectedConfig = templateConfig
    console.log(chalk.yellow('⚠  config.js está vacío; se usa config.example.js. Ejecuta: npm run setup'))
  }
}

// config.js is intentionally gitignored. A clean Render deploy uses the safe example
// defaults, then accepts only explicitly prefixed runtime environment variables.
await import(pathToFileURL(selectedConfig).href)

if (usingFallback) global.__multibotConfigFallback = true
if (hasPlaceholderOwner(readFileSync(selectedConfig, 'utf8'))) {
  console.log(chalk.yellow('⚠  El owner sigue con el número de ejemplo. Configúralo con: npm run setup'))
}

if (process.env.MULTIBOT_WEB_RUNTIME === '1' && process.env.MULTIBOT_RUNTIME_PROTOCOL === '1') {
  const envPrefix = 'BOT_UNIVERSAL_BOT_'
  const ownerPhone = String(process.env[`${envPrefix}OWNER_PHONE`] || '').replace(/\D/g, '')
  const ownerName = String(process.env[`${envPrefix}OWNER_NAME`] || 'MultiBot Owner').trim().slice(0, 40)
  const ownerLid = String(process.env[`${envPrefix}OWNER_LID`] || '').replace(/[^0-9]/g, '')

  global.owner = ownerPhone ? [[ownerPhone, ownerName, true]] : []
  global.ownerLid = ownerLid ? [[ownerLid, ownerName, true]] : []
  global.canal = String(process.env[`${envPrefix}CANAL_JID`] || '').trim()
  global.sessions = 'sessions'
  global.APIs ||= {}
  global.APIKeys ||= {}

  for (const provider of ['vreden', 'delirius', 'zenzxz', 'siputzx']) {
    const envKey = process.env[`${envPrefix}API_${provider.toUpperCase()}_KEY`] || null
    if (global.APIs[provider]) global.APIs[provider] = { ...global.APIs[provider], key: envKey }
    global.APIKeys[provider] = envKey
    if (global.APIs[provider]?.url) global.APIKeys[global.APIs[provider].url] = envKey
  }
}
