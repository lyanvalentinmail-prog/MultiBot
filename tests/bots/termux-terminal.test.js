import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
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

test('termux forwarder: desde la carpeta del bot abre la terminal raíz con args', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'multibot-fwd-root-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const botDir = path.join(root, 'bots', 'demo-bot')
  await mkdir(botDir, { recursive: true })
  await writeFile(path.join(root, 'termux.sh'), await readFile(terminal, 'utf8'))
  await writeFile(path.join(botDir, 'termux.sh'), await readFile(path.join(repoRoot, 'bots', 'universal-bot', 'termux.sh'), 'utf8'))
  await writeFile(path.join(botDir, 'package.json'), JSON.stringify({ name: 'demo-bot' }))
  await writeFile(path.join(botDir, 'index.js'), 'console.log("demo")\n')

  const result = spawnSync('bash', ['termux.sh', '--list-bots'], {
    cwd: botDir, encoding: 'utf8',
    env: { ...process.env, HOME: root, TERM: 'dumb' },
    timeout: 60000,
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /demo-bot/)
})

test('termux forwarder: sin terminal raíz explica cómo arreglarlo', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'multibot-fwd-orphan-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(path.join(dir, 'termux.sh'), await readFile(path.join(repoRoot, 'bots', 'universal-bot', 'termux.sh'), 'utf8'))

  const result = spawnSync('bash', ['termux.sh'], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, HOME: dir, TERM: 'dumb', GIT_CEILING_DIRECTORIES: dir },
    timeout: 60000,
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /No encontré la terminal/)
  assert.match(result.stderr, /termux-go\.sh/)
})

test('termux forwarder: el de _template es idéntico (se propaga a bots nuevos)', async () => {
  const [a, b, c] = await Promise.all([
    readFile(path.join(repoRoot, 'bots', 'universal-bot', 'termux.sh'), 'utf8'),
    readFile(path.join(repoRoot, 'bots', '_template', 'termux.sh'), 'utf8'),
    readFile(path.join(repoRoot, 'bots', 'tomioka', 'termux.sh'), 'utf8'),
  ])
  assert.equal(a, b)
  assert.equal(a, c)
})

test('termux-go: sintaxis válida; clona, actualiza y respalda sin borrar', async (t) => {
  const syntax = spawnSync('bash', ['-n', path.join(repoRoot, 'scripts', 'termux-go.sh')], { encoding: 'utf8' })
  assert.equal(syntax.status, 0, syntax.stderr)

  // Repo "remoto" local con un termux.sh de mentira.
  const remote = await mkdtemp(path.join(os.tmpdir(), 'multibot-go-remote-'))
  t.after(() => rm(remote, { recursive: true, force: true }))
  await writeFile(path.join(remote, 'termux.sh'), '#!/usr/bin/env bash\necho GO-OK "$@"\n')
  const git = (...args) => spawnSync('git', ['-C', remote, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8' })
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'init')

  const work = await mkdtemp(path.join(os.tmpdir(), 'multibot-go-work-'))
  t.after(() => rm(work, { recursive: true, force: true }))
  const run = (dest, args = []) => spawnSync('bash', [path.join(repoRoot, 'scripts', 'termux-go.sh'), ...args], {
    cwd: work, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, HOME: work, TERM: 'dumb', MULTIBOT_DIR: dest, MULTIBOT_REPO_URL: remote },
  })

  // 1) Clona y ejecuta pasando args.
  const fresh = path.join(work, 'MultiBot')
  const cloned = run(fresh, ['--qr'])
  assert.equal(cloned.status, 0, cloned.stderr)
  assert.match(cloned.stdout, /GO-OK --qr/)

  // 2) Segunda vez: actualiza y ejecuta.
  const updated = run(fresh, ['--code', '123'])
  assert.equal(updated.status, 0, updated.stderr)
  assert.match(updated.stdout, /GO-OK --code 123/)

  // 3) Carpeta existente que no es git → la respalda, no la borra.
  const plain = path.join(work, 'Plain')
  await mkdir(plain, { recursive: true })
  await writeFile(path.join(plain, 'sessions.txt'), 'mi-sesion')
  const rescued = run(plain, ['--qr'])
  assert.equal(rescued.status, 0, rescued.stderr)
  assert.match(rescued.stdout, /GO-OK --qr/)
  const { readdir } = await import('node:fs/promises')
  const backup = (await readdir(work)).find((name) => name.startsWith('Plain.respaldo-'))
  assert.ok(backup, 'debió crear un respaldo con fecha')
  assert.equal(await readFile(path.join(work, backup, 'sessions.txt'), 'utf8'), 'mi-sesion')
})

