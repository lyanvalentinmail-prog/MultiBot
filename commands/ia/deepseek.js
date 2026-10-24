import { runAiCommand } from '../../lib/ai/ai.js'
import { brandEmoji } from '../../lib/core/branding.js'

export default {
  name: 'deepseek',
  aliases: ['deep', 'deepseek-ai', 'seek'],
  category: 'ia',
  description: 'Preguntarle a la IA DeepSeek (razona paso a paso).',
  usage: '.deepseek <tu pregunta>',
  examples: [
    '.deepseek resuelve: si 3 camisetas cuestan 45 dólares, ¿cuánto cuestan 7?',
    '.deepseek revisa este código y dime el error'
  ],
  async run(ctx) {
    return runAiCommand(ctx, {
      request: 'deepseek',
      label: 'DeepSeek',
      emoji: ctx.config.bot.aiEmojis?.deepseek || brandEmoji(ctx),
      system:
        'Eres DeepSeek, un asistente que razona con precisión. Respondes en el idioma del usuario ' +
        '(por defecto español). Tus respuestas viajan por WhatsApp: ve directo al resultado, ' +
        'explica los pasos solo si hacen falta y usa formato simple (sin tablas anchas).'
    })
  }
}
