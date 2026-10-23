/**
 * sticker-search.js — Búsqueda de GIFs/stickers (Tenor) para .bsticker.
 *
 * Sin dependencias (parseo puro, testeable):
 * - Fuente 1: API Delirius (convención del repo: { status, data[] }).
 * - Fuente 2 (respaldo): Tenor v1 público.
 * El parseo acepta varias formas de respuesta para no romperse si cambian.
 */

export function construirUrlDelirius(consulta = '') {
  return `https://api.delirius.online/search/tenor?q=${encodeURIComponent(String(consulta).trim())}`
}

export function construirUrlTenor(consulta = '', limite = 8) {
  const n = Math.min(Math.max(Number(limite) || 8, 1), 20)
  return `https://g.tenor.com/v1/search?q=${encodeURIComponent(String(consulta).trim())}&key=LIVDSRZULELA&limit=${n}&media_filter=minimal`
}

function esUrlHttp(valor) {
  return typeof valor === 'string' && /^https?:\/\//.test(valor)
}

/**
 * Extrae la URL del medio de un item: string directo, objeto Delirius
 * ({ mp4, gif, url, ... }) o Tenor v1 ({ media: [{ mp4: { url } }] }).
 * Devuelve null si no hay nada usable.
 */
export function extraerUrlMedia(item) {
  if (!item) return null
  if (typeof item === 'string') return esUrlHttp(item) ? item : null
  if (typeof item !== 'object') return null

  for (const clave of ['mp4', 'gif', 'url', 'video', 'image', 'media']) {
    if (esUrlHttp(item[clave])) return item[clave]
  }

  // Tenor v1: media: [{ mp4: { url }, gif: { url } }] o media: { ... }
  const media = Array.isArray(item.media) ? item.media[0] : item.media
  if (media && typeof media === 'object') {
    for (const clave of ['mp4', 'gif', 'tinymp4', 'tinygif', 'nanomp4', 'nanogif', 'webm', 'url']) {
      const valor = media[clave]
      if (esUrlHttp(valor)) return valor
      if (valor && typeof valor === 'object' && esUrlHttp(valor.url)) return valor.url
    }
  }

  // Agregadores con listas anidadas.
  for (const clave of ['medias', 'videos', 'images', 'files']) {
    if (Array.isArray(item[clave])) {
      for (const sub of item[clave]) {
        const url = extraerUrlMedia(sub)
        if (url) return url
      }
    }
  }

  return null
}

/** Normaliza cualquier payload de búsqueda a una lista de URLs únicas. */
export function normalizarResultados(payload) {
  if (!payload) return []
  const lista = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.result)
        ? payload.result
        : Array.isArray(payload.results)
          ? payload.results
          : []
  const urls = []
  for (const item of lista) {
    const url = extraerUrlMedia(item)
    if (url && !urls.includes(url)) urls.push(url)
  }
  return urls
}
