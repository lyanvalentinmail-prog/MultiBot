import { calculatorCommand } from '../../lib/games/calculator.js'

export default {
  name: 'calc',
  aliases: ['calculadora', 'calculator'],
  category: 'juegos',
  description: 'Calcula expresiones y aplica operaciones con botones, sin usar eval.',
  usage: 'calc <expresión>',
  examples: ['.calc 2 + 2', '.calc sqrt(81) + 2^3', '.calc pow(5, 3)'],
  tags: ['game', 'tools'],
  async run(ctx) {
    return calculatorCommand(ctx, ctx.argsText || ctx.args?.join(' ') || '')
  }
}
