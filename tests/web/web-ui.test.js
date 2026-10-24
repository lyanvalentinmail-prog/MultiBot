import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Window } from 'happy-dom'
import { createApplication, createDatabase } from '../../scripts/server/serve-web.js'

async function createUiContext(t, { webRuntimeEnabled = false, webRuntimeAdminEmails = '', rootDir, removeRootDir = false } = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'multibot-ui-test-'))
  const app = await createApplication({
    database: createDatabase({ dataDir }),
    rootDir,
    webRuntimeEnabled,
    webRuntimeAdminEmails,
  })
  const address = await app.listen(0, '127.0.0.1')
  const origin = `http://127.0.0.1:${address.port}`
  const scriptResponse = await fetch(`${origin}/app.js`)
  assert.equal(scriptResponse.status, 200)
  const script = await scriptResponse.text()
  const windows = new Set()

  t.after(async () => {
    await Promise.all([...windows].map((window) => window.happyDOM.abort()))
    await app.close()
    await rm(dataDir, { recursive: true, force: true })
    if (removeRootDir && rootDir) await rm(rootDir, { recursive: true, force: true })
  })

  return {
    app,
    origin,
    windows,
    async mount(route, { token = '', removeDrawer = false } = {}) {
      const response = await fetch(`${origin}${route}`)
      assert.equal(response.status, 200, `direct route ${route} should serve the SPA shell`)
      assert.match(response.headers.get('content-type') || '', /text\/html/)
      const window = new Window({
        url: `${origin}${route}`,
        settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
      })
      windows.add(window)
      window.document.write(await response.text())
      if (token) window.localStorage.setItem('multibot_session', JSON.stringify(token))
      window.fetch = (input, init) => fetch(new URL(String(input), window.location.href), init)
      window.__intervals = []
      window.setInterval = (callback, delay) => { window.__intervals.push({ callback, delay }); return 0 }
      window.console = { error: (...args) => { window.__startupErrors ||= []; window.__startupErrors.push(args) } }
      if (removeDrawer) window.document.querySelector('#menu-drawer')?.remove()
      window.eval(script)
      return window
    },
  }
}

