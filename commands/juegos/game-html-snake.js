import { snakeCommand } from '../../lib/games/snake.js'

export default {
  name: 'snake',
  aliases: ['serpiente', 'htmlsnake'],
  category: 'juegos',
  description: 'Juega Snake directamente en WhatsApp con un tablero editable y botones.',
  usage: 'snake [arriba|abajo|izquierda|derecha|avanzar|reiniciar]',
  examples: ['.snake', '.snake arriba', '.snake avanzar'],
  tags: ['game', 'fun'],
  async run(ctx) {
    return snakeCommand(ctx, ctx.argsText || ctx.args?.join(' ') || '')
  }
}
