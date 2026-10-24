import { fetchJson } from '../../lib/net/http.js'

export const LYRICS_API = 'https://api.delirius.online/search/lyrics'
const MAX_CHUNK = 3800

export function splitLyrics(text, max = MAX_CHUNK) {
  const chunks = []
  let rest = String(text || '').trim()
  if (!rest) return chunks
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.4) cut = max
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export default {
  name: 'lyrics',
  aliases: ['ly', 'letra', 'letras'],
  category: 'herramientas',
  description: 'Buscar la letra de una canción.',
  usage: '.lyrics nombre de la canción',
  examples: ['.ly Bohemian Rhapsody'],
  async run(ctx) {
    const query = ctx.argsText.trim()
    if (!query) throw new Error(`Pasa el nombre de la canción. Ejemplo: *${ctx.prefix}ly Bohemian Rhapsody*`)

    await ctx.typing('composing')
    const result = await fetchJson(`${LYRICS_API}?query=${encodeURIComponent(query)}`, {
      timeoutMs: 45000
    }).catch(() => null)
    const data = result?.status ? result.data : null
    const lyrics = String(data?.lyrics || '').trim()
    if (!data || !lyrics) throw new Error('No encontré la letra de esa canción.')

    await ctx.reply(
      [
        '🎵 *Lyrics*',
        `𓍯 *Búsqueda:* ${query}`,
        `𓍯 *Título:* ${data.title || 'Desconocido'}`,
        `𓍯 *Artista:* ${data.artists || 'Desconocido'}`,
        data.album ? `𓍯 *Álbum:* ${data.album}` : null,
        data.duration ? `𓍯 *Duración:* ${data.duration}` : null
      ]
        .filter((line) => line !== null)
        .join('\n')
    )
    const parts = splitLyrics(lyrics)
    for (let i = 0; i < parts.length; i += 1) {
      const prefix = parts.length > 1 ? `*Parte ${i + 1}/${parts.length}*\n\n` : ''
      await ctx.reply(`${prefix}${parts[i]}`)
    }
    return `lyrics ${parts.length} parte(s)`
  }
}
