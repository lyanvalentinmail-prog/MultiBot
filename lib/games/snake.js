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

export const SNAKE_WIDTH = 10
export const SNAKE_HEIGHT = 8
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
}
const ORDER = ['up', 'right', 'down', 'left']
const ALIASES = {
  w: 'up', arriba: 'up', up: 'up',
  s: 'down', abajo: 'down', down: 'down',
  a: 'left', izquierda: 'left', left: 'left',
  d: 'right', derecha: 'right', right: 'right',
  f: 'forward', avanzar: 'forward', forward: 'forward',
  turnleft: 'turnleft', turnright: 'turnright'
}

function key(cell) {
  return `${cell.x},${cell.y}`
}

function placeFood(snake, random = Math.random) {
  const occupied = new Set(snake.map(key))
  const free = []
  for (let y = 0; y < SNAKE_HEIGHT; y += 1) {
    for (let x = 0; x < SNAKE_WIDTH; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y })
    }
  }
  if (!free.length) return null
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))]
}

export function createSnakeState(random = Math.random) {
  const snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]
  return {
    snake,
    food: placeFood(snake, random),
    direction: 'right',
    score: 0,
    moves: 0,
    status: 'active',
    reason: ''
  }
}

export function advanceSnake(state, action, random = Math.random) {
  if (state.status !== 'active') throw new GameRuleError('La partida terminó. Usa «Reiniciar» o .snake reiniciar.')
  const normalized = ALIASES[String(action || '').toLowerCase()]
  if (!normalized) throw new GameRuleError('Movimiento desconocido. Usa arriba, abajo, izquierda, derecha o avanzar.')
  let direction = state.direction
  if (DIRECTIONS[normalized]) {
    const current = DIRECTIONS[direction]
    const requested = DIRECTIONS[normalized]
    if (current.x + requested.x === 0 && current.y + requested.y === 0) {
      throw new GameRuleError('La serpiente no puede retroceder sobre su propio cuerpo.')
    }
    direction = normalized
  } else if (normalized === 'turnleft' || normalized === 'turnright') {
    const index = ORDER.indexOf(direction)
    direction = ORDER[(index + (normalized === 'turnleft' ? 3 : 1)) % 4]
  }
  const vector = DIRECTIONS[direction]
  const head = state.snake[0]
  const next = { x: head.x + vector.x, y: head.y + vector.y }
  const outside = next.x < 0 || next.x >= SNAKE_WIDTH || next.y < 0 || next.y >= SNAKE_HEIGHT
  const eating = !outside && next.x === state.food?.x && next.y === state.food?.y
  const collisionBody = state.snake.slice(0, eating ? state.snake.length : -1).some(cell => cell.x === next.x && cell.y === next.y)
  const result = {
    ...state,
    snake: state.snake.map(cell => ({ ...cell })),
    direction,
    moves: state.moves + 1
  }
  if (outside || collisionBody) {
    result.status = 'over'
    result.reason = outside ? 'Chocaste contra la pared.' : 'Chocaste contra tu propio cuerpo.'
    return result
  }
  result.snake.unshift(next)
  if (eating) {
    result.score += 10
    result.food = placeFood(result.snake, random)
    if (!result.food) {
      result.status = 'won'
      result.reason = '¡Completaste todo el tablero!'
    }
  } else {
    result.snake.pop()
  }
  return result
}

export function renderSnake(state) {
  const snake = new Map(state.snake.map((cell, index) => [key(cell), index]))
  const rows = []
  for (let y = 0; y < SNAKE_HEIGHT; y += 1) {
    let row = ''
    for (let x = 0; x < SNAKE_WIDTH; x += 1) {
      const part = snake.get(`${x},${y}`)
      row += part === 0 ? '🟢' : part > 0 ? '🟩' : state.food?.x === x && state.food?.y === y ? '🍎' : '⬛'
    }
    rows.push(`🟦${row}🟦`)
  }
  const border = `🟦${'🟦'.repeat(SNAKE_WIDTH)}🟦`
  const status = state.status === 'active' ? 'Usa los botones o *.snake arriba/abajo/izquierda/derecha*.' : `🏁 ${state.reason}`
  return `🐍 *Snake*\n${border}\n${rows.join('\n')}\n${border}\n\n🍎 Puntos: *${state.score}* · Movimientos: ${state.moves}\n${status}`
}

function controls(session) {
  return [
    gameButton(session, 'turnleft', '↺ Izquierda'),
    gameButton(session, 'forward', '⬆️ Avanzar'),
    gameButton(session, 'turnright', '↻ Derecha')
  ]
}

export async function snakeCommand(ctx, argsText = '') {
  return runGameCommand(ctx, async () => {
    const input = argsText.trim().toLowerCase()
    let session = findGameSession('snake', ctx, { ownerOnly: true, activeOnly: true })
    const restart = ['reiniciar', 'restart', 'nuevo'].includes(input)
    if (!input || restart || !session || !ALIASES[input]) {
      if (input && !restart && !ALIASES[input]) throw new GameRuleError('Movimiento desconocido.')
      if (session) deleteGameSession(session)
      session = createGameSession('snake', ctx, createSnakeState())
      return presentGame(ctx, session, renderSnake(session.state), controls(session))
    }
    session.state = advanceSnake(session.state, input)
    session.status = session.state.status === 'active' ? 'active' : 'over'
    return updateGame(ctx, session, renderSnake(session.state), session.status === 'over' ? [gameButton(session, 'restart', '🔄 Reiniciar')] : [])
  })
}

export async function snakeAction(ctx, session, action) {
  assertGameUser(ctx, session)
  if (action === 'restart') {
    session.state = createSnakeState()
    session.status = 'active'
    return updateGame(ctx, session, renderSnake(session.state), controls(session))
  }
  session.state = advanceSnake(session.state, action)
  session.status = session.state.status === 'active' ? 'active' : 'over'
  return updateGame(ctx, session, renderSnake(session.state), session.status === 'over' ? [gameButton(session, 'restart', '🔄 Reiniciar')] : [])
}
