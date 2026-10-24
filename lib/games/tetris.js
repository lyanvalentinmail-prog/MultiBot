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

export const TETRIS_WIDTH = 10
export const TETRIS_HEIGHT = 12
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const BASE = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]]
}
const COLORS = { I: '🟦', O: '🟨', T: '🟪', S: '🟩', Z: '🟥', J: '🔷', L: '🟧' }
const ACTIONS = {
  a: 'left', izquierda: 'left', left: 'left',
  d: 'right', derecha: 'right', right: 'right',
  r: 'rotate', rotar: 'rotate', rotate: 'rotate',
  s: 'down', bajar: 'down', abajo: 'down', down: 'down',
  drop: 'drop', soltar: 'drop', caida: 'drop'
}

function normalize(cells) {
  const minX = Math.min(...cells.map(([x]) => x))
  const minY = Math.min(...cells.map(([, y]) => y))
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

function buildRotations(type) {
  const rotations = [normalize(BASE[type])]
  for (let turn = 1; turn < 4; turn += 1) {
    const previous = rotations[turn - 1]
    const height = Math.max(...previous.map(([, y]) => y)) + 1
    rotations.push(normalize(previous.map(([x, y]) => [height - 1 - y, x])))
  }
  return rotations
}

const ROTATIONS = Object.fromEntries(TYPES.map(type => [type, buildRotations(type)]))

function shuffledBag(random) {
  const bag = [...TYPES]
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[bag[index], bag[other]] = [bag[other], bag[index]]
  }
  return bag
}

export function tetrisCells(piece) {
  if (!piece) return []
  return ROTATIONS[piece.type][piece.rotation].map(([x, y]) => ({ x: x + piece.x, y: y + piece.y, type: piece.type }))
}

function collides(board, piece) {
  return tetrisCells(piece).some(({ x, y }) => x < 0 || x >= TETRIS_WIDTH || y >= TETRIS_HEIGHT || (y >= 0 && board[y][x]))
}

function fillQueue(state, random) {
  while (state.queue.length < 8) state.queue.push(...shuffledBag(random))
}

function spawn(state, random) {
  fillQueue(state, random)
  const type = state.queue.shift()
  fillQueue(state, random)
  const width = Math.max(...ROTATIONS[type][0].map(([x]) => x)) + 1
  state.piece = { type, rotation: 0, x: Math.floor((TETRIS_WIDTH - width) / 2), y: 0 }
  if (collides(state.board, state.piece)) {
    state.status = 'over'
    state.reason = 'No hay espacio para la siguiente pieza.'
  }
}

export function createTetrisState(random = Math.random) {
  const state = {
    board: Array.from({ length: TETRIS_HEIGHT }, () => Array(TETRIS_WIDTH).fill('')),
    piece: null,
    queue: [],
    score: 0,
    lines: 0,
    level: 1,
    status: 'active',
    reason: ''
  }
  spawn(state, random)
  return state
}

function lockAndSpawn(state, random) {
  const cells = tetrisCells(state.piece)
  if (cells.some(cell => cell.y < 0)) {
    state.status = 'over'
    state.reason = 'La pila llegó hasta arriba.'
    return
  }
  for (const { x, y, type } of cells) state.board[y][x] = type
  const remaining = state.board.filter(row => row.some(cell => !cell))
  const cleared = TETRIS_HEIGHT - remaining.length
  state.board = [...Array.from({ length: cleared }, () => Array(TETRIS_WIDTH).fill('')), ...remaining]
  if (cleared) {
    state.lines += cleared
    state.score += ([0, 100, 300, 500, 800][cleared] || 1200) * state.level
    state.level = Math.floor(state.lines / 10) + 1
  }
  spawn(state, random)
}

