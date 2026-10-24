import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function readDependencies(packageRoot, logger) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
  } catch (error) {
    logger.error(`❌ No se pudo leer ${path.join(packageRoot, 'package.json')}: ${error.message}`)
    return null
  }
  return Object.keys(manifest.dependencies || {})
}

function isResolvable(packageRoot, name) {
  try {
    const require = createRequire(path.join(packageRoot, 'package.json'))
    require.resolve(name)
    return true
  } catch {
    return false
  }
}

function ensurePackageDependencies(packageRoot, label, runInstall, logger) {
  const dependencies = readDependencies(packageRoot, logger)
  if (!dependencies) return false

  let missing = dependencies.filter((name) => !isResolvable(packageRoot, name))
  if (missing.length === 0) return true

  logger.log(`➜ Faltan dependencias ${label} (${missing.join(', ')}). Instalando...`)
  const result = runInstall(packageRoot)
  if (result?.error || result?.status !== 0) {
    logger.error(`❌ No se pudieron instalar las dependencias ${label}. Ejecuta: cd "${packageRoot}" && npm install`)
    return false
  }

  missing = dependencies.filter((name) => !isResolvable(packageRoot, name))
  if (missing.length > 0) {
    logger.error(`❌ npm install terminó, pero aún faltan dependencias ${label}: ${missing.join(', ')}.`)
    return false
  }

  logger.log(`✅ Dependencias ${label} listas.`)
  return true
}

/**
 * Comprueba e instala tanto las dependencias del bot como las del repo raíz.
 * Los bots Izuku y TomiOka importan módulos compartidos desde ../../lib, así
 * que esas importaciones resuelven sus paquetes desde la raíz de MultiBot.
 */
export function ensureBotDependencies({ botRoot, repoRoot, runInstall, logger = console } = {}) {
  if (!botRoot || !repoRoot) {
    logger.error('❌ Debes indicar las rutas del bot y de la raíz de MultiBot.')
    return false
  }

  const install = runInstall || ((cwd) => spawnSync(
    npm,
    ['install', '--omit=dev', '--no-audit', '--no-fund'],
    { cwd, stdio: 'inherit' }
  ))

  return (
    ensurePackageDependencies(botRoot, 'del bot', install, logger) &&
    ensurePackageDependencies(repoRoot, 'compartidas de MultiBot', install, logger)
  )
}
