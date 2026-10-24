#!/usr/bin/env node
/**
 * MultiBot web portal: static SPA, configuration API, and explicitly authorized bot runtimes.
 */
import { createServer } from 'node:http'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebRuntimeManager } from './web-runtime.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const WEB_DIR = path.join(ROOT, 'web')
const DEFAULT_DATA_DIR = path.join(ROOT, 'data')
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = 64 * 1024
const ALLOWED_PREFIXES = new Set(['.', '!', '/', '#', '-'])
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
}

const iso = (value) => value instanceof Date ? value.toISOString() : new Date(value).toISOString()
const tokenDigest = (token) => createHash('sha256').update(String(token)).digest('hex')
const safeUser = (user) => user && ({ id: user.id, username: user.username, email: user.email, createdAt: user.createdAt })

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${digest}`
}

function verifyPassword(password, stored) {
  const [salt, digest] = String(stored || '').split(':')
  if (!salt || !digest) return false
  try {
    const expected = Buffer.from(digest, 'hex')
    const actual = scryptSync(String(password), salt, 64)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch { return false }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function loadBotCatalog(rootDir = ROOT) {
  const botsDir = path.join(rootDir, 'bots')
  if (!existsSync(botsDir)) return []
  let entries = []
  try { entries = readdirSync(botsDir, { withFileTypes: true }) } catch { return [] }
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    .map((entry) => {
      const id = entry.name
      const botDir = path.join(botsDir, id)
      let pkg = {}
      let manifest = {}
      try { pkg = JSON.parse(readFileSync(path.join(botDir, 'package.json'), 'utf8')) } catch {}
      try { manifest = JSON.parse(readFileSync(path.join(botDir, 'bot.json'), 'utf8')) } catch {}
      // Los comandos de cada bot se declaran en su manifiesto commands.json.
      let commandFiles = []
      try {
        const manifest = JSON.parse(readFileSync(path.join(botDir, 'commands.json'), 'utf8'))
        commandFiles = Array.isArray(manifest.commands) ? manifest.commands : []
      } catch {}
      // A web runtime must be an explicit opt-in from the manifest. This intentionally
      // overrides a repository Termux guard only for bots that ship a web entrypoint.
      const webRuntime = manifest.webRuntime === true && manifest.executionMode === 'web'
      const termuxOnly = !webRuntime && (manifest.executionMode === 'termux' || existsSync(path.join(botDir, 'lib', 'termux-guard.js')))
      const name = manifest.name || (id === 'universal-bot' ? 'Universal Bot' : pkg.displayName || pkg.name || id)
      const featureList = Array.isArray(manifest.features) ? manifest.features : []
      return {
        id,
        name,
        description: manifest.description || pkg.description || '',
        version: pkg.version || manifest.version || '1.0.0',
        executionMode: webRuntime ? 'web' : termuxOnly ? 'termux' : (manifest.executionMode || 'manual'),
        termuxOnly,
        webRuntime,
        supportsPairingCode: manifest.supportsPairingCode !== false,
        supportsQr: manifest.supportsQr !== false,
        adultContent: manifest.adultContent === true,
        defaultPrefix: manifest.defaultPrefix || '.',
        pluginCount: commandFiles.length,
        features: featureList,
        path: `bots/${id}`
      }
    })
    .filter((bot) => !bot.adultContent)
}

function loadPluginCatalog(botId, rootDir = ROOT) {
  const catalog = loadBotCatalog(rootDir)
  if (!catalog.some((bot) => bot.id === botId)) return null
  // Todos los comandos viven en commands/<categoría>/<comando>.js; cada bot
  // declara los que usa en bots/<id>/commands.json.
  const manifestPath = path.join(rootDir, 'bots', botId, 'commands.json')
  let entries = []
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    entries = (Array.isArray(manifest.commands) ? manifest.commands : []).map(String)
  } catch {
    return []
  }
  return entries.sort().map((entry) => {
    const relative = entry.replace(/^\/+/, '')
    const file = path.basename(relative)
    const id = file.slice(0, -3)
    const category = relative.includes('/') ? relative.split('/')[0] : 'general'
    return {
      id,
      file,
      category,
      path: relative,
      label: id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    }
  })
}

class JsonDatabase {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.file = path.join(dataDir, 'multibot-local.json')
    this.provider = 'json'
    this.state = { users: [], sessions: [], instances: [] }
    this.writeChain = Promise.resolve()
  }
  async init() {
    mkdirSync(this.dataDir, { recursive: true })
    if (existsSync(this.file)) {
      try {
        const data = JSON.parse(readFileSync(this.file, 'utf8'))
        this.state = {
          users: Array.isArray(data.users) ? data.users : [],
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          instances: Array.isArray(data.instances) ? data.instances : []
        }
      } catch (error) {
        throw new Error(`No se pudo leer la base JSON ${this.file}: ${error.message}`)
      }
    } else {
      await this.persist()
    }
  }
  persist() {
    const snapshot = JSON.stringify(this.state, null, 2) + '\n'
    const task = this.writeChain.then(() => {
      const temp = `${this.file}.${process.pid}.tmp`
      writeFileSync(temp, snapshot, { mode: 0o600 })
      renameSync(temp, this.file)
    })
    this.writeChain = task.catch(() => {})
    return task
  }
  async ping() { await this.writeChain; return true }
  async createUser(user) {
    if (this.state.users.some((item) => item.email === user.email)) return null
    this.state.users.push(user)
    await this.persist()
    return user
  }
  async findUserByEmail(email) { return this.state.users.find((user) => user.email === email) || null }
  async findUserById(id) { return this.state.users.find((user) => user.id === id) || null }
  async firstUser() {
    const sorted = [...this.state.users].sort((a, b) => {
      const byDate = String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      return byDate || String(a.email || '').localeCompare(String(b.email || ''))
    })
    return sorted[0] || null
  }
  async createSession(session) { this.state.sessions = this.state.sessions.filter((item) => item.tokenHash !== session.tokenHash); this.state.sessions.push(session); await this.persist() }
  async findSessionUser(hash) {
    const session = this.state.sessions.find((item) => item.tokenHash === hash && Date.parse(item.expiresAt) > Date.now())
    return session ? this.findUserById(session.userId) : null
  }
  async deleteSession(hash) { this.state.sessions = this.state.sessions.filter((item) => item.tokenHash !== hash); await this.persist() }
  async listInstances(userId) { return this.state.instances.filter((item) => item.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
  async findInstance(userId, id) { return this.state.instances.find((item) => item.userId === userId && item.id === id) || null }
  async createInstance(instance) { this.state.instances.unshift(instance); await this.persist(); return instance }
  async updateInstance(userId, id, changes) {
    const item = this.state.instances.find((entry) => entry.userId === userId && entry.id === id)
    if (!item) return null
    Object.assign(item, changes)
    await this.persist()
    return item
  }
  async deleteInstance(userId, id) {
    const index = this.state.instances.findIndex((entry) => entry.userId === userId && entry.id === id)
    if (index < 0) return false
    this.state.instances.splice(index, 1)
    await this.persist()
    return true
  }
  async counts() { return { users: this.state.users.length, instances: this.state.instances.length } }
  async close() { await this.writeChain }
}

class PostgresDatabase {
  constructor(connectionString) {
    this.connectionString = connectionString
    this.provider = 'postgresql'
    this.pool = null
  }
  async init() {
    const { Pool } = await import('pg')
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: Number(process.env.PG_POOL_MAX) || 5,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
    })
    await this.pool.query('SELECT 1')
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS multibot_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS multibot_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES multibot_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS multibot_instances (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES multibot_users(id) ON DELETE CASCADE,
        bot_id TEXT NOT NULL,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        pairing_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'configured',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await this.pool.query('CREATE INDEX IF NOT EXISTS multibot_instances_user_created_idx ON multibot_instances(user_id, created_at DESC)')
  }
  mapUser(row) { return row ? { id: row.id, email: row.email, username: row.username, passwordHash: row.password_hash, createdAt: iso(row.created_at) } : null }
  mapInstance(row) { return row ? { id: row.id, userId: row.user_id, botId: row.bot_id, name: row.name, prefix: row.prefix, pairingMethod: row.pairing_method, status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) } : null }
  async ping() { await this.pool.query('SELECT 1'); return true }
  async createUser(user) {
    try {
      const { rows } = await this.pool.query('INSERT INTO multibot_users(id,email,username,password_hash,created_at) VALUES($1,$2,$3,$4,$5) RETURNING *', [user.id, user.email, user.username, user.passwordHash, user.createdAt])
      return this.mapUser(rows[0])
    } catch (error) { if (error.code === '23505') return null; throw error }
  }
  async findUserByEmail(email) { const { rows } = await this.pool.query('SELECT * FROM multibot_users WHERE email=$1', [email]); return this.mapUser(rows[0]) }
  async findUserById(id) { const { rows } = await this.pool.query('SELECT * FROM multibot_users WHERE id=$1', [id]); return this.mapUser(rows[0]) }
  async firstUser() { const { rows } = await this.pool.query('SELECT * FROM multibot_users ORDER BY created_at ASC, email ASC LIMIT 1'); return this.mapUser(rows[0]) }
  async createSession(session) { await this.pool.query('INSERT INTO multibot_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3) ON CONFLICT(token_hash) DO UPDATE SET user_id=EXCLUDED.user_id, expires_at=EXCLUDED.expires_at', [session.tokenHash, session.userId, session.expiresAt]) }
  async findSessionUser(hash) { const { rows } = await this.pool.query('SELECT u.* FROM multibot_sessions s JOIN multibot_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()', [hash]); return this.mapUser(rows[0]) }
  async deleteSession(hash) { await this.pool.query('DELETE FROM multibot_sessions WHERE token_hash=$1', [hash]) }
  async listInstances(userId) { const { rows } = await this.pool.query('SELECT * FROM multibot_instances WHERE user_id=$1 ORDER BY created_at DESC', [userId]); return rows.map((row) => this.mapInstance(row)) }
  async findInstance(userId, id) { const { rows } = await this.pool.query('SELECT * FROM multibot_instances WHERE user_id=$1 AND id=$2', [userId, id]); return this.mapInstance(rows[0]) }
  async createInstance(item) {
    const { rows } = await this.pool.query('INSERT INTO multibot_instances(id,user_id,bot_id,name,prefix,pairing_method,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [item.id, item.userId, item.botId, item.name, item.prefix, item.pairingMethod, item.status, item.createdAt, item.updatedAt])
    return this.mapInstance(rows[0])
  }
  async updateInstance(userId, id, changes) {
    const current = await this.findInstance(userId, id)
    if (!current) return null
    const next = { ...current, ...changes }
    const { rows } = await this.pool.query('UPDATE multibot_instances SET name=$3,prefix=$4,pairing_method=$5,status=$6,updated_at=$7 WHERE user_id=$1 AND id=$2 RETURNING *', [userId, id, next.name, next.prefix, next.pairingMethod, next.status, next.updatedAt])
    return this.mapInstance(rows[0])
  }
  async deleteInstance(userId, id) { const result = await this.pool.query('DELETE FROM multibot_instances WHERE user_id=$1 AND id=$2', [userId, id]); return result.rowCount > 0 }
  async counts() {
    const { rows } = await this.pool.query('SELECT (SELECT COUNT(*)::int FROM multibot_users) AS users, (SELECT COUNT(*)::int FROM multibot_instances) AS instances')
    return rows[0] || { users: 0, instances: 0 }
  }
  async close() { await this.pool?.end() }
}

export function createDatabase({ connectionString = process.env.DATABASE_URL || '', dataDir = process.env.MULTIBOT_DATA_DIR || DEFAULT_DATA_DIR } = {}) {
  return connectionString ? new PostgresDatabase(connectionString) : new JsonDatabase(dataDir)
}

function jsonResponse(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders })
  res.end(body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0
        fail(Object.assign(new Error('El cuerpo de la solicitud supera el límite permitido.'), { status: 413 }))
        req.resume()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) { settled = true; return resolve({}) }
      try {
        const value = JSON.parse(raw)
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Se esperaba un objeto JSON.')
        settled = true
        resolve(value)
      } catch (error) { fail(Object.assign(new Error(`JSON inválido: ${error.message}`), { status: 400 })) }
    })
    req.on('error', fail)
  })
}

function authToken(req) {
  const header = String(req.headers.authorization || '')
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function rateLimiter({ limit = 12, windowMs = 10 * 60 * 1000 } = {}) {
  const buckets = new Map()
  return (req) => {
    const key = `${req.socket.remoteAddress || 'unknown'}:${req.url?.split('?')[0]}`
    const now = Date.now()
    const row = buckets.get(key)
    if (!row || row.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    row.count += 1
    return row.count <= limit
  }
}

// Extra frame-ancestors sources (space separated). Used only to embed the SPA in
// sandbox previews; production deployments keep framing fully blocked.
const PREVIEW_FRAME_ANCESTORS = String(process.env.PREVIEW_FRAME_ANCESTORS || '').trim()

function staticHeaders() {
  const frameAncestors = PREVIEW_FRAME_ANCESTORS ? `'self' ${PREVIEW_FRAME_ANCESTORS}` : "'none'"
  const headers = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors ${frameAncestors}`,
  }
  if (!PREVIEW_FRAME_ANCESTORS) headers['x-frame-options'] = 'DENY'
  return headers
}

