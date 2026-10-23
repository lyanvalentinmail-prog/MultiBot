import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApplication, createDatabase } from '../scripts/serve-web.js'

test('MultiBot web API: auth, profile CRUD, catalog, and Termux-only boundary', async (t) => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'multibot-web-test-'))
  let app = await createApplication({ database: createDatabase({ dataDir }) })
  let address = await app.listen(0, '127.0.0.1')
  let base = `http://127.0.0.1:${address.port}`
  t.after(async () => {
    await app.close()
    await rm(dataDir, { recursive: true, force: true })
  })

  const call = async (route, { method = 'GET', token, body } = {}) => {
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${base}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    return { response, data: await response.json() }
  }

  const health = await call('/api/health')
  assert.equal(health.response.status, 200)
  assert.equal(health.data.database, 'json')

  const catalog = await call('/api/bots')
  assert.equal(catalog.response.status, 200)
  const universal = catalog.data.bots.find((bot) => bot.id === 'universal-bot')
  assert.ok(universal)
  assert.equal(universal.name, 'Universal Bot')
  assert.equal(universal.termuxOnly, true)
  assert.equal(universal.webRuntime, false)
  assert.equal(universal.adultContent, false)
  assert.equal(universal.pluginCount, 200)

  const pluginCatalog = await call('/api/plugins?botId=universal-bot')
  assert.equal(pluginCatalog.response.status, 200)
  assert.ok(pluginCatalog.data.plugins.some((plugin) => plugin.id === 'anti-link'))
  assert.ok(!pluginCatalog.data.plugins.some((plugin) => /pajer|transex/i.test(plugin.id)))

  const unauthenticated = await call('/api/instances', { method: 'POST', body: { name: 'No acceso' } })
  assert.equal(unauthenticated.response.status, 401)

  const registration = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'admin@example.test', username: 'multibot-user', password: 'correct horse battery staple' }
  })
  assert.equal(registration.response.status, 201)
  assert.ok(registration.data.token)
  assert.equal(registration.data.user.email, 'admin@example.test')
  const token = registration.data.token

  const created = await call('/api/instances', {
    method: 'POST', token,
    body: { name: 'Bot principal', botId: 'universal-bot', prefix: '.', pairingMethod: 'pairing-code' }
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.data.instance.status, 'configured')
  assert.equal(created.data.instance.pairingMethod, 'pairing-code')
  const id = created.data.instance.id

  const profiles = await call('/api/instances', { token })
  assert.equal(profiles.response.status, 200)
  assert.equal(profiles.data.instances.length, 1)

  const changed = await call(`/api/instances/${id}`, { method: 'PATCH', token, body: { name: 'Bot actualizado', prefix: '!' } })
  assert.equal(changed.response.status, 200)
  assert.equal(changed.data.instance.name, 'Bot actualizado')
  assert.equal(changed.data.instance.prefix, '!')

  const pairingAttempt = await call(`/api/instances/${id}/pairing`, { method: 'POST', token, body: {} })
  assert.equal(pairingAttempt.response.status, 409)
  assert.equal(pairingAttempt.data.code, 'TERMUX_ONLY')

  const secondAccount = await call('/api/auth/register', {
    method: 'POST',
    body: { email: 'other@example.test', username: 'other-user', password: 'another secure password' }
  })
  assert.equal(secondAccount.response.status, 201)
  const crossAccountRead = await call(`/api/instances/${id}`, { token: secondAccount.data.token })
  assert.equal(crossAccountRead.response.status, 404)

  const removed = await call(`/api/instances/${id}`, { method: 'DELETE', token })
  assert.equal(removed.response.status, 200)
  const missing = await call(`/api/instances/${id}`, { token })
  assert.equal(missing.response.status, 404)

  const staticPage = await fetch(`${base}/bots/universal-bot`)
  assert.equal(staticPage.status, 200)
  assert.match(await staticPage.text(), /MultiBot — Panel de bots/)

  const persisted = await readFile(path.join(dataDir, 'multibot-local.json'), 'utf8')
  assert.ok(persisted.includes('passwordHash'))
  assert.ok(!persisted.includes('correct horse battery staple'))

  await app.close()
  app = await createApplication({ database: createDatabase({ dataDir }) })
  address = await app.listen(0, '127.0.0.1')
  base = `http://127.0.0.1:${address.port}`
  const restoredSession = await call('/api/auth/me', { token })
  assert.equal(restoredSession.response.status, 200)
  assert.equal(restoredSession.data.user.email, 'admin@example.test')
  const restoredProfiles = await call('/api/instances', { token })
  assert.deepEqual(restoredProfiles.data.instances, [])
})

test('Render Blueprint uses free plans for both services', async () => {
  const blueprint = await readFile(new URL('../render.yaml', import.meta.url), 'utf8')
  const plans = [...blueprint.matchAll(/^\s+plan:\s*(\S+)/gm)].map((match) => match[1])
  assert.deepEqual(plans, ['free', 'free'])
})

test('adult-marked bots are excluded from the public catalog', async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'multibot-catalog-test-'))
  const dataDir = path.join(rootDir, 'data')
  const botsDir = path.join(rootDir, 'bots')
  await mkdir(path.join(botsDir, 'family-bot'), { recursive: true })
  await mkdir(path.join(botsDir, 'adult-bot'), { recursive: true })
  await writeFile(path.join(botsDir, 'family-bot', 'package.json'), JSON.stringify({ name: 'family-bot', version: '1.0.0' }))
  await writeFile(path.join(botsDir, 'adult-bot', 'package.json'), JSON.stringify({ name: 'adult-bot', version: '1.0.0' }))
  await writeFile(path.join(botsDir, 'adult-bot', 'bot.json'), JSON.stringify({ adultContent: true }))
  const app = await createApplication({ database: createDatabase({ dataDir }), rootDir })
  const address = await app.listen(0, '127.0.0.1')
  t.after(async () => {
    await app.close()
    await rm(rootDir, { recursive: true, force: true })
  })
  const response = await fetch(`http://127.0.0.1:${address.port}/api/bots`)
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(data.bots.map((bot) => bot.id), ['family-bot'])
})