export function advanceTetris(state, action, random = Math.random) {
  if (state.status !== 'active') throw new GameRuleError('La partida terminó. Usa «Reiniciar» o .tetris reiniciar.')
  const normalized = ACTIONS[String(action || '').toLowerCase()]
  if (!normalized) throw new GameRuleError('Usa izquierda, derecha, rotar, bajar o soltar.')
  const next = {
    ...state,
    board: state.board.map(row => [...row]),
    piece: { ...state.piece },
    queue: [...state.queue]
  }
  if (normalized === 'left' || normalized === 'right') {
    const candidate = { ...next.piece, x: next.piece.x + (normalized === 'left' ? -1 : 1) }
    if (!collides(next.board, candidate)) next.piece = candidate
    return next
  }
  if (normalized === 'rotate') {
    const rotation = (next.piece.rotation + 1) % 4
    for (const kick of [0, -1, 1, -2, 2]) {
      const candidate = { ...next.piece, rotation, x: next.piece.x + kick }
      if (!collides(next.board, candidate)) {
        next.piece = candidate
        break
      }
    }
    return next
  }
  if (normalized === 'down') {
    const candidate = { ...next.piece, y: next.piece.y + 1 }
    if (!collides(next.board, candidate)) {
      next.piece = candidate
      next.score += 1
    } else {
      lockAndSpawn(next, random)
    }
    return next
  }
  let distance = 0
  while (!collides(next.board, { ...next.piece, y: next.piece.y + 1 })) {
    next.piece.y += 1
    distance += 1
  }
  next.score += distance * 2
  lockAndSpawn(next, random)
  return next
}

export function renderTetris(state) {
  const board = state.board.map(row => [...row])
  for (const { x, y, type } of tetrisCells(state.piece)) {
    if (y >= 0 && y < TETRIS_HEIGHT && x >= 0 && x < TETRIS_WIDTH) board[y][x] = type
  }
  const rows = board.map(row => `⬛${row.map(cell => cell ? COLORS[cell] : '▫️').join('')}⬛`)
  const border = `⬛${'⬛'.repeat(TETRIS_WIDTH)}⬛`
  const status = state.status === 'active'
    ? 'Botones: mover, rotar, bajar y soltar. También: *.tetris rotar*.'
    : `🏁 ${state.reason}`
  return `🧱 *Tetris*\n${border}\n${rows.join('\n')}\n${border}\n\n🏆 Puntos: *${state.score}* · Líneas: ${state.lines} · Nivel: ${state.level}\nSiguiente: ${COLORS[state.queue[0]] || '—'} ${state.queue[0] || ''}\n${status}`
}

function controls(session) {
  return [
    gameButton(session, 'left', '⬅️'),
    gameButton(session, 'rotate', '🔄 Rotar'),
    gameButton(session, 'right', '➡️'),
    gameButton(session, 'down', '⬇️ Bajar'),
    gameButton(session, 'drop', '⚡ Soltar')
  ]
}

export async function tetrisCommand(ctx, argsText = '') {
  return runGameCommand(ctx, async () => {
    const input = argsText.trim().toLowerCase()
    let session = findGameSession('tetris', ctx, { ownerOnly: true, activeOnly: true })
    const restart = ['reiniciar', 'restart', 'nuevo'].includes(input)
    if (!input || restart || !session || !ACTIONS[input]) {
      if (input && !restart && !ACTIONS[input]) throw new GameRuleError('Usa izquierda, derecha, rotar, bajar o soltar.')
      if (session) deleteGameSession(session)
      session = createGameSession('tetris', ctx, createTetrisState())
      return presentGame(ctx, session, renderTetris(session.state), controls(session))
    }
    session.state = advanceTetris(session.state, input)
    session.status = session.state.status === 'active' ? 'active' : 'over'
    return updateGame(ctx, session, renderTetris(session.state), session.status === 'over' ? [gameButton(session, 'restart', '🔄 Reiniciar')] : [])
  })
}

export async function tetrisAction(ctx, session, action) {
  assertGameUser(ctx, session)
  if (action === 'restart') {
    session.state = createTetrisState()
    session.status = 'active'
    return updateGame(ctx, session, renderTetris(session.state), controls(session))
  }
  session.state = advanceTetris(session.state, action)
  session.status = session.state.status === 'active' ? 'active' : 'over'
  return updateGame(ctx, session, renderTetris(session.state), session.status === 'over' ? [gameButton(session, 'restart', '🔄 Reiniciar')] : [])
}
