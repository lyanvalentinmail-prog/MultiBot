import add from './add.js'
import attp from './attp.js'
import brat from './brat.js'
import chatgpt from './chatgpt.js'
import close from './close.js'
import dado from './dado.js'
import debug from './debug.js'
import deepseek from './deepseek.js'
import demote from './demote.js'
import emojimix from './emojimix.js'
import fb from './fb.js'
import gemini from './gemini.js'
import gif from './gif.js'
import help from './help.js'
import infogrupo from './infogrupo.js'
import instagram from './instagram.js'
import kick from './kick.js'
import lyrics from './lyrics.js'
import moneda from './moneda.js'
import open from './open.js'
import pack from './pack.js'
import pinterest from './pinterest.js'
import promote from './promote.js'
import search from './search.js'
import searchpack from './searchpack.js'
import sticker from './sticker.js'
import tagall from './tagall.js'
import take from './take.js'
import tiktok from './tiktok.js'
import timer from './timer.js'
import toimg from './toimg.js'
import tovideo from './tovideo.js'
import ttp from './ttp.js'
import ytmp3 from './ytmp3.js'
import ytmp4 from './ytmp4.js'

export const commandList = [
  tiktok,
  instagram,
  pinterest,
  ytmp3,
  ytmp4,
  fb,
  brat,
  attp,
  ttp,
  sticker,
  gif,
  search,
  searchpack,
  toimg,
  tovideo,
  take,
  kick,
  promote,
  demote,
  add,
  tagall,
  open,
  close,
  infogrupo,
  emojimix,
  pack,
  gemini,
  chatgpt,
  deepseek,
  dado,
  moneda,
  timer,
  lyrics,
  help,
  debug
]

/** Comandos que NO se muestran en el menú */
export const visibleCommands = commandList.filter((command) => !command.hidden)

/** Mapa nombre/alias -> comando */
export const commands = new Map()

for (const command of commandList) {
  if (!command?.name || typeof command.run !== 'function') {
    throw new Error(`Comando inválido: ${command?.name || 'sin nombre'}`)
  }
  if (commands.has(command.name)) throw new Error(`Comando duplicado: ${command.name}`)
  commands.set(command.name, command)
  for (const alias of command.aliases || []) {
    if (commands.has(alias)) throw new Error(`Alias duplicado: ${alias}`)
    commands.set(alias, command)
  }
}

export function findCommand(name) {
  if (!name) return null
  return commands.get(String(name).toLowerCase()) || null
}

export function isCommandRegistered(command) {
  return commandList.includes(command)
}

export default commands
