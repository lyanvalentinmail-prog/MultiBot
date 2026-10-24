import { spawn } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'

const EVENT_PREFIX = 'MULTIBOT_RUNTIME_EVENT:'
const ACTIVE_STATES = new Set(['starting', 'running', 'awaiting-pairing', 'stopping'])
const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g

function errorWithStatus(message, status = 400, code = 'RUNTIME_ERROR') {
  return Object.assign(new Error(message), { status, code })
}

function readJson(filePath) {
  try { return JSON.parse(readFileSync(filePath, 'utf8')) } catch { return {} }
}

export function parseRuntimeAdmins(value = '') {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,\s]+/)
  return new Set(values.map((email) => String(email).trim().toLowerCase()).filter(Boolean))
}

export class WebRuntimeManager {
  constructor({ rootDir, findBot, enabled = false, adminEmails = '', ownerEmail = '', spawnProcess = spawn, maxProcesses = 1 } = {}) {
    this.rootDir = path.resolve(rootDir || process.cwd())
    this.findBot = findBot
    this.enabled = enabled === true
    this.adminEmails = parseRuntimeAdmins(adminEmails)
    this.ownerEmail = ''
    this.spawnProcess = spawnProcess
    this.setOwnerEmail(ownerEmail)
    this.maxProcesses = Math.max(1, Math.min(1, Number(maxProcesses) || 1)) // Render Free: one bot process at a time.
    this.records = new Map()
  }

  /**
   * Owner mode: when no explicit allowlist is configured, the first account of
   * the panel owns the runtime. A fresh deploy therefore works without extra
   * environment variables, while process control stays limited to one account.
   * WEB_RUNTIME_ADMIN_EMAILS always takes precedence when configured.
   */
  setOwnerEmail(email) {
    const normalized = String(email || '').trim().toLowerCase()
    if (normalized) this.ownerEmail = normalized
    return this.ownerEmail
  }

  get usesAllowlist() {
    return this.adminEmails.size > 0
  }

  isOwner(user) {
    const email = String(user?.email || '').trim().toLowerCase()
    return Boolean(email && this.ownerEmail && email === this.ownerEmail)
  }

  isAdmin(user) {
    const email = String(user?.email || '').trim().toLowerCase()
    if (!this.enabled || !email) return false
    if (this.usesAllowlist) return this.adminEmails.has(email)
    return this.isOwner(user)
  }

  unavailableError(user = null) {
    if (!this.enabled) return errorWithStatus('La ejecución web está desactivada. Configura WEB_RUNTIME_ENABLED=true en el servicio.', 503, 'RUNTIME_DISABLED')
    if (!this.usesAllowlist && !this.ownerEmail) {
      return errorWithStatus('Crea la cuenta del panel: la primera cuenta queda como propietaria y podrá desplegar el bot.', 503, 'RUNTIME_OWNER_REQUIRED')
    }
    if (!this.isAdmin(user)) {
      return errorWithStatus(
        this.usesAllowlist
          ? 'Solo las cuentas administradoras configuradas pueden iniciar o detener bots.'
          : 'Solo la cuenta propietaria del panel (la primera cuenta creada) puede desplegar el bot y ver el QR o Pairing Code.',
        403,
        'RUNTIME_FORBIDDEN',
      )
    }
    return null
  }

