import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import cluster from 'node:cluster'
import { enforceTermuxOnly } from './lib/termux-guard.js'

enforceTermuxOnly()

console.log('⧉ Inicializando Universal Bot...')

const { setupMaster, fork } = cluster
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'

const __dirname = dirname(fileURLToPath(import.meta.url))

cfonts.say('UNIVERSAL', {
  font: 'block',
  align: 'center',
  gradient: ['cyan', 'blue']
})

cfonts.say('MultiBot - Universal Bot', {
  font: 'simple',
  align: 'center',
  gradient: ['blue', 'white']
})

// Reinicio controlado: si el bot muere al arrancar (config rota, dependencia
// faltante, sesión corrupta…) no entramos en un bucle infinito de logs.
const RESTART_DELAY_MS = 3000
const MAX_FAST_CRASHES = 4
let isWorking = false
let fastCrashes = 0
let lastStartAt = 0

function launch(scripts) {
  const script = scripts[0]
  const args = [join(__dirname, script), ...process.argv.slice(2)]

  setupMaster({
    exec: args[0],
    args: args.slice(1),
  })

  isWorking = true
  lastStartAt = Date.now()

  const child = fork()

  child.on('exit', (code, signal) => {
    isWorking = false

    // Salida limpia (0) o detenida por señal: es intencional, no se reinicia.
    if (signal || code === 0) return

    if (Date.now() - lastStartAt < 15000) fastCrashes += 1
    else fastCrashes = 1

    if (fastCrashes > MAX_FAST_CRASHES) {
      console.error('\n✖ El bot falló varias veces al iniciar; se detuvo el reinicio automático.')
      console.error('  Revisa el error de arriba. Ayuda rápida:')
      console.error('    npm run doctor               # diagnóstico de Node, dependencias y config')
      console.error('    npm run setup -- --fix       # repara config.js si pegaste comandos por error')
      console.error('    npm run start:raw            # inicia sin el wrapper de reinicio\n')
      process.exit(1)
    }

    console.log(`\n↻ Reiniciando en ${Math.round(RESTART_DELAY_MS / 1000)}s (intento ${fastCrashes}/${MAX_FAST_CRASHES})…`)
    setTimeout(() => launch(scripts), RESTART_DELAY_MS)
  })

  // Recarga manual al editar el entrypoint (comportamiento previo conservado).
  watchFile(args[0], () => {
    unwatchFile(args[0])
    if (!isWorking) launch(scripts)
  })
}

launch(['main.js'])
