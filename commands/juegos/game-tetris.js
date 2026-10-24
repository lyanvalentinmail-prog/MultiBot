import { tetrisCommand } from '../../lib/games/tetris.js'

export default {
  name: 'tetris',
  aliases: ['tetrischat'],
  category: 'juegos',
  description: 'Juega Tetris individual con piezas, rotaciones, niveles y puntuación.',
  usage: 'tetris [izquierda|derecha|rotar|bajar|soltar|reiniciar]',
  examples: ['.tetris', '.tetris rotar', '.tetris soltar'],
  tags: ['game'],
  async run(ctx) {
    return tetrisCommand(ctx, ctx.argsText || ctx.args?.join(' ') || '')
  }
}
