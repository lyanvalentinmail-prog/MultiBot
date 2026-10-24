export default {
  name: 'moneda',
  aliases: ['coin', 'caraosello'],
  category: 'juegos',
  description: 'Tirar una moneda (cara o sello).',
  usage: '.moneda',
  examples: ['.moneda'],
  async run(ctx) {
    const cara = Math.random() < 0.5
    await ctx.reply(cara ? '🪙 Salió *cara*' : '🪙 Salió *sello*')
    return cara ? 'moneda cara' : 'moneda sello'
  }
}