test('termux terminal: --install corre npm install en el bot y verifica (fakes)', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'multibot-install-root-'))
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-install-home-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  t.after(() => rm(home, { recursive: true, force: true }))

  const botDir = path.join(root, 'bots', 'fake-bot')
  await mkdir(botDir, { recursive: true })
  await writeFile(path.join(root, 'termux.sh'), await readFile(terminal, 'utf8'))
  await writeFile(path.join(botDir, 'package.json'), JSON.stringify({ name: 'fake-bot' }))
  await writeFile(path.join(botDir, 'index.js'), 'console.log("demo")\n')

  // npm + ffmpeg + convert falsos para no tocar la red.
  const bindir = path.join(root, 'bin')
  await mkdir(bindir, { recursive: true })
  await writeFile(
    path.join(bindir, 'npm'),
    `#!/usr/bin/env bash\necho "NPM $* (en $PWD)" >> "${path.join(root, 'npm.log')}"\nmkdir -p "$PWD/node_modules/@whiskeysockets/baileys"\nexit 0\n`,
    { mode: 0o755 },
  )
  await writeFile(path.join(bindir, 'ffmpeg'), '#!/usr/bin/env bash\necho "ffmpeg version fake"\n', { mode: 0o755 })
  await writeFile(path.join(bindir, 'convert'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 })

  const result = spawnSync('bash', [path.join(root, 'termux.sh'), '--bot', 'fake-bot', '--install'], {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, HOME: home, TERM: 'dumb', PATH: `${bindir}${path.delimiter}${process.env.PATH}` },
  })
  assert.equal(result.status, 0, result.stderr)
  const log = await readFile(path.join(root, 'npm.log'), 'utf8')
  assert.ok(log.includes('NPM install'), log)
  assert.ok(log.includes(`en ${botDir}`), log)
  assert.match(result.stdout, /ffmpeg listo/)
  assert.match(result.stdout, /ImageMagick listo/)
  assert.match(result.stdout, /Baileys instalado/)
  assert.match(result.stdout, /Todo instalado/)
})

test('termux terminal: instalación cubre sistema + npm + sharp', async () => {
  const source = await readFile(terminal, 'utf8')
  assert.match(source, /install_termux_system/)
  for (const pkg of ['nodejs-lts', 'ffmpeg', 'imagemagick', 'git', 'python', 'make', 'clang', 'pkg-config']) {
    assert.ok(source.includes(`"${pkg}"`), `falta paquete ${pkg}`)
  }
  assert.match(source, /npm install --no-audit --no-fund/)
  assert.match(source, /npm run fix:sharp/)
  assert.match(source, /Node v\$major muy viejo/)
})

test('termux terminal: estado en opción 1, reinstall, update auto y doctor', async () => {
  const source = await readFile(terminal, 'utf8')
  assert.match(source, /estado1=" \$\(status_icon "\$b"\)"/)
  assert.match(source, /cmd_reinstall/)
  assert.match(source, /--reinstall/)
  assert.match(source, /Reinstalación limpia/)
  assert.match(source, /diff --name-only/)
  assert.match(source, /ffmpeg presente/)
  assert.match(source, /ImageMagick presente/)
  assert.match(source, /mb-update/)
  assert.match(source, /mb-doctor/)
})

