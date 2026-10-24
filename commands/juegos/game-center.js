import { routeGameInteraction } from '../../lib/games/router.js'

export default {
  name: 'juegos',
  aliases: ['games', 'minijuegos'],
  category: 'juegos',
  description: 'Abre el catálogo de minijuegos interactivos para WhatsApp.',
  usage: 'juegos',
  examples: ['.juegos', '.snake', '.ajedrez dificil', '.multi 6 40'],
  tags: ['game', 'fun'],
  async all(ctx) {
    return routeGameInteraction(ctx)
  },
  async run(ctx) {
    await ctx.reply([
      '🎮 *Centro de minijuegos*',
      '',
      '🐍 *.snake* — Snake por turnos.',
      '🧱 *.tetris* — Tetris individual.',
      '♟️ *.ajedrez* — Ajedrez contra el bot, con 3 dificultades.',
      '🟧 *.gd* — Geometry Dash de chat.',
      '🎲 *.multi [jugadores] [meta]* — Carrera grupal de 2 a 8 jugadores.',
      '🧮 *.calc <operación>* — Calculadora con botones.',
      '🌐 *.traductor <idioma> <texto>* — Traductor con idiomas intercambiables.',
      '',
      'Los botones actualizan el tablero sin necesidad de una página web. Si tu versión de WhatsApp no muestra botones, todos los juegos también aceptan comandos de texto.'
    ].join('\n'))
    return ctx.sendButtons({
      text: 'Elige un juego para comenzar',
      footer: 'MultiBot · Minijuegos',
      buttons: [
        { id: '.snake', label: '🐍 Snake' },
        { id: '.tetris', label: '🧱 Tetris' },
        { id: '.ajedrez', label: '♟️ Ajedrez' }
      ],
      layout: 'horizontal'
    })
  }
}
