import { geometryCommand } from '../../lib/games/geometry-dash.js'

export default {
  name: 'gd',
  aliases: ['geometry', 'geometrydash'],
  category: 'juegos',
  description: 'Juega una carrera Geometry Dash por turnos con saltos, obstáculos y monedas.',
  usage: 'gd [correr|saltar|reiniciar]',
  examples: ['.gd', '.gd saltar', '.gd correr'],
  tags: ['game'],
  async run(ctx) {
    return geometryCommand(ctx, ctx.argsText || ctx.args?.join(' ') || '')
  }
}
