#!/usr/bin/env node
/**
 * Arranque del bot (npm start / npm run qr / npm run pair).
 * Verifica e instala tanto las dependencias locales como las compartidas en la
 * raíz de MultiBot, porque el bot importa módulos de ../../lib.
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ensureBotDependencies } from '../../../scripts/server/ensure-bot-dependencies.js'

const BOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = path.resolve(BOT_ROOT, '../..')

if (!ensureBotDependencies({ botRoot: BOT_ROOT, repoRoot: REPO_ROOT })) process.exit(1)

await import(pathToFileURL(path.join(BOT_ROOT, 'src', 'index.js')).href)
