import { translatorCommand } from '../../lib/games/translator.js'

export default {
  name: 'traductor',
  aliases: ['translator', 'translate'],
  category: 'juegos',
  description: 'Traduce texto o un mensaje citado y cambia el idioma con botones.',
  usage: 'traductor [es|en|pt|fr|it|de|ja|ko|zh|ar] <texto>',
  examples: ['.traductor en Hola, ¿cómo estás?', '.traductor pt Thank you'],
  tags: ['game', 'tools'],
  async run(ctx) {
    return translatorCommand(ctx, ctx.argsText || ctx.args?.join(' ') || '')
  }
}
