/* Universal Bot — MultiBot
   Copia este archivo como config.js y edítalo:
   cp config.example.js config.js
   nano config.js
*/

import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

// OWNER — pon tu número (código país sin +) y tu LID
// Saca tu LID con .id en privado del bot después del primer inicio
global.owner = [
  ['521XXXXXXXXXX', 'TuNombre', true],
]
global.ownerLid = [
  ['XXXXXXXXXXXXXXX', 'TuNombre', true],
]

global.sessions = 'sessions'
global.bot = 'Serbot'
global.AFBots = true

global.packname = 'UNIVERSAL BOT'
global.namebot = 'UNIVERSAL BOT'
global.author = 'MultiBot'
global.moneda = 'USD'

// ── Personalización (editable desde la terminal: termux.sh → Personalizar bot) ──
// Banner del menú: '' usa el banner por defecto · también acepta ruta local o URL
global.botBanner = ''
// Comandos: false = solo el owner puede usar comandos (el bot no responde a nadie más)
global.comandosEnabled = true
// Reenviado: false = los mensajes del bot NO se ven como "reenviados"
global.mensajesReenviados = true
// Respuesta: true = cita estilo estado · false = responder normal (cita tu mensaje)
global.quotedVerificado = true
// Modo público: true = todos pueden usar el bot (privado y grupos sin alquiler)
// false = modo cerrado (privado solo-owner, grupos necesitan plan de alquiler)
global.modoPublico = true
// Menú lista: true = .menu envía una lista para elegir · false = menú interactivo
global.menuLista = false

// Canal newsletter (opcional) — pon JID @newsletter o deja vacío
// Obtén JID con .canalid <link>
global.canal = ''
global.ch = { ch1: '' }
global.logssubbots = ''

global.baileysInteractive = true

global.mods = []
global.prems = []

global.multiplier = 69
global.maxwarn = '2'

global.APIs = {
  vreden: { url: "https://api.vreden.web.id", key: null },
  delirius: { url: "https://api.delirius.online", key: null },
  zenzxz: { url: "https://api.zenzxz.my.id", key: null },
  siputzx: { url: "https://api.siputzx.my.id", key: null }
}

import { syncRcanalFromConfig } from './lib/newsletter-rcanal.js'
syncRcanalFromConfig()

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
