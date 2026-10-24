const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

export default {
  name: 'dado',
  aliases: ['dice', 'dados'],
  category: 'juegos',
  description: 'Tirar un dado.',
  usage: '.dado',
  examples: ['.dado'],
  async run(ctx) {
    const value = Math.floor(Math.random() * 6) + 1
    await ctx.reply(`🎲 ${FACES[value - 1]} Salió el *${value}*`)
    return `dado ${value}`
  }
}
