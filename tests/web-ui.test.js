import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Window } from 'happy-dom'
import { createApplication, createDatabase } from '../scripts/serve-web.js'

async function createUiContext(t) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'multibot-ui-test-'))
  const app = await createApplication({ database: createDatabase({ dataDir }) })
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
  })

  return {
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
      window.setInterval = () => 0
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
    ['/register', 'PASO 1 DE 3'],
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

test('account, theme, favorites, and profile CRUD work through the UI and API', async (t) => {
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
  const profileName = window.document.querySelector('#flow-name')
  profileName.value = 'UI audit profile'
  profileName.dispatchEvent(new window.Event('input', { bubbles: true }))
  click(window, '[data-action="wizard-next"]')
  click(window, '[data-action="select-method"][data-method="qr"]')
  click(window, '[data-action="wizard-next"]')
  click(window, '[data-action="save-profile"]')
  await waitFor(() => main.textContent.includes('Configuración guardada'), 'profile creation')
  assert.match(main.textContent, /No se inició ningún bot/)

  click(window, '.header-link[data-page="bots"]')
  await waitFor(() => main.textContent.includes('UI audit profile'), 'profile in catalog view')
  click(window, '[data-action="edit-profile"]')
  const editForm = window.document.querySelector('form[data-form="edit"]')
  editForm.elements.namedItem('name').value = 'Edited UI profile'
  editForm.elements.namedItem('prefix').value = '!'
  editForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  await waitFor(
    () => window.document.querySelector('#modal-layer').hidden && main.textContent.includes('Edited UI profile'),
    'profile edit',
  )

  click(window, '[data-action="delete-profile"]')
  click(window, '[data-action="confirm-dialog"]')
  await waitFor(() => main.textContent.includes('No guardaste perfiles todavía'), 'profile deletion')
  const token = JSON.parse(window.localStorage.getItem('multibot_session'))
  const state = await (await fetch(`${context.origin}/api/state`, { headers: { Authorization: `Bearer ${token}` } })).json()
  assert.equal(state.instances.length, 0)

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

test('startup errors show a retry screen rather than leaving the app blank', async (t) => {
  const context = await createUiContext(t)
  const window = await context.mount('/', { removeDrawer: true })
  const main = window.document.querySelector('#main-content')
  await waitFor(() => Boolean(main.querySelector('.boot-failure')), 'startup error screen')
  assert.match(main.textContent, /No se pudo cargar el panel/)
  assert.ok(main.querySelector('a[href=""]'), 'the error screen should offer a reload action')
  assert.equal(window.__startupErrors.length, 1)
})
