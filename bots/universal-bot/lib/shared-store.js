import path from 'node:path'
import { LiveMessages } from '../../../lib/wa/live-messages.js'
import { PackSessionStore } from './pack-session.js'
import { UNIVERSAL_ROOT } from './shared-config.js'

/** Última búsqueda de paquetes por chat, con vencimiento automático. */
export class UniversalSearchStore {
  constructor({ ttlMinutes = 10, maxEntries = 500 } = {}) {
    this.ttlMs = Math.max(1, Number(ttlMinutes) || 10) * 60 * 1000
    this.maxEntries = maxEntries
    this.entries = new Map()
  }

  save(chatJid, { query = '', kind = 'packs', results = [], provider = 'stickerly' } = {}) {
    const entry = { chatJid: String(chatJid), query, kind, provider, results, createdAt: Date.now() }
    this.entries.set(entry.chatJid, entry)
    this.prune()
    return entry
  }

  get(chatJid) {
    const key = String(chatJid)
    const entry = this.entries.get(key)
    if (!entry) return null
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.entries.delete(key)
      return null
    }
    return entry
  }

  pick(chatJid, position) {
    const entry = this.get(chatJid)
    if (!entry) return { entry: null, item: null }
    const index = Number(position) - 1
    if (!Number.isInteger(index) || index < 0 || index >= entry.results.length) {
      return { entry, item: null }
    }
    return { entry, item: entry.results[index] }
  }

  clear(chatJid) {
    return this.entries.delete(String(chatJid))
  }

  prune() {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > this.ttlMs) this.entries.delete(key)
    }
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value)
    }
  }

  get size() {
    return this.entries.size
  }
}

let store = null

/** Estado compartido por todos los sockets de Universal en este proceso. */
export function getUniversalStore(logger = console) {
  if (store) return store
  store = {
    messages: new LiveMessages({
      persistFile: path.join(UNIVERSAL_ROOT, 'storage', 'live-messages.json')
    }),
    packs: new PackSessionStore({ ttlMinutes: 10, maxStickers: 30, logger }),
    searches: new UniversalSearchStore({ ttlMinutes: 10 })
  }
  return store
}

export default getUniversalStore