export async function createApplication({
  database = createDatabase(),
  rootDir = ROOT,
  webDir = WEB_DIR,
  // Enabled by default so a fresh Render deploy works without extra env vars.
  // Set WEB_RUNTIME_ENABLED=false to disable process control entirely.
  webRuntimeEnabled = process.env.WEB_RUNTIME_ENABLED ?? 'true',
  webRuntimeAdminEmails = process.env.WEB_RUNTIME_ADMIN_EMAILS || '',
  webRuntimeOwnerEmail = process.env.WEB_RUNTIME_OWNER_EMAIL || '',
  runtimeManager = null,
} = {}) {
  await database.init()
  const startedAt = Date.now()
  let apiRequests = 0
  const authAllowed = rateLimiter({ limit: 12 })
  const runtimeAllowed = rateLimiter({ limit: 6, windowMs: 5 * 60 * 1000 })
  const runtimeIsEnabled = !['0', 'false', 'no', 'off'].includes(String(webRuntimeEnabled ?? 'true').toLowerCase())
  const pinnedOwnerEmail = String(webRuntimeOwnerEmail || '').trim().toLowerCase()
  const botRuntime = runtimeManager || new WebRuntimeManager({
    rootDir,
    findBot: (id) => loadBotCatalog(rootDir).find((item) => item.id === id),
    enabled: runtimeIsEnabled,
    adminEmails: webRuntimeAdminEmails,
    ownerEmail: pinnedOwnerEmail,
  })

  // Without WEB_RUNTIME_ADMIN_EMAILS the first account of the panel becomes the
  // runtime owner. Resolved lazily so a deploy is usable right after signup and
  // stays consistent across restarts (creation date is persisted in the DB).
  async function resolveRuntimeOwner() {
    if (!botRuntime.enabled || botRuntime.usesAllowlist || botRuntime.ownerEmail) return botRuntime.ownerEmail
    if (pinnedOwnerEmail) return botRuntime.setOwnerEmail(pinnedOwnerEmail)
    let first = null
    try { first = typeof database.firstUser === 'function' ? await database.firstUser() : null } catch { first = null }
    return first ? botRuntime.setOwnerEmail(first.email) : ''
  }
  await resolveRuntimeOwner()

  async function authenticate(req) {
    const token = authToken(req)
    if (!token) return null
    return database.findSessionUser(tokenDigest(token))
  }

  async function requireUser(req, res) {
    const user = await authenticate(req)
    if (!user) {
      jsonResponse(res, 401, { ok: false, error: 'Inicia sesión para continuar.', code: 'AUTH_REQUIRED' })
      return null
    }
    return user
  }

  async function requireRuntimeAdmin(req, res) {
    const user = await requireUser(req, res)
    if (!user) return null
    await resolveRuntimeOwner()
    const error = botRuntime.unavailableError(user)
    if (error) {
      jsonResponse(res, error.status, { ok: false, error: error.message, code: error.code })
      return null
    }
    return user
  }

  async function handleApi(req, res, url) {
    apiRequests += 1
    const method = req.method || 'GET'
    const apiPath = url.pathname.replace(/\/+$/, '') || '/'

    if (method === 'GET' && apiPath === '/api/health') {
      await database.ping()
      return jsonResponse(res, 200, { ok: true, service: 'multibot-panel', database: database.provider, uptimeMs: Date.now() - startedAt, timestamp: new Date().toISOString() })
    }

    if (method === 'GET' && apiPath === '/api/runtime') {
      const user = await requireRuntimeAdmin(req, res)
      if (!user) return
      return jsonResponse(res, 200, {
        ok: true,
        enabled: true,
        canManage: true,
        accessMode: botRuntime.usesAllowlist ? 'allowlist' : 'owner',
        ownerEmail: botRuntime.usesAllowlist ? undefined : botRuntime.ownerEmail,
        maxProcesses: 1,
        credentialStorage: 'filesystem-ephemeral',
        warning: 'Render Free ofrece 512 MB de RAM y 0.1 CPU; puede suspender el servicio y perder la sesión local de Baileys al reiniciar o desplegar.',
        runtimes: botRuntime.list(),
      })
    }

    const runtimeMatch = apiPath.match(/^\/api\/bots\/([a-z0-9][a-z0-9_-]*)\/runtime\/(start|stop)$/i)
    if (runtimeMatch && method === 'POST') {
      if (!runtimeAllowed(req)) return jsonResponse(res, 429, { ok: false, error: 'Demasiados intentos de runtime. Espera cinco minutos antes de volver a intentar.', code: 'RUNTIME_RATE_LIMITED' })
      const user = await requireRuntimeAdmin(req, res)
      if (!user) return
      const [, botId, action] = runtimeMatch
      try {
        if (action === 'start') {
          const body = await readJson(req)
          const runtime = await botRuntime.start(botId, { method: body.method, phoneNumber: body.phoneNumber })
          return jsonResponse(res, 202, { ok: true, runtime })
        }
        const runtime = await botRuntime.stop(botId)
        return jsonResponse(res, 200, { ok: true, runtime })
      } catch (error) {
        const status = Number(error.status) || 500
        return jsonResponse(res, status, { ok: false, error: status >= 500 ? 'No se pudo iniciar o detener el runtime.' : error.message, code: error.code || 'RUNTIME_ERROR' })
      }
    }

    if (method === 'GET' && apiPath === '/api/state') {
      const user = await authenticate(req)
      const bots = loadBotCatalog(rootDir)
      const instances = user ? await database.listInstances(user.id) : []
      const totalPlugins = bots.reduce((sum, bot) => sum + bot.pluginCount, 0)
      return jsonResponse(res, 200, {
        ok: true,
        user: safeUser(user),
        bots,
        instances,
        stats: { availableBots: bots.length, configurations: instances.length, plugins: totalPlugins },
        database: { provider: database.provider }
      })
    }

    if (method === 'GET' && apiPath === '/api/system') {
      const bots = loadBotCatalog(rootDir)
      const counts = await database.counts()
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const cpus = os.cpus()?.length || 1
      const load = os.loadavg?.()[0] || 0
      return jsonResponse(res, 200, {
        ok: true,
        server: {
          hostname: os.hostname(), platform: os.platform(), arch: os.arch(), node: process.versions.node,
          uptimeMs: Date.now() - startedAt, processUptimeMs: process.uptime(),
          cpu: { cores: cpus, loadAverage: Number(load.toFixed(2)), usageEstimate: Math.min(100, Math.round(load / cpus * 100)) },
          memory: { usedBytes: totalMem - freeMem, totalBytes: totalMem, processBytes: process.memoryUsage().rss, usagePercent: totalMem ? Math.round((totalMem - freeMem) / totalMem * 100) : 0 }
        },
        database: { provider: database.provider, status: 'connected', users: Number(counts.users) || 0, configurations: Number(counts.instances) || 0, path: database.provider === 'json' ? 'data/multibot-local.json' : 'Render PostgreSQL' },
        bots: { available: bots.length, plugins: bots.reduce((sum, bot) => sum + bot.pluginCount, 0) },
        counters: { apiRequests }
      })
    }

    if (method === 'GET' && apiPath === '/api/bots') {
      const bots = loadBotCatalog(rootDir)
      return jsonResponse(res, 200, { ok: true, total: bots.length, bots })
    }

    const botMatch = apiPath.match(/^\/api\/bots\/([a-z0-9][a-z0-9_-]*)(?:\/(plugins))?$/i)
    if (method === 'GET' && botMatch) {
      const [, botId, pluginSuffix] = botMatch
      const bot = loadBotCatalog(rootDir).find((item) => item.id === botId)
      if (!bot) return jsonResponse(res, 404, { ok: false, error: 'No se encontró ese bot en bots/.' })
      const plugins = loadPluginCatalog(bot.id, rootDir) || []
      return jsonResponse(res, 200, pluginSuffix ? { ok: true, botId: bot.id, total: plugins.length, plugins } : { ok: true, bot, plugins })
    }

    if (method === 'GET' && apiPath === '/api/plugins') {
      const botId = url.searchParams.get('botId') || 'universal-bot'
      const plugins = loadPluginCatalog(botId, rootDir)
      if (!plugins) return jsonResponse(res, 404, { ok: false, error: 'No se encontró ese bot en bots/.' })
      return jsonResponse(res, 200, { ok: true, botId, total: plugins.length, plugins })
    }

    if (method === 'GET' && apiPath === '/api/endpoints') {
      return jsonResponse(res, 200, { ok: true, endpoints: [
        { method: 'GET', path: '/api/health', auth: false, description: 'Estado del servicio y conexión a base de datos.' },
        { method: 'GET', path: '/api/runtime', auth: 'admin', description: 'Estado de procesos web y QR/Pairing Code; solo la cuenta propietaria o las cuentas autorizadas.' },
        { method: 'POST', path: '/api/bots/:id/runtime/start', auth: 'admin', description: 'Inicia un bot con QR o Pairing Code real; solo la cuenta propietaria o las cuentas autorizadas.' },
        { method: 'POST', path: '/api/bots/:id/runtime/stop', auth: 'admin', description: 'Detiene el proceso del bot; solo la cuenta propietaria o las cuentas autorizadas.' },
        { method: 'GET', path: '/api/state', auth: 'optional', description: 'Catálogo y configuraciones de la cuenta autenticada.' },
        { method: 'GET', path: '/api/system', auth: false, description: 'Telemetría del servidor y base de datos.' },
        { method: 'GET', path: '/api/bots', auth: false, description: 'Lista los bots existentes en bots/.' },
        { method: 'GET', path: '/api/bots/:id', auth: false, description: 'Detalle y plugins de un bot.' },
        { method: 'GET', path: '/api/instances', auth: true, description: 'Configuraciones guardadas de tu cuenta.' },
        { method: 'POST', path: '/api/instances', auth: true, description: 'Guarda una configuración de despliegue.' },
        { method: 'PATCH', path: '/api/instances/:id', auth: true, description: 'Edita una configuración propia.' },
        { method: 'DELETE', path: '/api/instances/:id', auth: true, description: 'Elimina una configuración propia.' },
        { method: 'POST', path: '/api/auth/register', auth: false, description: 'Crea una cuenta para guardar configuraciones.' },
        { method: 'POST', path: '/api/auth/login', auth: false, description: 'Inicia sesión.' }
      ] })
    }

    if (method === 'POST' && (apiPath === '/api/auth/register' || apiPath === '/api/auth/login')) {
      if (!authAllowed(req)) return jsonResponse(res, 429, { ok: false, error: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' })
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (!validateEmail(email)) return jsonResponse(res, 400, { ok: false, error: 'Escribe una dirección de email válida.' })
      if (apiPath === '/api/auth/register' && botRuntime.adminEmails?.has?.(email) && !await database.findUserByEmail(email)) {
        return jsonResponse(res, 403, {
          ok: false,
          error: 'Por seguridad, crea primero la cuenta administradora y luego agrega su email a WEB_RUNTIME_ADMIN_EMAILS en Render.',
          code: 'RUNTIME_ADMIN_ACCOUNT_PRECREATE_REQUIRED',
        })
      }
      if (password.length > 200) return jsonResponse(res, 400, { ok: false, error: 'La contraseña es demasiado larga.' })

      let user
      if (apiPath === '/api/auth/register') {
        const username = normalizeName(body.username || email.split('@')[0])
        if (username.length < 3 || username.length > 32) return jsonResponse(res, 400, { ok: false, error: 'El nombre de usuario debe tener entre 3 y 32 caracteres.' })
        if (password.length < 10) return jsonResponse(res, 400, { ok: false, error: 'Usa una contraseña de al menos 10 caracteres.' })
        user = await database.createUser({ id: randomUUID(), email, username, passwordHash: hashPassword(password), createdAt: new Date().toISOString() })
        if (!user) return jsonResponse(res, 409, { ok: false, error: 'Ya existe una cuenta con ese email. Inicia sesión.' })
        // The first account of a fresh deploy owns the web runtime.
        await resolveRuntimeOwner()
      } else {
        user = await database.findUserByEmail(email)
        if (!user || !verifyPassword(password, user.passwordHash)) return jsonResponse(res, 401, { ok: false, error: 'Email o contraseña incorrectos.' })
      }

      const token = randomBytes(32).toString('base64url')
      await database.createSession({ tokenHash: tokenDigest(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() })
      return jsonResponse(res, apiPath.endsWith('register') ? 201 : 200, { ok: true, token, user: safeUser(user) })
    }

    if (method === 'POST' && apiPath === '/api/auth/logout') {
      const token = authToken(req)
      if (token) await database.deleteSession(tokenDigest(token))
      return jsonResponse(res, 200, { ok: true })
    }

    if (method === 'GET' && apiPath === '/api/auth/me') {
      const user = await requireUser(req, res)
      if (!user) return
      return jsonResponse(res, 200, { ok: true, user: safeUser(user) })
    }

    if (apiPath === '/api/instances' && method === 'GET') {
      const user = await requireUser(req, res)
      if (!user) return
      const instances = await database.listInstances(user.id)
      return jsonResponse(res, 200, { ok: true, instances })
    }

    if (apiPath === '/api/instances' && method === 'POST') {
      const user = await requireUser(req, res)
      if (!user) return
      const body = await readJson(req)
      const name = normalizeName(body.name)
      const botId = String(body.botId || '')
      const prefix = String(body.prefix || '.')
      const pairingMethod = body.pairingMethod === 'qr' ? 'qr' : 'pairing-code'
      const bot = loadBotCatalog(rootDir).find((item) => item.id === botId)
      if (!bot) return jsonResponse(res, 400, { ok: false, error: 'Selecciona un bot que exista dentro de bots/.' })
      if (name.length < 2 || name.length > 48) return jsonResponse(res, 400, { ok: false, error: 'El nombre debe tener entre 2 y 48 caracteres.' })
      if (!ALLOWED_PREFIXES.has(prefix)) return jsonResponse(res, 400, { ok: false, error: 'Ese prefijo no está permitido.' })
      const instance = await database.createInstance({
        id: randomUUID(), userId: user.id, botId, name, prefix, pairingMethod, status: 'configured',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      })
      return jsonResponse(res, 201, { ok: true, instance })
    }

    const instanceMatch = apiPath.match(/^\/api\/instances\/([a-f0-9-]+)(?:\/(pairing|qr))?$/i)
    if (instanceMatch) {
      const user = await requireUser(req, res)
      if (!user) return
      const [, id, operation] = instanceMatch
      if (operation && method === 'POST') {
        return jsonResponse(res, 409, { ok: false, code: 'PROFILE_NOT_RUNTIME', error: 'Este perfil solo guarda preferencias. Para iniciar, abre el detalle del bot y usa sus controles de runtime web si están habilitados.' })
      }
      if (!operation && method === 'GET') {
        const instance = await database.findInstance(user.id, id)
        return instance ? jsonResponse(res, 200, { ok: true, instance }) : jsonResponse(res, 404, { ok: false, error: 'No se encontró esa configuración.' })
      }
      if (!operation && method === 'PATCH') {
        const current = await database.findInstance(user.id, id)
        if (!current) return jsonResponse(res, 404, { ok: false, error: 'No se encontró esa configuración.' })
        const body = await readJson(req)
        const changes = { updatedAt: new Date().toISOString() }
        if (body.name !== undefined) {
          const name = normalizeName(body.name)
          if (name.length < 2 || name.length > 48) return jsonResponse(res, 400, { ok: false, error: 'El nombre debe tener entre 2 y 48 caracteres.' })
          changes.name = name
        }
        if (body.prefix !== undefined) {
          const prefix = String(body.prefix)
          if (!ALLOWED_PREFIXES.has(prefix)) return jsonResponse(res, 400, { ok: false, error: 'Ese prefijo no está permitido.' })
          changes.prefix = prefix
        }
        if (body.pairingMethod !== undefined) changes.pairingMethod = body.pairingMethod === 'qr' ? 'qr' : 'pairing-code'
        const instance = await database.updateInstance(user.id, id, changes)
        return jsonResponse(res, 200, { ok: true, instance })
      }
      if (!operation && method === 'DELETE') {
        const removed = await database.deleteInstance(user.id, id)
        return removed ? jsonResponse(res, 200, { ok: true, deleted: id }) : jsonResponse(res, 404, { ok: false, error: 'No se encontró esa configuración.' })
      }
    }

    return jsonResponse(res, 404, { ok: false, error: 'Ruta API no encontrada.' })
  }

  async function serveStatic(req, res, url) {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      res.writeHead(405, { allow: 'GET, HEAD', ...staticHeaders() });
      return res.end('Método no permitido')
    }
    let decoded
    try { decoded = decodeURIComponent(url.pathname) } catch { return jsonResponse(res, 400, { ok: false, error: 'Ruta inválida.' }) }
    const routePaths = new Set(['/', '/home', '/bots', '/register', '/metrics', '/cmds', '/commands', '/endpoints', '/api-docs', '/store', '/guide', '/tickets', '/support', '/profile', '/favorites'])
    const requested = decoded === '/' ? '/index.html' : decoded
    let filePath = path.resolve(webDir, `.${requested}`)
    if (!filePath.startsWith(`${path.resolve(webDir)}${path.sep}`) && filePath !== path.join(path.resolve(webDir), 'index.html')) {
      res.writeHead(403, staticHeaders()); return res.end('Forbidden')
    }
    if (!existsSync(filePath) || !path.extname(filePath)) {
      if (!path.extname(decoded) && (routePaths.has(decoded) || decoded.startsWith('/bots/'))) filePath = path.join(webDir, 'index.html')
      else if (!path.extname(decoded)) filePath = path.join(webDir, 'index.html')
      else { res.writeHead(404, staticHeaders()); return res.end('Not found') }
    }
    let data
    try { data = readFileSync(filePath) } catch { res.writeHead(404, staticHeaders()); return res.end('Not found') }
    const ext = path.extname(filePath).toLowerCase()
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': data.length, 'cache-control': cache, ...staticHeaders() })
    if (req.method === 'HEAD') return res.end()
    return res.end(data)
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://multibot.local')
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url)
      return await serveStatic(req, res, url)
    } catch (error) {
      if (res.headersSent) return res.end()
      const status = Number(error.status) || 500
      const safeMessage = status < 500 ? error.message : 'Error interno del servidor.'
      if (String(req.url || '').startsWith('/api/')) return jsonResponse(res, status, { ok: false, error: safeMessage })
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...staticHeaders() })
      res.end(safeMessage)
      if (status >= 500) console.error('[multibot-web]', error)
    }
  })

  return {
    server,
    database,
    runtimeManager: botRuntime,
    async listen(port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0') {
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, resolve)
      })
      return server.address()
    },
    async close() {
      await botRuntime.close()
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      await database.close?.()
    }
  }
}

async function main() {
  const app = await createApplication()
  const address = await app.listen()
  console.log(`🤖 MultiBot web listening on http://${address.address}:${address.port} · DB: ${app.database.provider}`)
  const shutdown = async () => {
    try { await app.close() } finally { process.exit(0) }
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('No se pudo iniciar MultiBot web:', error)
    process.exitCode = 1
  })
}
