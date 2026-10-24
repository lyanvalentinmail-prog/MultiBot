/**
 * Registro de comandos de Izuku.
 *
 * Los comandos NO viven aquí: están en la carpeta única `commands/` de la
 * raíz del repo. Este módulo solo carga los que declara
 * `bots/izuku-bot/commands.json` y arma el mapa nombre/alias → comando.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBotCommands } from '../../../lib/commands.js'

const BOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const registry = await loadBotCommands(BOT_DIR)

export const commandList = registry.commandList
export const visibleCommands = registry.visibleCommands
export const commands = registry.commands
export const findCommand = registry.findCommand
export const isCommandRegistered = registry.isCommandRegistered
export const manifest = registry.manifest

export default registry
