import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'

import { evaluateExpression } from '../../lib/games/calculator.js'
import { advanceSnake, createSnakeState } from '../../lib/games/snake.js'
import { advanceTetris, createTetrisState } from '../../lib/games/tetris.js'
import { advanceGeometry, createGeometryState } from '../../lib/games/geometry-dash.js'
import { chessAction, chessCommand, chooseBotMove } from '../../lib/games/chess.js'
import { advanceRace, multiplayerCommand } from '../../lib/games/multiplayer.js'
import { routeGameInteraction } from '../../lib/games/router.js'
import { clearGameSessions, findGameSession } from '../../lib/games/sessions.js'
import { snakeCommand } from '../../lib/games/snake.js'
import { translateText } from '../../lib/games/translator.js'

const BOT = '59890000000@s.whatsapp.net'
const OWNER = '59891111111@s.whatsapp.net'
const GUEST = '59892222222@s.whatsapp.net'
const THIRD = '59893333333@s.whatsapp.net'

function fakeContext(sender = OWNER, { group = false, text = '' } = {}) {
  const chat = group ? '120363000000000000@g.us' : sender
  const sent = { messages: [], buttons: [], reactions: [] }
  const sock = {
    user: { id: BOT },
    async sendMessage(chatJid, content) {
      const message = { chatJid, content, key: { remoteJid: chatJid, id: `message-${sent.messages.length + 1}` } }
      sent.messages.push(message)
      return message
    }
  }
  const ctx = {
    sock,
    chatJid: chat,
    senderJid: sender,
    isGroup: group,
    pushName: sender === OWNER ? 'Creador' : sender === GUEST ? 'Invitado' : 'Tercero',
    text,
    m: { chat, sender, text, key: { remoteJid: chat, id: `incoming-${sent.messages.length + 1}` } },
    config: { ai: {} },
    logger: { error() {}, warn() {}, debug() {} },
    async reply(value) { return sock.sendMessage(chat, { text: String(value) }) },
    async sendButtons(value) { sent.buttons.push(value); return { key: { id: `buttons-${sent.buttons.length}` } } },
    async react(emoji) { sent.reactions.push(emoji) }
  }
  return { ctx, sent }
}

test('calculadora: respeta precedencia, funciones, potencias y unary minus', () => {
  assert.equal(evaluateExpression('2 + 3 * 4'), 14)
  assert.equal(evaluateExpression('sqrt(81) + 2^3'), 17)
  assert.equal(evaluateExpression('-2^2'), -4)
  assert.equal(evaluateExpression('pow(5, 3)'), 125)
  assert.equal(evaluateExpression('sin(90)'), 1)
})

test('calculadora: rechaza división por cero y código que no sea una expresión', () => {
  assert.throws(() => evaluateExpression('1 / 0'), /dividir entre cero/)
  assert.throws(() => evaluateExpression('process.exit()'), /Función desconocida|formato inválido|no es válido/)
  assert.throws(() => evaluateExpression('2; process.exit()'), /no es válido/)
})

test('snake: avanza, gira, crece al comer y termina al chocar', () => {
  const initial = createSnakeState(() => 0)
  const moved = advanceSnake(initial, 'forward', () => 0)
  assert.deepEqual(moved.snake[0], { x: 5, y: 4 })
  const turned = advanceSnake(moved, 'turnleft', () => 0)
  assert.deepEqual(turned.snake[0], { x: 5, y: 3 })

  const eatingState = {
    ...initial,
    snake: [{ x: 1, y: 0 }, { x: 1, y: 1 }],
    food: { x: 2, y: 0 },
    direction: 'right'
  }
  const eaten = advanceSnake(eatingState, 'forward', () => 0)
  assert.equal(eaten.score, 10)
  assert.equal(eaten.snake.length, 3)

  const wall = { ...initial, snake: [{ x: 0, y: 0 }], direction: 'left', food: { x: 8, y: 7 } }
  assert.equal(advanceSnake(wall, 'forward').status, 'over')
  assert.throws(() => advanceSnake(initial, 'left'), /no puede retroceder/)
})

test('tetris: rota, suelta piezas y limpia líneas con puntuación', () => {
  const state = createTetrisState(() => 0)
  state.piece = { type: 'T', rotation: 0, x: 3, y: 0 }
  const rotated = advanceTetris(state, 'rotate', () => 0)
  assert.equal(rotated.piece.rotation, 1)

  const dropped = advanceTetris(rotated, 'drop', () => 0)
  assert.ok(dropped.board.some(row => row.some(Boolean)))
  assert.ok(dropped.score >= 0)

  const line = createTetrisState(() => 0)
  line.board = Array.from({ length: 12 }, () => Array(10).fill(''))
  line.board[11] = Array(10).fill('I')
  for (let x = 3; x <= 6; x += 1) line.board[11][x] = ''
  line.piece = { type: 'I', rotation: 0, x: 3, y: 11 }
  line.queue = ['O', 'T', 'S', 'Z', 'J', 'L', 'I', 'O']
  const cleared = advanceTetris(line, 'down', () => 0)
  assert.equal(cleared.lines, 1)
  assert.ok(cleared.score >= 100)
})

