import { fetchBuffer, fetchJson } from '../../lib/net/http.js'
import { truncate } from '../../lib/ai/text.js'

export const FB_API = 'https://api.vreden.my.id/api/v1/download/facebook'

export default {
  name: 'fb',
  aliases: ['facebook'],
  category: 'descargas',
  description: 'Descargar un video de Facebook.',
  usage: '.fb enlace',
  examples: ['.fb https://www.facebook.com/share/r/abc123/'],
  async run(ctx) {
    const url = (ctx.args[0] || '').trim()
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error(`Pasa un enlace de Facebook. Ejemplo: *${ctx.prefix}fb https://www.facebook.com/...*`)
    }

    await ctx.typing('composing')
    const data = await fetchJson(`${FB_API}?url=${encodeURIComponent(url)}`, { timeoutMs: 45000 }).catch(() => null)
    const download = data?.status ? data.result?.download : null
    const videoUrl = download?.hd || download?.sd
    if (!videoUrl) throw new Error('No se pudo obtener el video de Facebook.')

    const buffer = await fetchBuffer(videoUrl, { timeoutMs: 90000, maxBytes: 60 * 1024 * 1024 })
    const title = truncate(String(data.result?.titulo || 'Video de Facebook').trim(), 80)
    const duration = data.result?.durasi ? `\n> *Duración:* ${data.result.durasi}` : ''
    await ctx.sendVideo(buffer, `📘 *${title}*${duration}`)
    return `fb ${(buffer.length / 1048576).toFixed(1)}MB`
  }
}
