import { chessCommand } from '../../lib/games/chess.js'

export default {
  name: 'ajedrez',
  aliases: ['chess', 'ajedrezbot'],
  category: 'juegos',
  description: 'Juega ajedrez legal contra el bot con dificultad fácil, media o difícil.',
  usage: 'ajedrez [facil|medio|dificil] o ajedrez <movimiento>',
  examples: ['.ajedrez', '.ajedrez dificil', '.ajedrez e2e4', '.ajedrez Nf3'],
  tags: ['game'],
  async run(ctx) {
    return chessCommand(ctx, ctx.argsText || ctx.args?.join(' ') || '')
  }
}
