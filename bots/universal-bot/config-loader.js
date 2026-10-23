import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const botDir = path.dirname(fileURLToPath(import.meta.url))
const privateConfig = path.join(botDir, 'config.js')
const templateConfig = path.join(botDir, 'config.example.js')
const selectedConfig = existsSync(privateConfig) ? privateConfig : templateConfig

// config.js is intentionally gitignored. A clean Render deploy uses the safe example
// defaults, then accepts only explicitly prefixed runtime environment variables.
await import(pathToFileURL(selectedConfig).href)

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
