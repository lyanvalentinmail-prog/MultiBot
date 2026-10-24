import { calculatorAction } from './calculator.js'
import { chessAction } from './chess.js'
import { geometryAction } from './geometry-dash.js'
import { multiplayerAction } from './multiplayer.js'
import {
  GameRuleError,
  getGameSession,
  parseGameButton,
  runGameCommand,
  sessionMatchesChat
} from './sessions.js'
import { snakeAction } from './snake.js'
import { tetrisAction } from './tetris.js'
import { translatorAction } from './translator.js'

const ACTIONS = {
  calculator: calculatorAction,
  chess: chessAction,
  geometry: geometryAction,
  multiplayer: multiplayerAction,
  snake: snakeAction,
  tetris: tetrisAction,
  translator: translatorAction
}

/** Enruta respuestas de botones antes de la detección normal de comandos. */
export async function routeGameInteraction(ctx) {
  const parsed = parseGameButton(ctx.text || ctx.m?.text)
  if (!parsed) return false
  if (ctx.m) {
    ctx.m.commandExecuted = true
    ctx.m.interactionHandled = true
  }
  await runGameCommand(ctx, async () => {
    const session = getGameSession(parsed.id)
    if (!session || !sessionMatchesChat(session, ctx)) {
      throw new GameRuleError('Esta partida expiró o pertenece a otro chat. Inicia una nueva desde .juegos.')
    }
    const handler = ACTIONS[session.kind]
    if (!handler) throw new GameRuleError('Este tipo de partida ya no está disponible.')
    await handler(ctx, session, parsed.action)
  })
  return true
}
