/* Universal Bot — MultiBot
   Este es el config real. Edita tus datos aquí.
   Para actualizar desde el ejemplo: cp config.example.js config.js
*/

import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

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