async function waitFor(predicate, message, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for ${message}`)
}

function click(window, selector) {
  const element = window.document.querySelector(selector)
  assert.ok(element, `expected element ${selector}`)
  element.click()
}

test('SPA deep links render their views and load their data', async (t) => {
  const context = await createUiContext(t)
  const routes = [
    ['/', 'Un hogar para'],
    ['/home', 'WELCOME'],
    ['/bots', 'Bots disponibles'],
    ['/bots/universal-bot', 'Universal Bot'],
    ['/register', 'Crear bot'],
    ['/metrics', 'Telemetría web'],
    ['/store', 'Universal Bot en Termux'],
    ['/endpoints', 'Rutas HTTP reales'],
    ['/favorites', 'Favoritos'],
    ['/tickets', 'Centro de soporte'],
    ['/profile', 'Mi perfil'],
    ['/cmds', 'Plugins'],
  ]

  for (const [route, expected] of routes) {
    const window = await context.mount(route)
    const main = window.document.querySelector('#main-content')
    await waitFor(
      () => main.dataset.ready === 'true'
        && main.textContent.includes(expected)
        && window.document.querySelector('#live-chip')?.textContent.includes('Panel disponible'),
      `${route} to render`,
    )
    assert.ok(window.document.querySelector('#site-header .theme-toggle'), `${route} should have the theme control`)
    assert.equal(window.document.querySelector('#bottom-navigation').hidden, route === '/')
    assert.deepEqual(window.__startupErrors || [], [], `${route} should not produce startup errors`)
    if (route === '/endpoints') await waitFor(() => main.querySelector('.endpoint-row'), 'API endpoint rows')
    if (route === '/cmds') await waitFor(() => main.querySelector('.command-grid'), 'plugin categories')
  }
})

test('account, theme, favorites, and create-bot navigation work through the UI', async (t) => {
  const context = await createUiContext(t)
  const window = await context.mount('/home')
  const main = window.document.querySelector('#main-content')
  await waitFor(() => main.dataset.ready === 'true' && main.textContent.includes('WELCOME'), 'home dashboard')

  click(window, '[data-action="open-drawer"]')
  click(window, '#menu-drawer [data-action="open-auth"][data-mode="register"]')
  const authForm = window.document.querySelector('form[data-form="auth"]')
  authForm.querySelector('[name="email"]').value = 'ui-audit@example.test'
  authForm.querySelector('[name="username"]').value = 'ui-auditor'
  authForm.querySelector('[name="password"]').value = 'correct-horse-battery-42'
  authForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  await waitFor(
    () => window.document.querySelector('#modal-layer').hidden
      && window.document.querySelector('.profile-name')?.textContent.includes('ui-auditor'),
    'account registration',
  )

  click(window, '.theme-toggle')
  assert.ok(window.document.body.classList.contains('light-theme'))
  assert.equal(JSON.parse(window.localStorage.getItem('multibot_theme')), 'light')

  click(window, '#bottom-navigation [data-page="bots"]')
  await waitFor(() => main.textContent.includes('Universal Bot'), 'catalog data')
  click(window, '.favorite-button[data-id="universal-bot"]')
  assert.ok(JSON.parse(window.localStorage.getItem('multibot_favorites')).includes('universal-bot'))
  click(window, '[data-action="open-drawer"]')
  click(window, '#menu-drawer [data-page="favorites"]')
  await waitFor(() => window.location.pathname === '/favorites' && main.textContent.includes('Universal Bot'), 'saved favorite')

  click(window, '.header-link[data-page="register"]')
  await waitFor(() => main.querySelector('.create-bot-page'), 'create-bot page')
  assert.equal(main.querySelector('#flow-name'), null, 'the old profile wizard must not be rendered')
  assert.equal(main.querySelector('[data-action="wizard-next"]'), null)
  assert.doesNotMatch(main.textContent, /Crear perfil|Guardar preferencias/)
  assert.match(main.textContent, /Pairing Code requiere tu número internacional/)

  click(window, '[data-action="open-drawer"]')
  click(window, '#menu-drawer [data-action="logout"]')
  await waitFor(() => window.document.querySelector('.profile-name')?.textContent === 'Invitado', 'logout')
  assert.equal(JSON.parse(window.localStorage.getItem('multibot_session')), '')

  click(window, '[data-action="open-drawer"]')
  click(window, '#menu-drawer [data-page="profile"]')
  click(window, '[data-action="open-auth"][data-mode="login"]')
  const loginForm = window.document.querySelector('form[data-form="auth"]')
  loginForm.querySelector('[name="email"]').value = 'ui-audit@example.test'
  loginForm.querySelector('[name="password"]').value = 'correct-horse-battery-42'
  loginForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  await waitFor(
    () => window.document.querySelector('#modal-layer').hidden
      && window.document.querySelector('.profile-name')?.textContent.includes('ui-auditor'),
    'login',
  )
})

test('Create bot starts real pairing and QR events and keeps runtime controls allowlisted', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'multibot-ui-runtime-'))
  const botDir = path.join(rootDir, 'bots', 'universal-bot')
  await mkdir(botDir, { recursive: true })
  await writeFile(path.join(botDir, 'package.json'), JSON.stringify({
    name: 'universal-bot', version: '1.0.0', type: 'module', main: 'main.js',
  }))
  await writeFile(path.join(botDir, 'bot.json'), JSON.stringify({
    id: 'universal-bot', name: 'Universal Bot', description: 'Fixture for web runtime UI.',
    version: '1.0.0', executionMode: 'web', webRuntime: true, webEntrypoint: 'main.js',
    supportsQr: true, supportsPairingCode: true, adultContent: false,
  }))
  await writeFile(path.join(botDir, 'main.js'), [
    "const isPairing = process.env.MULTIBOT_LOGIN_METHOD === 'pairing-code';",
    "const event = isPairing ? { type: 'pairing-code', value: 'ABCD-1234' } : { type: 'qr', value: 'fixture-whatsapp-qr-payload' };",
    "process.stdout.write('MULTIBOT_RUNTIME_EVENT:' + JSON.stringify(event) + String.fromCharCode(10));",
    'setInterval(() => {}, 1000);',
  ].join('\n'))
  const secondBotDir = path.join(rootDir, 'bots', 'zz-test-bot')
  await mkdir(secondBotDir, { recursive: true })
  await writeFile(path.join(secondBotDir, 'package.json'), JSON.stringify({ name: 'zz-test-bot', version: '1.0.0', type: 'module', main: 'main.js' }))
  await writeFile(path.join(secondBotDir, 'bot.json'), JSON.stringify({
    id: 'zz-test-bot', name: 'ZZ Test Bot', description: 'Selector fixture.',
    version: '1.0.0', executionMode: 'web', webRuntime: true, webEntrypoint: 'main.js', adultContent: false,
  }))
  await writeFile(path.join(secondBotDir, 'main.js'), 'setInterval(() => {}, 1000);')

  const context = await createUiContext(t, {
    rootDir,
    removeRootDir: true,
    webRuntimeEnabled: true,
    webRuntimeAdminEmails: '',
  })
  const register = async (email, username) => {
    const response = await fetch(`${context.origin}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password: 'strong runtime test password' }),
    })
    assert.equal(response.status, 201)
    return (await response.json()).token
  }
  // No allowlist is configured: the first account becomes the runtime owner.
  const adminToken = await register('runtime-owner@example.test', 'runtime-owner')
  const otherToken = await register('not-allowlisted@example.test', 'runtime-guest')

  const adminWindow = await context.mount('/bots', { token: adminToken })
  const adminMain = adminWindow.document.querySelector('#main-content')
  await waitFor(() => adminMain.textContent.includes('Universal Bot'), 'admin catalog')
  click(adminWindow, '.bot-card [data-action="create-from-bot"]')
  await waitFor(() => adminWindow.location.pathname === '/register' && adminMain.querySelector('.create-bot-page'), 'Create bot navigation')
  assert.equal(adminMain.querySelector('#flow-name'), null)
  assert.equal(adminMain.querySelector('#runtime-method').value, 'pairing-code', 'Pairing Code is the initial method')
  assert.equal(adminMain.querySelector('#runtime-phone-field').hidden, false, 'Pairing Code asks for the number')
  assert.match(adminMain.querySelector('[data-action="runtime-start"]').textContent, /Desplegar bot y vincular/)
  assert.match(adminMain.textContent, /servicio web existente; no crea otro servicio de Render/)
  const botSelector = adminMain.querySelector('#create-bot-select')
  assert.ok(botSelector, 'a selector is shown when more than one web runtime is available')
  assert.equal(botSelector.value, 'universal-bot')
  botSelector.value = 'zz-test-bot'
  botSelector.dispatchEvent(new adminWindow.Event('change', { bubbles: true }))
  assert.equal(adminMain.querySelector('[data-action="runtime-start"]').dataset.id, 'zz-test-bot')
  const universalSelector = adminMain.querySelector('#create-bot-select')
  universalSelector.value = 'universal-bot'
  universalSelector.dispatchEvent(new adminWindow.Event('change', { bubbles: true }))

  adminMain.querySelector('#runtime-phone').value = '123'
  click(adminWindow, '[data-action="runtime-start"]')
  await waitFor(() => adminWindow.document.querySelector('#toast-stack')?.textContent.includes('teléfono internacional válido'), 'pairing phone validation')
  const noProcess = await (await fetch(`${context.origin}/api/runtime`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()
  assert.equal(noProcess.runtimes.length, 0)

  adminMain.querySelector('#runtime-phone').value = '+598 99 123 456'
  click(adminWindow, '[data-action="runtime-start"]')
  await waitFor(() => context.app.runtimeManager.list()[0]?.pairingCode === 'ABCD-1234', 'Pairing Code from Baileys')
  const runtimePoll = adminWindow.__intervals.find((interval) => interval.delay === 3000)
  assert.ok(runtimePoll, 'the runtime polling interval should be registered')
  await runtimePoll.callback()
  await waitFor(() => adminMain.querySelector('.runtime-code code')?.textContent === 'ABCD-1234', 'real Pairing Code event')
  assert.match(adminMain.textContent, /Pairing Code de WhatsApp/)
  const pairingStatus = await (await fetch(`${context.origin}/api/runtime`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()
  assert.equal(pairingStatus.runtimes[0].pairingCode, 'ABCD-1234')
  assert.equal(JSON.stringify(pairingStatus).includes('59899123456'), false, 'the phone number is not returned or stored in runtime status')

  click(adminWindow, '[data-action="runtime-stop"]')
  await waitFor(() => adminMain.textContent.includes('Detenido'), 'stop Pairing Code runtime')
  const method = adminMain.querySelector('#runtime-method')
  method.value = 'qr'
  method.dispatchEvent(new adminWindow.Event('change', { bubbles: true }))
  assert.equal(adminMain.querySelector('#runtime-phone-field').hidden, true, 'QR does not require the phone number')
  click(adminWindow, '[data-action="runtime-start"]')
  await waitFor(() => Boolean(context.app.runtimeManager.list()[0]?.qrDataUrl), 'QR from Baileys')
  await runtimePoll.callback()
  await waitFor(() => adminMain.querySelector('.runtime-credential img')?.getAttribute('src').startsWith('data:image/png;base64,'), 'real QR event')
  click(adminWindow, '[data-action="runtime-stop"]')
  await waitFor(() => adminMain.textContent.includes('Detenido'), 'stop QR runtime')

  const otherWindow = await context.mount('/register', { token: otherToken })
  const otherMain = otherWindow.document.querySelector('#main-content')
  await waitFor(() => otherMain.textContent.includes('Solo la cuenta propietaria'), 'non-admin runtime denial')
  assert.equal(otherWindow.document.querySelector('[data-action="runtime-start"]'), null)
  assert.equal(otherWindow.document.querySelector('[data-action="runtime-stop"]'), null)
})

test('startup errors show a retry screen rather than leaving the app blank', async (t) => {
  const context = await createUiContext(t)
  const window = await context.mount('/', { removeDrawer: true })
  const main = window.document.querySelector('#main-content')
  await waitFor(() => Boolean(main.querySelector('.boot-failure')), 'startup error screen')
  assert.match(main.textContent, /No se pudo cargar el panel/)
  assert.ok(main.querySelector('a[href=""]'), 'the error screen should offer a reload action')
  assert.equal(window.__startupErrors.length, 1)
})
