/**
 * Termux Guard - Universal Bot
 * Este bot está configurado para ejecutarse EXCLUSIVAMENTE en Termux (Android)
 * 
 * Bypass para desarrollo/testing:
 *  - Variable de entorno: ALLOW_NON_TERMUX=1
 *  - Argumento CLI: --allow-non-termux o --force
 */

import { existsSync } from 'fs'
import chalk from 'chalk'

export function isTermuxEnvironment() {
  // Bypass explícito para desarrollo
  if (process.env.ALLOW_NON_TERMUX === '1' || process.env.ALLOW_NON_TERMUX === 'true') return true
  if (process.argv.includes('--allow-non-termux') || process.argv.includes('--force') || process.argv.includes('--no-termux-check')) return true

  // Checks de Termux
  if (process.env.TERMUX_VERSION) return true
  if (process.env.TERMUX_APP__PID) return true
  if (process.env.PREFIX && String(process.env.PREFIX).includes('com.termux')) return true
  if (process.env.HOME && String(process.env.HOME).includes('com.termux')) return true

  // Paths típicos de Termux
  try {
    if (existsSync('/data/data/com.termux')) return true
    if (existsSync('/data/data/com.termux/files/usr/bin/bash')) return true
    if (existsSync('/data/data/com.termux/files/usr/bin/pkg')) return true
  } catch {}

  return false
}

export function enforceTermuxOnly() {
  if (isTermuxEnvironment()) {
    console.log(chalk.green('✓ Entorno Termux detectado - iniciando bot...'))
    return true
  }

  console.log(chalk.red.bold('\n╔════════════════════════════════════════════════════╗'))
  console.log(chalk.red.bold('║  ✖ ESTE BOT SOLO PUEDE EJECUTARSE EN TERMUX      ║'))
  console.log(chalk.red.bold('╚════════════════════════════════════════════════════╝'))
  console.log(chalk.yellow('\n Universal Bot está configurado para Termux (Android) únicamente.\n'))
  console.log(chalk.cyan(' Para ejecutarlo en Termux:'))
  console.log(chalk.white('  1. Instala Termux desde F-Droid: https://f-droid.org/es/packages/com.termux/'))
  console.log(chalk.white('  2. Abre Termux y ejecuta:'))
  console.log(chalk.gray('     pkg update && pkg upgrade -y'))
  console.log(chalk.gray('     pkg install git nodejs -y'))
  console.log(chalk.gray('     git clone https://github.com/tu-usuario/MultiBot.git'))
  console.log(chalk.gray('     cd MultiBot/bots/universal-bot'))
  console.log(chalk.gray('     npm install'))
  console.log(chalk.gray('     npm start'))
  console.log(chalk.yellow('\n Bypass solo para desarrollo (no recomendado):'))
  console.log(chalk.gray('  ALLOW_NON_TERMUX=1 npm start'))
  console.log(chalk.gray('  node main.js --allow-non-termux'))
  console.log(chalk.red('\n Saliendo...\n'))
  process.exit(1)
}

export default { isTermuxEnvironment, enforceTermuxOnly }
