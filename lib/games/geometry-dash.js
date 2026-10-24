import {
  GameRuleError,
  assertGameUser,
  createGameSession,
  deleteGameSession,
  findGameSession,
  gameButton,
  presentGame,
  runGameCommand,
  updateGame
} from './sessions.js'

const ACTIONS = { correr: 'run', run: 'run', avanzar: 'run', saltar: 'jump', jump: 'jump', salto: 'jump' }

export function createGeometryState(random = Math.random) {
  const length = 32
  const obstacles = []
  const coins = []
  let position = 5
  while (position < length - 3) {
    obstacles.push(position)
    if (random() > 0.25) coins.push(Math.min(length - 2, position + 1))
    position += 4 + Math.floor(random() * 4)
  }
  return {
    length,
    position: 0,
    obstacles,
    coins,
    collected: [],
    score: 0,
    steps: 0,
    cooldown: 0,
    airborne: false,
    status: 'active',
    reason: ''
  }
}

export function advanceGeometry(state, action) {
  if (state.status !== 'active') throw new GameRuleError('La carrera terminó. Usa «Reiniciar» o .gd reiniciar.')
  const normalized = ACTIONS[String(action || '').toLowerCase()]
  if (!normalized) throw new GameRuleError('Usa correr o saltar.')
  if (normalized === 'jump' && state.cooldown > 0) throw new GameRuleError('Debes aterrizar con «Correr» antes de volver a saltar.')
  const next = { ...state, obstacles: [...state.obstacles], coins: [...state.coins], collected: [...state.collected] }
  const distance = normalized === 'jump' ? 3 : 2
  const destination = Math.min(next.length, next.position + distance)
  const path = Array.from({ length: destination - next.position }, (_, index) => next.position + index + 1)
  const hit = path.find(position => next.obstacles.includes(position))
  next.steps += 1
  if (hit && normalized !== 'jump') {
    next.position = hit
    next.airborne = false
    next.status = 'over'
    next.reason = `Chocaste contra un obstáculo en la posición ${hit}.`
    return next
  }
  const collectedNow = path.filter(position => next.coins.includes(position) && !next.collected.includes(position))
  next.collected.push(...collectedNow)
  next.score += 5 + collectedNow.length * 25
  next.position = destination
  next.airborne = normalized === 'jump'
  next.cooldown = normalized === 'jump' ? 1 : 0
  if (destination >= next.length) {
    next.status = 'won'
    next.score += 100
    next.airborne = false
    next.reason = '¡Nivel completado!'
  }
  return next
}

export function renderGeometry(state) {
  const start = Math.max(0, Math.min(state.position - 4, state.length - 18))
  const end = Math.min(state.length, start + 18)
  let air = ''
  let ground = ''
  for (let position = start; position <= end; position += 1) {
    const player = position === state.position
    air += player && state.airborne ? '🟨' : state.coins.includes(position) && !state.collected.includes(position) ? '🟡' : '⬛'
    ground += player && !state.airborne ? '🟨' : state.obstacles.includes(position) ? '🔺' : position === state.length ? '🏁' : '🟫'
  }
  const progress = Math.min(100, Math.round(state.position / state.length * 100))
  const status = state.status === 'active'
    ? `El salto evita obstáculos y avanza 3 espacios; después debes aterrizar.\nComandos: *.gd correr* y *.gd saltar*.\nProgreso: ${progress}%`
    : `🏁 ${state.reason}`
  return `🟧 *Geometry Dash*\n\n${air}\n${ground}\n\n🪙 Monedas: ${state.collected.length} · Puntos: *${state.score}*\n${status}`
}

function controls(session) {
  return [gameButton(session, 'run', '👟 Correr'), gameButton(session, 'jump', '🟨 Saltar')]
}

export async function geometryCommand(ctx, argsText = '') {
  return runGameCommand(ctx, async () => {
    const input = argsText.trim().toLowerCase()
    let session = findGameSession('geometry', ctx, { ownerOnly: true, activeOnly: true })
    const restart = ['reiniciar', 'restart', 'nuevo'].includes(input)
    if (!input || restart || !session || !ACTIONS[input]) {
      if (input && !restart && !ACTIONS[input]) throw new GameRuleError('Usa correr o saltar.')
      if (session) deleteGameSession(session)
      session = createGameSession('geometry', ctx, createGeometryState())
      return presentGame(ctx, session, renderGeometry(session.state), controls(session))
    }
    session.state = advanceGeometry(session.state, input)
    session.status = session.state.status
    return updateGame(ctx, session, renderGeometry(session.state), session.status !== 'active' ? [gameButton(session, 'restart', '🔄 Reiniciar')] : [])
  })
}

export async function geometryAction(ctx, session, action) {
  assertGameUser(ctx, session)
  if (action === 'restart') {
    session.state = createGeometryState()
    session.status = 'active'
    return updateGame(ctx, session, renderGeometry(session.state), controls(session))
  }
  session.state = advanceGeometry(session.state, action)
  session.status = session.state.status
  return updateGame(ctx, session, renderGeometry(session.state), session.status !== 'active' ? [gameButton(session, 'restart', '🔄 Reiniciar')] : [])
}
