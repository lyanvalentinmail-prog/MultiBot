import { multiplayerCommand } from '../../lib/games/multiplayer.js'

export default {
  name: 'multi',
  aliases: ['multijugador', 'carrera', 'race'],
  category: 'juegos',
  description: 'Crea una carrera de dados para 2–8 jugadores con cupo, meta y dados editables.',
  usage: 'multi [jugadores 2-8] [meta 10-100] o multi <unirme|iniciar|tirar|editar>',
  examples: ['.multi 6 40', '.multi editar dados 2', '.multi tirar'],
  tags: ['game', 'group'],
  group: true,
  async run(ctx) {
    return multiplayerCommand(ctx, ctx.args || [])
  }
}