  list() {
    return [...this.records.values()].map((record) => this.#publicRecord(record))
  }

  get(botId) {
    const record = this.records.get(String(botId))
    return record ? this.#publicRecord(record) : null
  }

  async start(botId, { method = 'qr', phoneNumber = '' } = {}) {
    if (!this.enabled) throw this.unavailableError()
    const bot = this.findBot?.(botId)
    if (!bot || bot.adultContent) throw errorWithStatus('No se encontró un bot disponible para ejecutar.', 404, 'BOT_NOT_FOUND')
    if (!bot.webRuntime || bot.termuxOnly) throw errorWithStatus('Este bot no está habilitado para ejecución web.', 409, 'WEB_RUNTIME_NOT_ALLOWED')
    const normalizedMethod = method === 'pairing-code' ? 'pairing-code' : method === 'qr' ? 'qr' : ''
    if (!normalizedMethod) throw errorWithStatus('Selecciona QR o Pairing Code.', 400, 'INVALID_PAIRING_METHOD')
    if (normalizedMethod === 'qr' && bot.supportsQr === false) {
      throw errorWithStatus('Este bot no declara soporte para vincularse con QR.', 409, 'QR_NOT_SUPPORTED')
    }
    if (normalizedMethod === 'pairing-code' && bot.supportsPairingCode === false) {
      throw errorWithStatus('Este bot no declara soporte para Pairing Code.', 409, 'PAIRING_CODE_NOT_SUPPORTED')
    }
    const normalizedPhone = String(phoneNumber || '').replace(/\D/g, '')
    if (normalizedMethod === 'pairing-code' && (normalizedPhone.length < 8 || normalizedPhone.length > 15)) {
      throw errorWithStatus('Para Pairing Code, ingresa tu número con código de país (8 a 15 dígitos, por ejemplo 59899123456).', 400, 'INVALID_PHONE_NUMBER')
    }

    const existing = this.records.get(bot.id)
    if (existing && ACTIVE_STATES.has(existing.status)) throw errorWithStatus('Este bot ya está iniciado o arrancando.', 409, 'BOT_ALREADY_RUNNING')
    const active = [...this.records.values()].find((record) => ACTIVE_STATES.has(record.status))
    if (active) throw errorWithStatus(`Render Free permite iniciar un bot a la vez; ${active.name} ya está en ejecución.`, 409, 'RUNTIME_CAPACITY_REACHED')

    const botDir = path.resolve(this.rootDir, 'bots', bot.id)
    if (!botDir.startsWith(`${this.rootDir}${path.sep}`)) throw errorWithStatus('Ruta de bot inválida.', 400, 'INVALID_BOT_PATH')
    const manifest = readJson(path.join(botDir, 'bot.json'))
    const pkg = readJson(path.join(botDir, 'package.json'))
    const entry = String(manifest.webEntrypoint || pkg.webEntrypoint || pkg.main || 'index.js')
    const entryPath = path.resolve(botDir, entry)
    if (!entryPath.startsWith(`${botDir}${path.sep}`) || !existsSync(entryPath)) {
      throw errorWithStatus('El punto de entrada del bot no existe o sale de su carpeta.', 400, 'INVALID_BOT_ENTRYPOINT')
    }
    try {
      const realBotDir = realpathSync(botDir)
      const realEntryPath = realpathSync(entryPath)
      if (!realEntryPath.startsWith(`${realBotDir}${path.sep}`)) throw new Error('outside bot directory')
    } catch {
      throw errorWithStatus('No se pudo validar el punto de entrada del bot.', 400, 'INVALID_BOT_ENTRYPOINT')
    }

    this.#prune()
    const record = {
      botId: bot.id,
      name: bot.name,
      status: 'starting',
      method: normalizedMethod,
      phoneNumber: normalizedMethod === 'pairing-code' ? normalizedPhone : '',
      pid: null,
      connected: false,
      startedAt: new Date().toISOString(),
      stoppedAt: null,
      connectedAt: null,
      pairingCode: '',
      qrDataUrl: '',
      qrPayload: '',
      lastError: '',
      logs: [],
      child: null,
      stdoutBuffer: '',
    }
    this.records.set(bot.id, record)

    const env = this.#childEnvironment(bot.id, normalizedMethod, normalizedPhone)
    let child
    try {
      child = this.spawnProcess(process.execPath, [entryPath], {
        cwd: botDir,
        env,
        windowsHide: true,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      record.status = 'error'
      record.lastError = 'No se pudo iniciar el proceso del bot.'
      record.stoppedAt = new Date().toISOString()
      throw errorWithStatus(record.lastError, 500, 'BOT_START_FAILED')
    }

    record.child = child
    child.once('spawn', () => {
      if (record.status === 'starting') record.status = 'running'
      record.pid = child.pid || null
    })
    child.stdout?.on('data', (chunk) => this.#consumeStdout(record, chunk))
    child.stderr?.on('data', (chunk) => this.#appendLog(record, chunk))
    child.once('error', (error) => {
      record.status = 'error'
      record.lastError = String(error?.message || 'Error iniciando el proceso.').slice(0, 300)
      record.stoppedAt = new Date().toISOString()
    })
    child.once('exit', (code, signal) => {
      record.status = code === 0 || signal ? 'stopped' : 'error'
      record.connected = false
      record.pairingCode = ''
      record.qrDataUrl = ''
      record.qrPayload = ''
      record.phoneNumber = ''
      record.stoppedAt = new Date().toISOString()
      if (code && !record.lastError) record.lastError = `El proceso terminó con código ${code}.`
      record.child = null
      record.pid = null
    })
    return this.#publicRecord(record)
  }

  async stop(botId) {
    const record = this.records.get(String(botId))
    if (!record || !ACTIVE_STATES.has(record.status) || !record.child) {
      if (record) return this.#publicRecord(record)
      throw errorWithStatus('No hay un proceso de este bot para detener.', 404, 'BOT_NOT_RUNNING')
    }
    const child = record.child
    record.status = 'stopping'
    record.connected = false
    record.pairingCode = ''
    record.qrDataUrl = ''
    record.qrPayload = ''
    await new Promise((resolve) => {
      let settled = false
      const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve() }
      const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; finish() }, 4500)
      child.once('exit', finish)
      try { child.kill('SIGTERM') } catch { finish() }
    })
    return this.#publicRecord(record)
  }

  async close() {
    const active = [...this.records.values()].filter((record) => ACTIVE_STATES.has(record.status))
    await Promise.allSettled(active.map((record) => this.stop(record.botId)))
  }

  #childEnvironment(botId, method, phoneNumber) {
    const env = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '/tmp',
      TMPDIR: process.env.TMPDIR || '/tmp',
      TEMP: process.env.TEMP || '/tmp',
      TMP: process.env.TMP || '/tmp',
      LANG: process.env.LANG || 'C.UTF-8',
      NODE_ENV: process.env.NODE_ENV || 'production',
      TERM: 'xterm-256color',
      PORT: '0',
      MULTIBOT_WEB_RUNTIME: '1',
      MULTIBOT_RUNTIME_PROTOCOL: '1',
      MULTIBOT_LOGIN_METHOD: method,
      MULTIBOT_LOGIN_PHONE: phoneNumber,
    }
    const prefix = `BOT_${botId.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_`
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value !== undefined) env[key] = value
    }
    return env
  }

  #consumeStdout(record, chunk) {
    record.stdoutBuffer += chunk.toString('utf8')
    if (record.stdoutBuffer.length > 16_384) record.stdoutBuffer = record.stdoutBuffer.slice(-8_192)
    const lines = record.stdoutBuffer.split(/\r?\n/)
    record.stdoutBuffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith(EVENT_PREFIX)) {
        try { void this.#handleEvent(record, JSON.parse(line.slice(EVENT_PREFIX.length))) }
        catch { this.#appendLog(record, '[evento web inválido]') }
      } else this.#appendLog(record, line)
    }
  }

  async #handleEvent(record, event) {
    if (!event || typeof event !== 'object' || record.status === 'stopping' || record.status === 'stopped') return
    if (event.type === 'qr' && typeof event.value === 'string' && event.value.length <= 4096) {
      try {
        record.qrPayload = event.value
        record.qrDataUrl = await QRCode.toDataURL(event.value, { errorCorrectionLevel: 'M', margin: 1, width: 280 })
        record.pairingCode = ''
        record.status = 'awaiting-pairing'
      } catch { record.lastError = 'No se pudo preparar el código QR.' }
    } else if (event.type === 'pairing-code' && typeof event.value === 'string' && /^[A-Z0-9-]{6,20}$/i.test(event.value)) {
      record.pairingCode = event.value
      record.qrDataUrl = ''
      record.qrPayload = ''
      record.status = 'awaiting-pairing'
    } else if (event.type === 'pairing-error' && typeof event.value === 'string') {
      record.lastError = event.value.slice(0, 300)
      this.#appendLog(record, `Pairing Code: ${event.value}`)
      if (record.status === 'starting') record.status = 'running'
    } else if (event.type === 'connected') {
      record.connected = true
      record.connectedAt = new Date().toISOString()
      record.status = 'running'
      record.pairingCode = ''
      record.qrDataUrl = ''
      record.qrPayload = ''
      this.#appendLog(record, 'WhatsApp conectado.')
    } else if (event.type === 'disconnected') {
      record.connected = false
      record.pairingCode = ''
      record.qrDataUrl = ''
      record.qrPayload = ''
      if (ACTIVE_STATES.has(record.status)) record.status = 'running'
    }
  }

  #appendLog(record, value) {
    let safeValue = String(value || '')
    if (record.phoneNumber) {
      safeValue = safeValue.replaceAll(record.phoneNumber, '[número oculto]')
      safeValue = safeValue.replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, '[número oculto]')
    }
    if (record.pairingCode) safeValue = safeValue.replaceAll(record.pairingCode, '[código oculto]')
    safeValue = safeValue.replace(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/gi, '[código oculto]')
    if (record.qrPayload) safeValue = safeValue.replaceAll(record.qrPayload, '[QR oculto]')
    const line = safeValue.replace(ANSI_ESCAPE, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 500)
    if (!line || line.startsWith(EVENT_PREFIX)) return
    record.logs.push({ at: new Date().toISOString(), message: line })
    if (record.logs.length > 80) record.logs.splice(0, record.logs.length - 80)
    if (/fatal|error|failed|no se pudo/i.test(line) && !record.lastError) record.lastError = line.slice(0, 300)
  }

  #prune() {
    const finished = [...this.records.entries()].filter(([, record]) => !ACTIVE_STATES.has(record.status))
    finished.sort((a, b) => String(b[1].stoppedAt || '').localeCompare(String(a[1].stoppedAt || '')))
    for (const [botId] of finished.slice(20)) this.records.delete(botId)
  }

  #publicRecord(record) {
    return {
      botId: record.botId,
      name: record.name,
      status: record.status,
      method: record.method,
      pid: record.pid,
      connected: record.connected,
      startedAt: record.startedAt,
      stoppedAt: record.stoppedAt,
      connectedAt: record.connectedAt,
      pairingCode: record.pairingCode,
      qrDataUrl: record.qrDataUrl,
      lastError: record.lastError,
      logs: record.logs,
    }
  }
}
