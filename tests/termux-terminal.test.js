import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const terminal = path.join(repoRoot, 'termux.sh')

function runTerminal(args, { home, input, cwd = repoRoot } = {}) {
  return spawnSync('bash', [terminal, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, HOME: home ?? process.env.HOME, TERM: 'dumb' },
    timeout: 60000,
  })
}

test('termux terminal: sintaxis bash válida y --help documenta qr/code/bot', () => {
  const syntax = spawnSync('bash', ['-n', terminal], { encoding: 'utf8' })
  assert.equal(syntax.status, 0, syntax.stderr)

  const help = runTerminal(['--help'])
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /--qr/)
  assert.match(help.stdout, /--code/)
  assert.match(help.stdout, /--bot/)
  assert.match(help.stdout, /--personalize/)
})

test('termux terminal: --list-bots detecta universal-bot', () => {
  const result = runTerminal(['--list-bots'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /universal-bot/)
  assert.match(result.stdout, /Universal Bot/)
})

test('termux terminal: bot inexistente falla con mensaje claro', () => {
  const result = runTerminal(['--bot', 'noexiste', '--qr'])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /no existe/)
})

test('termux terminal: --code sin número y sin tty falla limpio', () => {
  const result = runTerminal(['--code'], { input: '' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr + result.stdout, /--code 59899123456/)
})

test('termux terminal: --personalize escribe bloque idempotente en HOME temporal', async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-termux-home-'))
  t.after(() => rm(home, { recursive: true, force: true }))

  const first = runTerminal(['--personalize'], { home })
  assert.equal(first.status, 0, first.stderr)
  const bashrc = await readFile(path.join(home, '.bashrc'), 'utf8')
  assert.match(bashrc, /# >>> MultiBot Terminal >>>/)
  assert.match(bashrc, /alias multibot=/)
  assert.match(bashrc, /PS1=.*multibot/)

  const second = runTerminal(['--personalize'], { home })
  assert.equal(second.status, 0, second.stderr)
  const bashrcAgain = await readFile(path.join(home, '.bashrc'), 'utf8')
  assert.equal(bashrcAgain.match(/# >>> MultiBot Terminal >>>/g).length, 1)

  // El banner generado debe funcionar con `set -u` y mostrarse una sola vez.
  const banner = spawnSync('bash', ['-c', 'set -u; source "$1"; source "$1"', '_', path.join(home, '.multibot-banner.sh')], { encoding: 'utf8' })
  assert.equal(banner.status, 0, banner.stderr)
  assert.equal(banner.stdout.match(/MultiBot Terminal/g).length, 1)
})

test('termux terminal: menú guarda el bot elegido en la conf', async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-termux-menu-'))
  t.after(() => rm(home, { recursive: true, force: true }))

  // Opción 2 (elegir bot) → 1 (_template) → Enter → 0 (salir)
  const result = runTerminal([], { home, input: '2\n1\n\n0\n' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout + result.stderr, /Bot por defecto: _template/)
  const conf = await readFile(path.join(home, '.multibot-terminal.conf'), 'utf8')
  assert.match(conf, /DEFAULT_BOT=_template/)
})

test('termux terminal: inicio pasa método y teléfono al bot (fake bot)', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'multibot-termux-root-'))
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-termux-home2-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  t.after(() => rm(home, { recursive: true, force: true }))

  const botDir = path.join(root, 'bots', 'fake-bot')
  await mkdir(path.join(botDir, 'node_modules'), { recursive: true })
  await writeFile(path.join(root, 'termux.sh'), await readFile(terminal, 'utf8'))
  await writeFile(path.join(botDir, 'package.json'), JSON.stringify({
    name: 'fake-bot',
    scripts: { start: 'node start-echo.js' },
  }))
  await writeFile(path.join(botDir, 'bot.json'), JSON.stringify({ id: 'fake-bot', name: 'Fake Bot' }))
  await writeFile(
    path.join(botDir, 'start-echo.js'),
    "console.log('FAKE-START method=' + (process.env.MULTIBOT_LOGIN_METHOD || '(pregunta)') + ' phone=' + (process.env.MULTIBOT_LOGIN_PHONE || '(ninguno)'))\n",
  )

  const run = (args, input) => spawnSync('bash', [path.join(root, 'termux.sh'), ...args], {
    cwd: root, input, encoding: 'utf8',
    env: { ...process.env, HOME: home, TERM: 'dumb' },
    timeout: 60000,
  })

  const code = run(['--bot', 'fake-bot', '--code', '59899123456'])
  assert.equal(code.status, 0, code.stderr)
  assert.match(code.stdout, /FAKE-START method=code phone=59899123456/)

  const qr = run(['--bot', 'fake-bot', '--qr'])
  assert.equal(qr.status, 0, qr.stderr)
  assert.match(qr.stdout, /FAKE-START method=qr phone=\(ninguno\)/)

  // Reutiliza el último número sin pedirlo (stdin cerrado).
  const reused = run(['--bot', 'fake-bot', '--code'], '')
  assert.equal(reused.status, 0, reused.stderr)
  assert.match(reused.stdout, /FAKE-START method=code phone=59899123456/)

  // Sesión registrada → arranca directo sin método.
  await mkdir(path.join(botDir, 'sessions'), { recursive: true })
  await writeFile(path.join(botDir, 'sessions', 'creds.json'), '{"registered": true}')
  const direct = run(['--bot', 'fake-bot', '--qr'])
  assert.equal(direct.status, 0, direct.stderr)
  assert.match(direct.stdout, /ya vinculada/)
  assert.match(direct.stdout, /FAKE-START method=\(pregunta\)/)

  // Logout borra la sesión.
  const logout = run(['--bot', 'fake-bot', '--logout'])
  assert.equal(logout.status, 0, logout.stderr)
  const { access } = await import('node:fs/promises')
  await assert.rejects(access(path.join(botDir, 'sessions')))
})

test('bots: main.js acepta método/número preseleccionados de la terminal', async () => {
  for (const entry of ['bots/universal-bot/main.js', 'bots/_template/main.js']) {
    const source = await readFile(path.join(repoRoot, entry), 'utf8')
    assert.match(source, /MULTIBOT_LOGIN_METHOD/, entry)
    assert.match(source, /MULTIBOT_LOGIN_PHONE/, entry)
  }
})
