#!/usr/bin/env node
/**
 * Diagnóstico de Universal Bot para Termux.
 *   npm run doctor
 * Revisa Node, dependencias, config.js, sesión y permisos, y dice qué hacer.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectConfig } from './check-config.js'

const botDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rows = []
let failures = 0

function record(label, ok, detail, fix = '') {
  rows.push({ label, ok, detail, fix })
  if (!ok) failures += 1
}

function isTermux() {
  return Boolean(
    process.platform === 'android' ||
    process.env.TERMUX_VERSION ||
    String(process.env.PREFIX || '').includes('com.termux') ||
    String(process.env.HOME || '').includes('com.termux'),
  )
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0])
  record('Node.js', major >= 20, `${process.versions.node} (${process.platform}/${process.arch})`, 'pkg install nodejs-lts')
  record('Entorno', true, isTermux() ? 'Termux detectado' : 'No Termux (usa ALLOW_NON_TERMUX=1 solo para desarrollo)')
}

function checkDependencies() {
  const nodeModules = path.join(botDir, 'node_modules')
  const baileys = path.join(nodeModules, '@whiskeysockets', 'baileys')
  record('Dependencias', existsSync(nodeModules) && existsSync(baileys), existsSync(nodeModules) ? 'node_modules presente' : 'node_modules ausente', 'npm install')
  try {
    readFileSync(path.join(botDir, 'package-lock.json'))
    record('Lockfile', true, 'package-lock.json presente')
  } catch {
    record('Lockfile', false, 'package-lock.json ausente', 'npm install')
  }
}

function checkConfig() {
  const result = inspectConfig()
  if (result.ok && !result.placeholderOwner) {
    record('config.js', true, 'válido y con owner configurado')
    return
  }
  if (result.ok) {
    record('config.js', false, 'válido pero con el número de ejemplo', 'npm run setup')
    return
  }
  const detail = result.reason === 'missing'
    ? 'no existe (se usará config.example.js)'
    : result.reason === 'syntax'
      ? 'error de sintaxis (¿pegaste comandos de Termux dentro del editor?)'
      : result.message
  record('config.js', false, detail, result.reason === 'syntax' ? 'npm run setup -- --fix' : 'npm run setup')
}

function checkSessions() {
  const sessions = path.join(botDir, 'sessions')
  if (!existsSync(sessions)) {
    record('Sesión Baileys', true, 'sin sesión guardada: se pedirá QR o Pairing Code al iniciar')
    return
  }
  try {
    const creds = path.join(sessions, 'creds.json')
    record('Sesión Baileys', true, existsSync(creds) ? 'creds.json presente (reconexión automática)' : 'carpeta sessions sin creds.json (se pedirá vinculación)')
  } catch (error) {
    record('Sesión Baileys', false, `no se pudo leer sessions/: ${error.message}`, 'rm -rf sessions')
  }
}

function checkWritable() {
  try {
    const info = statSync(botDir)
    record('Carpeta del bot', info.isDirectory(), botDir)
    readFileSync(path.join(botDir, 'package.json'))
  } catch (error) {
    record('Carpeta del bot', false, error.message)
  }
}

function checkReadline() {
  record('Entrada interactiva', Boolean(process.stdin.isTTY), process.stdin.isTTY ? 'terminal interactiva' : 'sin TTY: usa `npm run start:raw` con QR/pairing por args o inicia desde una terminal', 'Ejecuta el bot directamente en Termux (sin pipe)')
}

checkNode()
checkDependencies()
checkConfig()
checkSessions()
checkWritable()
checkReadline()

console.log('\n🤖 Universal Bot · diagnóstico\n')
for (const row of rows) {
  console.log(`${row.ok ? '✓' : '✖'} ${row.label.padEnd(20)} ${row.detail}`)
  if (!row.ok && row.fix) console.log(`  → ${row.fix}`)
}
console.log('')
if (failures === 0) {
  console.log('Todo listo. Inicia con: npm start')
} else {
  console.log(`Hay ${failures} punto(s) por revisar. Aplica las sugerencias y vuelve a ejecutar: npm run doctor`)
  process.exitCode = 1
}