test('geometry dash: saltar evita obstáculos, recoge monedas y exige aterrizar', () => {
  const state = createGeometryState(() => 0)
  Object.assign(state, { length: 12, position: 0, obstacles: [2, 8], coins: [3], collected: [], cooldown: 0 })
  const jumped = advanceGeometry(state, 'jump')
  assert.equal(jumped.position, 3)
  assert.equal(jumped.status, 'active')
  assert.deepEqual(jumped.collected, [3])
  assert.throws(() => advanceGeometry(jumped, 'jump'), /aterrizar/)
  const landed = advanceGeometry(jumped, 'run')
  assert.equal(landed.airborne, false)

  const crash = advanceGeometry(state, 'run')
  assert.equal(crash.status, 'over')
  assert.match(crash.reason, /obstáculo/)
})

test('ajedrez: las tres dificultades devuelven movimientos legales', () => {
  const fen = new Chess().fen()
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const selected = chooseBotMove(fen, difficulty, () => 0)
    assert.ok(selected, difficulty)
    const chess = new Chess(fen)
    assert.doesNotThrow(() => chess.move({ from: selected.from, to: selected.to, promotion: selected.promotion }))
  }
})

test('carrera: suma dados, alterna turnos, limita la meta y declara ganador', () => {
  const initial = {
    target: 10,
    dice: 2,
    turn: 0,
    winner: null,
    players: [
      { jid: OWNER, name: 'A', position: 0, rolls: 0 },
      { jid: GUEST, name: 'B', position: 0, rolls: 0 }
    ]
  }
  const first = advanceRace(initial, () => 0)
  assert.deepEqual(first.state.lastRoll, [1, 1])
  assert.equal(first.state.players[0].position, 2)
  assert.equal(first.state.turn, 1)
  const second = advanceRace(first.state, () => 0.99999)
  assert.equal(second.state.players[1].position, 10)
  assert.equal(second.winner, GUEST)
})

test('traductor: selecciona idioma y limpia la salida sin hacer red en la prueba', async () => {
  let request
  const result = await translateText('Hola mundo', 'en', {}, async options => {
    request = options
    return { text: '<think>proceso</think>Hello world' }
  })
  assert.equal(result, 'Hello world')
  assert.match(request.prompt, /inglés/)
  assert.match(request.prompt, /Hola mundo/)
})

test('router: un botón Snake edita el tablero y otro usuario recibe 🚫', async (t) => {
  t.after(clearGameSessions)
  const { ctx, sent } = fakeContext(OWNER, { group: true })
  await snakeCommand(ctx, '')
  const button = sent.buttons[0].buttons.find(item => item.label.includes('Avanzar'))
  assert.match(button.id, /^mbg:/)

  const tap = fakeContext(OWNER, { group: true, text: button.id })
  const handled = await routeGameInteraction(tap.ctx)
  assert.equal(handled, true)
  assert.equal(tap.ctx.m.commandExecuted, true)
  const edited = tap.sent.messages.find(message => message.content.edit)
  assert.ok(edited)
  assert.match(edited.content.text, /Movimientos: 1/)

  const intruder = fakeContext(GUEST, { group: true, text: button.id })
  await routeGameInteraction(intruder.ctx)
  assert.deepEqual(intruder.sent.reactions, ['🚫'])
  assert.equal(intruder.sent.messages.some(message => message.content.edit), false)
})

test('ajedrez interactivo: mueve con el bot y deshace la ronda completa', async (t) => {
  t.after(clearGameSessions)
  const { ctx } = fakeContext()
  await chessCommand(ctx, 'facil')
  const session = findGameSession('chess', ctx, { ownerOnly: true })
  const initialFen = session.state.fen
  await chessCommand(ctx, 'e2e4')
  assert.equal(session.state.rounds, 1)
  assert.equal(session.state.history.length, 1)
  assert.notEqual(session.state.fen, initialFen)
  assert.doesNotThrow(() => new Chess(session.state.fen))
  await chessAction(ctx, session, 'undo')
  assert.equal(session.state.fen, initialFen)
  assert.equal(session.state.rounds, 0)
})

test('multijugador: permite editar cupo, meta y dados, une jugadores y protege turnos', async (t) => {
  t.after(clearGameSessions)
  const owner = fakeContext(OWNER, { group: true })
  const guest = fakeContext(GUEST, { group: true })
  const third = fakeContext(THIRD, { group: true })
  await multiplayerCommand(owner.ctx, ['2', '20'])
  await multiplayerCommand(owner.ctx, ['editar', 'meta', '40'])
  await multiplayerCommand(owner.ctx, ['editar', 'dados', '2'])
  await multiplayerCommand(guest.ctx, ['unirme'])
  await multiplayerCommand(third.ctx, ['unirme'])
  assert.ok(third.sent.reactions.includes('⚠️'))

  const session = findGameSession('multiplayer', owner.ctx)
  assert.equal(session.state.players.length, 2)
  assert.equal(session.state.target, 40)
  assert.equal(session.state.dice, 2)
  await multiplayerCommand(owner.ctx, ['iniciar'])
  assert.equal(session.status, 'active')
  await multiplayerCommand(guest.ctx, ['tirar'])
  assert.ok(guest.sent.reactions.includes('🚫'))
  await multiplayerCommand(owner.ctx, ['tirar'])
  assert.equal(session.state.turn, 1)
  assert.equal(session.state.players[0].rolls, 1)
})
