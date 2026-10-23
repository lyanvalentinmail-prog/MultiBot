import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

// Owner — cámbialo por tu número
global.owner = [
  ['521XXXXXXXXXX', 'TuNombre', true]
]
global.ownerLid = [
  ['XXXXXXXXXXXXXXX', 'TuNombre', true] // saca con .id en privado
]

global.packname = 'MultiBot'
global.namebot = 'TEMPLATE BOT'
global.author = 'MultiBot'
global.moneda = 'USD'
global.sessions = 'sessions'
global.prefix = '.'

global.canal = { jid: '120363405059433072@newsletter', name: 'MultiBot' }
global.ch = { ch1: '120363405059433072@newsletter' }
global.logssubbots = ''

global.APIs = {
  delirius: { url: 'https://api.delirius.online', key: null }
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
