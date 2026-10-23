import './config.js'
import { enforceTermuxOnly } from './lib/termux-guard.js'
enforceTermuxOnly()
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readdirSync, readFileSync } from 'fs'
import chalk from 'chalk'
import pino from 'pino'
import readline from 'readline'
import qrcode from 'qrcode-terminal'
import ws from 'ws'
import { Boom } from '@hapi/boom'
import { Low, JSONFile } from 'lowdb'
import lodash from 'lodash'
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, jidNormalizedUser, DisconnectReason } from '@whiskeysockets/baileys'
import { protoType, serialize } from './lib/simple.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
global.__dirname = (p) => dirname(fileURLToPath(p || import.meta.url))
protoType(); serialize()

global.opts = {}
global.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#%^&.°]/

// DB simple
global.db = new Low(new JSONFile('storage/databases/database.json'))
global.loadDatabase = async () => {
  if (global.db.READ) return
  global.db.READ = true
  await global.db.read().catch(()=>{})
  global.db.READ = null
  global.db.data = { users: {}, chats: {}, settings: {}, ...(global.db.data||{}) }
  global.db.chain = lodash.chain(global.db.data)
}
await global.loadDatabase()
setInterval(async()=>{ if(global.db.data) await global.db.write() }, 30*1000)

global.authFile = 'sessions'
const { state, saveCreds } = await useMultiFileAuthState(global.authFile)
const { version } = await fetchLatestBaileysVersion()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (t) => new Promise(r=>rl.question(t, r))
const logger = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({ class: 'client' })
logger.level = 'fatal'

const connectionOptions = {
  version, logger, printQRInTerminal: false,
  auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
  browser: Browsers.ubuntu('Chrome'),
  markOnlineOnConnect: true,
}
global.conn = makeWASocket(connectionOptions)
let conn = global.conn

async function handleLogin(){
  if(conn.authState.creds.registered){ console.log(chalk.green('Sesión ya registrada.')); return }
  let method = await question(chalk.green('¿Cómo deseas iniciar sesión? Escribe "qr" o "code":\n'))
  method = method.toLowerCase().trim()
  if(method==='code'){
    let phone = await question(chalk.blue('Número con código país (ej: 521XXXXXXXXXX):\n'))
    phone = phone.replace(/\D/g,'')
    if(conn.ws.readyState===ws.OPEN){
      try{ let code = await conn.requestPairingCode(phone); code = code?.match(/.{1,4}/g)?.join('-') || code; console.log(chalk.cyan('Tu código:', code)) } catch(e){ console.log(chalk.red('Error pairing:', e.message)) }
    } else console.log(chalk.red('Conexión no abierta, reintenta.'))
  } else {
    console.log(chalk.yellow('Generando QR...'))
    conn.ev.on('connection.update', ({qr})=>{ if(qr) qrcode.generate(qr,{small:true}) })
  }
}
await handleLogin()

// Cargar plugins
const pluginFolder = join(__dirname, 'plugins')
global.plugins = {}
for(const f of readdirSync(pluginFolder).filter(x=>x.endsWith('.js'))){
  try{ const mod = await import(join(pluginFolder, f)); global.plugins[f] = mod.default || mod } catch(e){ console.error('plugin',f,e) }
}

// Handler minimalista
conn.ev.on('messages.upsert', async ({messages})=>{
  let m = messages[0]; if(!m) return
  try{
    const { smsg } = await import('../universal-bot/lib/simple.js')
    m = smsg(conn, m) || m; if(!m || !m.text) return
    let usedPrefix = global.prefix.exec(m.text)?.[0] || ''
    let noPrefix = m.text.slice(usedPrefix.length).trim()
    let [command, ...args] = noPrefix.split(/\s+/)
    command = (command||'').toLowerCase()
    let text = args.join(' ')
    for(let name in global.plugins){
      let plugin = global.plugins[name]; if(!plugin.command) continue
      let cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command]
      if(cmds.includes(command)){
        try{ await plugin.call(conn, m, { conn, args, text, usedPrefix, command }) 
        } catch(e){ console.error(e); await conn.sendMessage(m.chat,{text:'Error: '+e.message},{quoted:m}) }
      }
    }
  } catch(e){ console.error(e) }
})

conn.ev.on('connection.update', async (update)=>{
  const {connection, lastDisconnect} = update
  if(connection==='open') console.log(chalk.green('✅ Conectado!'))
  if(connection==='close'){
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
    if(reason !== DisconnectReason.loggedOut) console.log(chalk.yellow('Reconectando...'))
    else console.log(chalk.red('Sesión cerrada, borra sessions/ y re-loguea'))
  }
})
conn.ev.on('creds.update', saveCreds)
console.log(chalk.cyan('Template Bot listo — espera mensajes...'))
