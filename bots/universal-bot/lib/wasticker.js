import crypto from 'crypto'
import { createZip } from './zip.js'

export function safeFileName(name) {
  return (
    String(name || 'pack')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'pack'
  )
}

export function packStickerFileName(buffer) {
  return `${crypto.createHash('sha256').update(buffer).digest('base64').replace(/\//g, '-')}.webp`
}

/**
 * Arma el `.wasticker`: ZIP con los stickers, `contents.json` y el ícono.
 * El archivo se puede importar desde cualquier app de stickers.
 */
export function buildWastickerZip({ stickers = [], tray = null, packId, name, publisher } = {}) {
  if (!stickers.length) throw new Error('El pack necesita al menos un sticker')
  if (!packId) throw new Error('Falta el id del pack')

  const files = []
  const contents = []

  for (const sticker of stickers) {
    const fileName = packStickerFileName(sticker.buffer)
    files.push({ name: fileName, data: sticker.buffer })
    contents.push({
      image_file: fileName,
      emojis: sticker.emojis?.length ? sticker.emojis.slice(0, 3) : ['⭐'],
      isAnimated: Boolean(sticker.animated)
    })
  }

  const trayFileName = tray ? `${packId}.png` : null
  if (tray && trayFileName) files.push({ name: trayFileName, data: tray })

  files.unshift({
    name: 'contents.json',
    data: Buffer.from(
      JSON.stringify(
        {
          android_play_store_link: 'https://play.google.com/store/apps/details?id=com.whatsapp.stickers',
          ios_app_download_link: 'https://apps.apple.com/app/whatsapp-messenger/id310633997',
          image_data_version: '1',
          avoid_cache: false,
          sticker_packs: [
            {
              identifier: packId,
              name,
              publisher,
              publisher_email: '',
              publisher_website: '',
              privacy_policy_website: '',
              license_agreement_website: '',
              image_data_version: '1',
              ...(trayFileName ? { tray_image_file: trayFileName } : {}),
              animated_sticker_pack: contents.some((item) => item.isAnimated),
              stickers: contents
            }
          ]
        },
        null,
        2
      ),
      'utf8'
    )
  })

  return createZip(files)
}