test('termux terminal: --reinstall borra node_modules y reinstala (fakes)', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'multibot-reinstall-root-'))
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-reinstall-home-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  t.after(() => rm(home, { recursive: true, force: true }))

  const botDir = path.join(root, 'bots', 'fake-bot')
  await mkdir(path.join(botDir, 'node_modules'), { recursive: true })
  await writeFile(path.join(root, 'termux.sh'), await readFile(terminal, 'utf8'))
  await writeFile(path.join(botDir, 'package.json'), JSON.stringify({ name: 'fake-bot' }))
  await writeFile(path.join(botDir, 'index.js'), 'console.log("demo")\n')
  await writeFile(path.join(botDir, 'node_modules', 'junk.txt'), 'basura vieja')

  const bindir = path.join(root, 'bin')
  await mkdir(bindir, { recursive: true })
  await writeFile(
    path.join(bindir, 'npm'),
    `#!/usr/bin/env bash\necho "NPM $*" >> "${path.join(root, 'npm.log')}"\nmkdir -p "$PWD/node_modules/@whiskeysockets/baileys"\nexit 0\n`,
    { mode: 0o755 },
  )
  await writeFile(path.join(bindir, 'ffmpeg'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 })
  await writeFile(path.join(bindir, 'convert'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 })

  const result = spawnSync('bash', [path.join(root, 'termux.sh'), '--bot', 'fake-bot', '--reinstall'], {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, HOME: home, TERM: 'dumb', PATH: `${bindir}${path.delimiter}${process.env.PATH}` },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Borrando node_modules/)
  const { access } = await import('node:fs/promises')
  await assert.rejects(access(path.join(botDir, 'node_modules', 'junk.txt')))
  const log = await readFile(path.join(root, 'npm.log'), 'utf8')
  assert.ok(log.includes('NPM install'), log)
  assert.match(result.stdout, /Todo instalado/)
})

test('termux terminal: --update reinstala bots con deps cambiadas (git local)', async (t) => {
  const remote = await mkdtemp(path.join(os.tmpdir(), 'multibot-upd-remote-'))
  const work = await mkdtemp(path.join(os.tmpdir(), 'multibot-upd-work-'))
  const home = await mkdtemp(path.join(os.tmpdir(), 'multibot-upd-home-'))
  t.after(() => rm(remote, { recursive: true, force: true }))
  t.after(() => rm(work, { recursive: true, force: true }))
  t.after(() => rm(home, { recursive: true, force: true }))

  const fakePkg = { name: 'fake-bot', version: '1.0.0' }
  await mkdir(path.join(remote, 'bots', 'fake-bot'), { recursive: true })
  await writeFile(path.join(remote, 'termux.sh'), await readFile(terminal, 'utf8'))
  await writeFile(path.join(remote, 'bots', 'fake-bot', 'package.json'), JSON.stringify(fakePkg))
  await writeFile(path.join(remote, 'bots', 'fake-bot', 'index.js'), 'console.log("demo")\n')
  const git = (cwd, ...args) => spawnSync('git', ['-C', cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { encoding: 'utf8' })
  git(remote, 'init', '-q'); git(remote, 'add', '.'); git(remote, 'commit', '-qm', 'init')

  const clone = spawnSync('git', ['clone', '-q', remote, path.join(work, 'MultiBot')], { encoding: 'utf8' })
  assert.equal(clone.status, 0, clone.stderr)
  const root = path.join(work, 'MultiBot')

  // El remoto avanza cambiando dependencias del bot.
  await writeFile(path.join(remote, 'bots', 'fake-bot', 'package.json'), JSON.stringify({ ...fakePkg, version: '1.0.1' }))
  git(remote, 'add', '.'); git(remote, 'commit', '-qm', 'deps')

  const bindir = path.join(work, 'bin')
  await mkdir(bindir, { recursive: true })
  await writeFile(
    path.join(bindir, 'npm'),
    `#!/usr/bin/env bash\necho "NPM $* (en $PWD)" >> "${path.join(work, 'npm.log')}"\nmkdir -p "$PWD/node_modules/@whiskeysockets/baileys"\nexit 0\n`,
    { mode: 0o755 },
  )
  await writeFile(path.join(bindir, 'ffmpeg'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 })
  await writeFile(path.join(bindir, 'convert'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 })

  const result = spawnSync('bash', [path.join(root, 'termux.sh'), '--update'], {
    cwd: root, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, HOME: home, TERM: 'dumb', PATH: `${bindir}${path.delimiter}${process.env.PATH}` },
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Repo actualizado/)
  assert.match(result.stdout, /Cambiaron dependencias de fake-bot/)
  const log = await readFile(path.join(work, 'npm.log'), 'utf8')
  assert.ok(log.includes('NPM install'), log)
  assert.ok(log.includes(path.join(root, 'bots', 'fake-bot')), log)
})
