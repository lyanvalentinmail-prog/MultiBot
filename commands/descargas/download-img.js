import fetch from 'node-fetch'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) return conn.sendMessage(m.chat, {
    text: `[❗] Ingresa un texto para buscar una imagen\n> *Ejemplo:* ${usedPrefix + command} gatos`,
    contextInfo: { ...rcanal.contextInfo }
  }, { quoted: m })

  try {

    const urls = await obtenerBusquedaImagenGoogle(text)

    if (urls.length < 2) return conn.sendMessage(m.chat, {
      text: '[❗] No se encontraron suficientes imágenes para un álbum',
      contextInfo: { ...rcanal.contextInfo }
    }, { quoted: m })

    const leyenda = `𓂃 ࣪ ִֶָ☾. Resultados de búsqueda para: *${text}*`

    await conn.sendAlbum(m.chat, urls.slice(0, 3).map((url) => ({ url })), {
      caption: leyenda,
      contextInfo: { ...rcanal.contextInfo }
    })


  } catch (error) {

    conn.sendMessage(m.chat, {
      text: `[❗] Se produjo un error al buscar la imagen\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`,
      contextInfo: { ...rcanal.contextInfo }
    }, { quoted: m })
  }
}

handler.help = ['imagen <texto>']
handler.tags = ['busqueda']
handler.command = ['imagen', 'image']

export default {
  name: "imagen",
  aliases: ["image"],
  category: "descargas",
  description: "imagen <texto>",
  usage: "imagen <texto>",
  examples: [],
  tags: ["busqueda"],
  async run(ctx) {
    return handler(ctx.m, ctx)
  }
}

async function obtenerBusquedaImagenGoogle(consulta) {
  const apis = [
    `${global.APIs.delirius.url}/search/gimage?query=${encodeURIComponent(consulta)}`,
    `${global.APIs.siputzx.url}/api/images?query=${encodeURIComponent(consulta)}`
  ]

  for (const url of apis) {
    try {
      const respuesta = await fetch(url)
      const datos = await respuesta.json()

      if (Array.isArray(datos?.data)) {
        const urls = datos.data
          .map(d => d.url)
          .filter(u => typeof u === 'string' && u.startsWith('http'))

        if (urls.length) return urls
      }
    } catch { /* ignorar errores de una API y seguir con la otra */ }
  }

  return []
}

export { obtenerBusquedaImagenGoogle as getGoogleImageSearch }
