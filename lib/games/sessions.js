import { randomBytes } from 'node:crypto'

const SESSION_TTL_MS = 2 * 60 * 60 * 1000
const sessions = new Map()

export class GamePermissionError extends Error {
  constructor(message = 'Solo el jugador o creador puede realizar esta acción.') {
    super(message)
    this.name = 'GamePermissionError'
  }
}

export class GameRuleError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GameRuleError'
  }
}

export function getGameContext(ctx) {
  const sock = ctx.sock || ctx.conn
  return {
    sock,
    botJid: sock?.user?.id || sock?.user?.jid || '',
    chatJid: ctx.chatJid || ctx.m?.chat || '',
    senderJid: ctx.senderJid || ctx.sender || ctx.m?.sender || '',
    senderName: String(ctx.pushName || ctx.m?.pushName || 'Jugador').replace(/[@\n\r]/g, ' ').trim().slice(0, 24) || 'Jugador',
    isGroup: Boolean(ctx.isGroup ?? ctx.m?.isGroup)
  }
}

export function sameUser(first, second) {
  if (!first || !second) return false
  if (first === second) return true
  const number = value => String(value).split('@')[0].split(':')[0].replace(/\D/g, '')
  const a = number(first)
  const b = number(second)
  return Boolean(a && b && a === b)
}

export function assertGameUser(ctx, session, allowed = [session.ownerJid]) {
  const { senderJid } = getGameContext(ctx)
  if (!allowed.some(jid => sameUser(jid, senderJid))) {
    throw new GamePermissionError()
  }
}

export function createGameSession(kind, ctx, state = {}, options = {}) {
  sweepGameSessions()
  const { botJid, chatJid, senderJid, senderName } = getGameContext(ctx)
  if (!chatJid || !senderJid) throw new GameRuleError('No pude identificar este chat o jugador.')
  // Una persona tiene una sola partida activa de cada tipo por chat. La sala
  // multijugador es compartida y, por tanto, única para todo el grupo.
  for (const [existingId, existing] of sessions) {
    const sameScope = existing.kind === kind && existing.chatJid === chatJid && (!existing.botJid || !botJid || existing.botJid === botJid)
    if (sameScope && (kind === 'multiplayer' || sameUser(existing.ownerJid, senderJid))) sessions.delete(existingId)
  }
  const id = randomBytes(4).toString('hex')
  const now = Date.now()
  const session = {
    id,
    kind,
    botJid,
    chatJid,
    ownerJid: senderJid,
    ownerName: senderName,
    status: options.status || 'active',
    state,
    messageKey: null,
    createdAt: now,
    updatedAt: now
  }
  sessions.set(id, session)
  return session
}

export function getGameSession(id) {
  const session = sessions.get(id)
  if (!session) return null
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessions.delete(id)
    return null
  }
  return session
}

export function sessionMatchesChat(session, ctx) {
  const { botJid, chatJid } = getGameContext(ctx)
  return session.chatJid === chatJid && (!session.botJid || !botJid || session.botJid === botJid)
}

export function findGameSession(kind, ctx, options = {}) {
  sweepGameSessions()
  const { botJid, chatJid, senderJid } = getGameContext(ctx)
  const matches = [...sessions.values()].filter(session => {
    if (session.kind !== kind || session.chatJid !== chatJid) return false
    if (session.botJid && botJid && session.botJid !== botJid) return false
    if (options.ownerOnly && !sameUser(session.ownerJid, senderJid)) return false
    if (options.playerOnly && ![session.ownerJid, ...(session.state?.players || []).map(player => player.jid)].some(jid => sameUser(jid, senderJid))) return false
    if (options.activeOnly && !['active', 'lobby', 'difficulty'].includes(session.status)) return false
    return true
  })
  return matches.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null
}

export function deleteGameSession(session) {
  sessions.delete(session.id)
}

export function clearGameSessions() {
  sessions.clear()
}

export function gameButton(session, action, label) {
  return { id: `mbg:${session.id}:${action}`, label }
}

export function parseGameButton(value) {
  const match = /^mbg:([a-f0-9]{8}):([a-z0-9:_-]+)$/i.exec(String(value || '').trim())
  return match ? { id: match[1], action: match[2] } : null
}

export async function presentGame(ctx, session, text, buttons = []) {
  session.updatedAt = Date.now()
  const result = await ctx.reply(text)
  if (result?.key) session.messageKey = result.key
  if (buttons.length) await sendGameControls(ctx, session, buttons)
  return result
}

export async function sendGameControls(ctx, session, buttons, text = '🎮 Controles') {
  if (!buttons.length) return null
  const { chatJid } = getGameContext(ctx)
  const rows = buttons.map(button => {
    if (button.id) return button
    return gameButton(session, button.action, button.label)
  })
  let result = null
  for (let index = 0; index < rows.length; index += 3) {
    result = await ctx.sendButtons({
      chatJid,
      text: index ? `${text} (continuación)` : text,
      footer: `Partida ${session.id} · ${session.kind}`,
      buttons: rows.slice(index, index + 3),
      layout: 'horizontal'
    })
  }
  return result
}

export async function updateGame(ctx, session, text, buttons = []) {
  session.updatedAt = Date.now()
  const { sock, chatJid } = getGameContext(ctx)
  let result = null
  if (session.messageKey && sock?.sendMessage) {
    try {
      result = await sock.sendMessage(chatJid, { text, edit: session.messageKey })
    } catch (error) {
      ctx.logger?.warn?.({ err: error, game: session.kind }, 'No se pudo editar el tablero; se enviará uno nuevo')
    }
  }
  if (!result) {
    result = await ctx.reply(text)
    if (result?.key) session.messageKey = result.key
  }
  if (buttons.length) await sendGameControls(ctx, session, buttons)
  return result
}

export async function runGameCommand(ctx, operation) {
  try {
    return await operation()
  } catch (error) {
    if (ctx.m) ctx.m.commandFailed = true
    const denied = error instanceof GamePermissionError
    await ctx.react?.(denied ? '🚫' : '⚠️')
    const message = error instanceof GameRuleError || denied
      ? error.message
      : 'Ocurrió un error inesperado. Intenta nuevamente.'
    if (!(error instanceof GameRuleError) && !denied) ctx.logger?.error?.({ err: error }, 'Error en minijuego')
    await ctx.reply(`${denied ? '🚫' : '⚠️'} ${message}`)
    return null
  }
}

export function sweepGameSessions(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS || session.status === 'closed') sessions.delete(id)
  }
}
