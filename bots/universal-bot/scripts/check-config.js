#!/usr/bin/env node
/**
 * Valida `config.js` del Universal Bot.
 *
 * Uso:
 *   node scripts/check-config.js          # informa y sale con código 1 si está roto
 *   node scripts/check-config.js --fix    # repara ruido de shell (npm start pegado…)
 *   node scripts/check-config.js --json   # salida legible por otras herramientas
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { hasPlaceholderOwner, repairConfigSource } from '../lib/config-repair.js'

const botDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CONFIG_PATH = path.join(botDir, 'config.js')
const TEMPLATE_PATH = path.join(botDir, 'config.example.js')

/** Error de sintaxis legible ('' si el archivo es válido). */
export function syntaxProblem(file) {
  if (!existsSync(file)) return ''
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 30000 })
  if (result.status === 0) return ''
  const output = `${result.stderr || ''}${result.stdout || ''}`.trim()
  return output || 'El archivo no es JavaScript válido.'
}

export function inspectConfig({ file = CONFIG_PATH, template = TEMPLATE_PATH } = {}) {
  const exists = existsSync(file)
  if (!exists) {
    return { exists: false, ok: false, reason: 'missing', file, template, message: 'No existe config.js; se usará config.example.js.' }
  }
  let source = ''
  try { source = readFileSync(file, 'utf8') } catch (error) {
    return { exists: true, ok: false, reason: 'unreadable', file, message: `No se pudo leer config.js: ${error.message}` }
  }
  if (!source.trim()) {
    return { exists: true, ok: false, reason: 'empty', file, message: 'config.js está vacío.' }
  }
  const syntax = syntaxProblem(file)
  if (syntax) {
    return { exists: true, ok: false, reason: 'syntax', file, syntax, placeholderOwner: hasPlaceholderOwner(source), message: 'config.js tiene un error de sintaxis.' }
  }
  return {
    exists: true, ok: true, reason: 'ok', file,
    placeholderOwner: hasPlaceholderOwner(source),
    message: hasPlaceholderOwner(source)
      ? 'config.js es válido pero conserva el número de ejemplo (XXXXXXXXXX). Ejecuta: npm run setup'
      : 'config.js es válido.',
  }
}

export function repairConfigFile({ file = CONFIG_PATH, backup = true } = {}) {
  if (!existsSync(file)) return { repaired: false, reason: 'missing' }
  const source = readFileSync(file, 'utf8')
  const { changed, source: next } = repairConfigSource(source)
  if (!changed) return { repaired: false, reason: 'nothing-to-fix' }
  writeFileSync(file, next.endsWith('\n') ? next : `${next}\n`)
  const syntax = syntaxProblem(file)
  if (syntax) {
    // La reparación no bastó: se restaura el original para no perder información.
    writeFileSync(file, source)
    return { repaired: false, reason: 'still-broken', syntax }
  }
  let backupPath = ''
  if (backup) {
    backupPath = `${file}.bak`
    copyFileSync(file, backupPath)
  }
  return { repaired: true, backupPath }
}

function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const fix = args.includes('--fix')
  const force = args.includes('--force')

  let result = inspectConfig()
  let repair = null
  if (!result.ok && fix && ['syntax', 'empty'].includes(result.reason)) {
    repair = repairConfigFile()
    result = inspectConfig()
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ ...result, repair }, null, 2)}\n`)
  } else if (result.ok && !result.placeholderOwner) {
    console.log('✓ config.js válido. Para editar owner/API keys sin romper nada: npm run setup')
  } else if (result.ok) {
    console.log(`! ${result.message}`)
    if (!force) process.exitCode = 0
  } else {
    console.error('\n✖ Problema en bots/universal-bot/config.js\n')
    if (result.syntax) {
      const lines = result.syntax.split('\n').slice(0, 6).join('\n')
      console.error(lines)
      console.error('')
    }
    if (repair?.repaired) {
      console.log('✓ Se eliminó el texto de shell pegado por error. config.js ahora es válido.')
      console.log(`  Copia de seguridad: ${path.basename(repair.backupPath)}`)
    } else if (result.reason === 'missing' || result.reason === 'empty' || result.reason === 'syntax') {
      console.error('Causa habitual: comandos de Termux pegados dentro del editor.')
      console.error('Solución rápida (no necesitas nano):')
      console.error('  npm run setup            # asistente: escribe config.js correctamente')
      console.error('  npm run setup -- --fix   # repara el archivo actual si solo tiene ruido')
      console.error('Alternativa manual:')
      console.error('  rm config.js && cp config.example.js config.js')
    } else {
      console.error(result.message)
    }
    if (!repair?.repaired) process.exitCode = 1
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
