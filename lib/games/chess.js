import { Chess } from 'chess.js'
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

const DIFFICULTIES = { facil: 'easy', easy: 'easy', medio: 'medium', medium: 'medium', normal: 'medium', dificil: 'hard', duro: 'hard', hard: 'hard' }
const DIFFICULTY_NAMES = { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' }
const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const PIECES = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
}

function evaluate(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 100000 : -100000
  if (chess.isDraw()) return 0
  let score = 0
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue
      const value = VALUES[piece.type]
      score += piece.color === 'b' ? value : -value
    }
  }
  return score
}

function minimax(chess, depth, alpha, beta) {
  if (depth === 0 || chess.isGameOver()) return evaluate(chess)
  const maximizing = chess.turn() === 'b'
  let best = maximizing ? -Infinity : Infinity
  const moves = chess.moves({ verbose: true })
  for (const move of moves) {
    chess.move(move)
    const score = minimax(chess, depth - 1, alpha, beta)
    chess.undo()
    if (maximizing) {
      best = Math.max(best, score)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, score)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha) break
  }
  return best
}

export function chooseBotMove(fen, difficulty = 'medium', random = Math.random) {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  if (!moves.length) return null
  if (difficulty === 'easy') return moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))]
  let bestScore = -Infinity
  let best = []
  for (const move of moves) {
    chess.move(move)
    const score = difficulty === 'hard' ? minimax(chess, 1, -Infinity, Infinity) : evaluate(chess)
    chess.undo()
    if (score > bestScore) {
      bestScore = score
      best = [move]
    } else if (score === bestScore) {
      best.push(move)
    }
  }
  return best[Math.min(best.length - 1, Math.floor(random() * best.length))]
}

function initialState(difficulty = null) {
  return {
    difficulty,
    fen: new Chess().fen(),
    history: [],
    rounds: 0,
    lastMove: 'La partida todavía no comenzó.',
    result: ''
  }
}

export function renderChess(state, status = 'active') {
  const chess = new Chess(state.fen)
  const rows = chess.board().map((row, index) => `${8 - index} ${row.map(piece => piece ? PIECES[piece.color][piece.type] : '·').join(' ')}`)
  const difficulty = state.difficulty ? DIFFICULTY_NAMES[state.difficulty] : 'Sin elegir'
  const footer = status === 'over'
    ? `🏁 ${state.result}`
    : status === 'difficulty'
      ? 'Elige una dificultad. Jugarás con las piezas blancas y el bot con las negras.'
      : `Última jugada: ${state.lastMove}\nMueve con *.ajedrez e2e4* o notación SAN como *.ajedrez Nf3*.\nTambién: *.ajedrez deshacer* y *.ajedrez rendirse*.`
  return `♟️ *Ajedrez contra el bot*\n\n${rows.join('\n')}\n  a b c d e f g h\n\n🎚️ Dificultad: *${difficulty}* · Turno: ${chess.turn() === 'w' ? 'blancas' : 'negras'}\n${footer}`
}

function difficultyControls(session) {
  return [
    gameButton(session, 'difficulty:easy', '😌 Fácil'),
    gameButton(session, 'difficulty:medium', '🧠 Medio'),
    gameButton(session, 'difficulty:hard', '🔥 Difícil')
  ]
}

function activeControls(session) {
  return [
    gameButton(session, 'undo', '↩️ Deshacer'),
    gameButton(session, 'board', '📋 Tablero'),
    gameButton(session, 'resign', '🏳️ Rendirse')
  ]
}

function resultFor(chess, lastMove = '') {
  if (chess.isCheckmate()) return `Jaque mate. ${chess.turn() === 'w' ? 'Ganó el bot.' : '¡Ganaste!'} ${lastMove}`
  if (chess.isStalemate()) return 'Empate por ahogado.'
  if (chess.isInsufficientMaterial()) return 'Empate por material insuficiente.'
  if (chess.isThreefoldRepetition()) return 'Empate por triple repetición.'
  if (chess.isDraw()) return 'La partida terminó en empate.'
  return 'Partida terminada.'
}

