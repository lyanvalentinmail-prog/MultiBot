/**
 * Runtime guard for Universal Bot.
 * Normal installs remain Termux-only; the web mode requires both flags, which
 * are set only by the authenticated MultiBot process manager.
 */
import { existsSync } from 'node:fs'
import chalk from 'chalk'

export function isTermuxEnvironment() {
  // Development-only bypasses retained for existing Termux workflows.
  if (process.env.ALLOW_NON_TERMUX === '1' || process.env.ALLOW_NON_TERMUX === 'true') return true
  if (process.argv.includes('--allow-non-termux') || process.argv.includes('--force') || process.argv.includes('--no-termux-check')) return true

  if (process.env.TERMUX_VERSION) return true
  if (process.env.TERMUX_APP__PID) return true
  if (process.env.PREFIX && String(process.env.PREFIX).includes('com.termux')) return true
  if (process.env.HOME && String(process.env.HOME).includes('com.termux')) return true

  try {
    return ['/data/data/com.termux', '/data/data/com.termux/files/usr/bin/bash', '/data/data/com.termux/files/usr/bin/pkg']
      .some((filePath) => existsSync(filePath))
  } catch { return false }
}

export function isAuthorizedWebRuntime() {
  return process.env.MULTIBOT_WEB_RUNTIME === '1' && process.env.MULTIBOT_RUNTIME_PROTOCOL === '1'
}

export function enforceTermuxOnly() {
  if (isAuthorizedWebRuntime()) {
    console.log(chalk.green('✓ Runtime web autorizado por MultiBot - iniciando bot...'))
    return true
  }
  if (isTermuxEnvironment()) {
    console.log(chalk.green('✓ Entorno Termux detectado - iniciando bot...'))
    return true
  }

  console.log(chalk.red.bold('\n╔════════════════════════════════════════════════════╗'))
  console.log(chalk.red.bold('║  ✖ ESTE BOT REQUIERE TERMUX O EL RUNTIME WEB      ║'))
  console.log(chalk.red.bold('╚════════════════════════════════════════════════════╝'))
  console.log(chalk.yellow('\n Universal Bot debe iniciarse desde Termux o desde el runtime web autorizado del panel.\n'))
  console.log(chalk.cyan(' Para ejecutarlo en Termux:'))
  console.log(chalk.white('  1. Instala Termux desde F-Droid: https://f-droid.org/es/packages/com.termux/'))
  console.log(chalk.white('  2. Abre Termux y ejecuta:'))
  console.log(chalk.gray('     pkg update && pkg upgrade -y'))
  console.log(chalk.gray('     pkg install git nodejs -y'))
  console.log(chalk.gray('     cd MultiBot/bots/universal-bot && npm start'))
  console.log(chalk.red('\n Saliendo...\n'))
  process.exit(1)
}

export default { isTermuxEnvironment, isAuthorizedWebRuntime, enforceTermuxOnly }
