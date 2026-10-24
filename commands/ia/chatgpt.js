import { runAiCommand } from '../../lib/ai.js'
import { brandEmoji } from '../../lib/branding.js'

export default {
  name: 'chatgpt',
  aliases: ['gpt', 'openai', 'chat-gpt', 'gpt-ai'],
  category: 'ia',
  description: 'Preguntarle a la IA ChatGPT (OpenAI).',
  usage: '.chatgpt <tu pregunta>',
  examples: [
    '.chatgpt escribe un mensaje de cumpleaños corto para mi hermana',
    '.chatgpt cómo hago mayonesa casera sin que se corte'
  ],
  async run(ctx) {
    return runAiCommand(ctx, {
      request: 'chatgpt',
      label: 'ChatGPT',
      emoji: ctx.config.bot.aiEmojis?.chatgpt || brandEmoji(ctx),
      system:
        'Eres ChatGPT, un asistente útil. Respondes en el idioma del usuario (por defecto español). ' +
        'Tus respuestas viajan por WhatsApp: sé claro y breve, usa listas cortas y evita tablas anchas.'
    })
  }
}