export async function playChessMove(ctx, session, input) {
  assertGameUser(ctx, session)
  if (session.status !== 'active') throw new GameRuleError('Primero elige una dificultad o inicia una partida nueva.')
  const chess = new Chess(session.state.fen)
  if (chess.turn() !== 'w') throw new GameRuleError('Espera el movimiento del bot.')
  let userMove
  const normalized = input.trim().replace(/0/g, 'O')
  try {
    userMove = chess.move(normalized)
  } catch {
    try {
      const compact = normalized.replace(/[\s-]/g, '').toLowerCase()
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(compact)) throw new Error('invalid')
      userMove = chess.move({ from: compact.slice(0, 2), to: compact.slice(2, 4), promotion: compact[4] || 'q' })
    } catch {
      throw new GameRuleError('Movimiento inválido. Usa por ejemplo e2e4, e4 o Nf3.')
    }
  }
  session.state.history.push(session.state.fen)
  session.state.rounds += 1
  let botMove = null
  if (!chess.isGameOver()) {
    const selected = chooseBotMove(chess.fen(), session.state.difficulty)
    if (selected) botMove = chess.move({ from: selected.from, to: selected.to, promotion: selected.promotion })
  }
  session.state.fen = chess.fen()
  session.state.lastMove = `Tú: ${userMove.san}${botMove ? ` · Bot: ${botMove.san}` : ''}`
  if (chess.isGameOver()) {
    session.status = 'over'
    session.state.result = resultFor(chess)
  }
  return updateGame(ctx, session, renderChess(session.state, session.status), session.status === 'over' ? [gameButton(session, 'restart', '🔄 Nueva partida')] : [])
}

export async function chessCommand(ctx, argsText = '') {
  return runGameCommand(ctx, async () => {
    const input = argsText.trim()
    const normalized = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    let session = findGameSession('chess', ctx, { ownerOnly: true, activeOnly: true })
    const restart = ['reiniciar', 'restart', 'nuevo', 'nueva'].includes(normalized)
    if (restart && session) {
      deleteGameSession(session)
      session = null
    }
    if (!session) {
      const difficulty = DIFFICULTIES[normalized] || null
      if (input && !difficulty) throw new GameRuleError('No hay una partida activa. Usa .ajedrez y elige una dificultad.')
      session = createGameSession('chess', ctx, initialState(difficulty), { status: difficulty ? 'active' : 'difficulty' })
      return presentGame(ctx, session, renderChess(session.state, session.status), difficulty ? activeControls(session) : difficultyControls(session))
    }
    if (!input) return updateGame(ctx, session, renderChess(session.state, session.status), session.status === 'difficulty' ? difficultyControls(session) : [])
    if (DIFFICULTIES[normalized]) {
      if (session.state.rounds > 0) throw new GameRuleError('La dificultad solo se puede cambiar antes del primer movimiento.')
      session.state.difficulty = DIFFICULTIES[normalized]
      session.status = 'active'
      return updateGame(ctx, session, renderChess(session.state, session.status), activeControls(session))
    }
    if (['deshacer', 'undo'].includes(normalized)) return chessAction(ctx, session, 'undo')
    if (['rendirse', 'resign'].includes(normalized)) return chessAction(ctx, session, 'resign')
    if (['tablero', 'board'].includes(normalized)) return chessAction(ctx, session, 'board')
    return playChessMove(ctx, session, input)
  })
}

export async function chessAction(ctx, session, action) {
  assertGameUser(ctx, session)
  const difficulty = /^difficulty:(easy|medium|hard)$/.exec(action)?.[1]
  if (difficulty) {
    if (session.state.rounds > 0) throw new GameRuleError('La dificultad ya no se puede cambiar en esta partida.')
    session.state.difficulty = difficulty
    session.status = 'active'
    return updateGame(ctx, session, renderChess(session.state, session.status), activeControls(session))
  }
  if (action === 'restart') {
    session.state = initialState()
    session.status = 'difficulty'
    return updateGame(ctx, session, renderChess(session.state, session.status), difficultyControls(session))
  }
  if (action === 'board') return updateGame(ctx, session, renderChess(session.state, session.status))
  if (action === 'resign') {
    if (session.status !== 'active') throw new GameRuleError('No hay una partida activa.')
    session.status = 'over'
    session.state.result = 'Te rendiste. Ganó el bot.'
    return updateGame(ctx, session, renderChess(session.state, session.status), [gameButton(session, 'restart', '🔄 Nueva partida')])
  }
  if (action === 'undo') {
    if (!session.state.history.length) throw new GameRuleError('Todavía no hay jugadas para deshacer.')
    session.state.fen = session.state.history.pop()
    session.state.rounds = Math.max(0, session.state.rounds - 1)
    session.state.lastMove = 'Se deshizo la última ronda.'
    session.status = 'active'
    return updateGame(ctx, session, renderChess(session.state, session.status))
  }
  throw new GameRuleError('Acción de ajedrez desconocida.')
}
