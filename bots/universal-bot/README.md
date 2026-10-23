# 🤖 Universal Bot

**Bot todo-en-uno para WhatsApp** — 200+ plugins, RPG, stickers, IA, descargas, antis, grupos y más.  
**Solo Termux** · **Baileys** · **Pairing Code & QR** · **Sin contenido +18** ✅

> Parte de [MultiBot](../../README.md) · Basado en Pain-Bot, limpiado de NSFW.

## ✨ Funciones

- **Conexión**: Pairing Code (8 dígitos) y QR
- **Termux Only**: guard `lib/termux-guard.js`
- **RPG**: economía, banco, daily, work, robar, slot, ruleta, pescar, etc.
- **Gacha**: harem/characters (roll, claim, shop, trade)
- **Juegos**: michi (3 en raya), miner, bomba, dado, adivinanza
- **Stickers**: sticker, brat, text, sgay, sw, toimg, delmeta, etc.
- **Grupos**: ban/kick/promote/warn/mute, antilink, welcome, clas, etc.
- **Anti-s**: link, spam, img, audio, video, sticker, bot, delete, estados, palabra, caracter, prefijo, mention, contact, document
- **IA**: Gemini, ChatGPT, Copilot, Kora, Anime, OCR
- **Descargas**: play, play2, fb, ig, tiktok, spotify, soundcloud, pinterest, gitclone, etc.
- **Media**: tts, stt, slow/speed, audio-to-audio, hd, resize, pdf, ssimg, etc.
- **Utilidades**: google, yt, lyrics, ip, sherlock, canalid, perfil, etc.
- **Sub-bots**: `qr`/`code` para crear sub-bots, `bots`, `reconnect`

> **Sin NSFW**: se eliminaron hentai, xnxx, xvideos, onlyfans, waifu +18, modohot, cmd18 y todo contenido para adultos.

## 📱 Termux (único modo soportado)

```bash
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg imagemagick python -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
npm install
cp config.example.js config.js
nano config.js   # pon tu número
npm start       # elige code o qr
```

Guía completa: [`docs/TERMUX.md`](./docs/TERMUX.md) y [`../../docs/TERMUX_GUIDE.md`](../../docs/TERMUX_GUIDE.md)

## ⚙️ Config

Edita `config.js`:

```js
global.owner = [
  ['521XXXXXXXXXX', 'TuNombre', true]
]
global.ownerLid = [
  ['tu_lid', 'TuNombre', true] // saca con .id en privado
]
global.namebot = 'UNIVERSAL BOT'
global.moneda = 'USD'
```

## 🔐 Login

Al iniciar:

```
¿Cómo deseas iniciar sesión?
Escribe "qr" para escanear el código QR o "code" para usar un código de 8 dígitos:
```

- `qr` → genera QR en terminal → escanea con WhatsApp
- `code` → ingresa tu número → recibe `XXXX-XXXX` → vincula en WhatsApp > Dispositivos vinculados > Vincular con número

Sesión se guarda en `sessions/creds.json` (no borrar si quieres mantener login).

## 🔒 Solo Termux

Este bot tiene `lib/termux-guard.js` que bloquea ejecución fuera de Termux:

```
✖ ESTE BOT SOLO PUEDE EJECUTARSE EN TERMUX
```

Bypass dev (no recomendado prod):

```bash
ALLOW_NON_TERMUX=1 npm start
node main.js --allow-non-termux
```

## 📂 Estructura

```
universal-bot/
├── config.js / config.example.js
├── index.js / main.js / handler.js
├── lib/            # Termux guard, Modos, Antis, menu, etc.
├── plugins/        # 200+ comandos
├── storage/
│   ├── databases/  # DB + characters
│   └── img/
├── sessions/       # creds (gitignored)
├── tmp/            # temp (gitignored)
├── scripts/
└── docs/
```

## 📋 Menú

En WhatsApp: `.menu` → categorías → lista interactiva.

Categorías: Owners, Admins, SubBot, Games RPG, Perfil, Top, Búsquedas, OSINT, IA, Descargas, Reacciones, Adicionales, Stickers, Diversión.

> Categoría NSFW eliminada.

## 🛠️ Scripts

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia con sharp check + cluster |
| `npm run start:raw` | Sin sharp check |
| `npm run dev` | Con ALLOW_NON_TERMUX |
| `npm run fix:sharp` | Repara sharp |

## 🤝 Créditos

- Base: [nexusday/pain-bot](https://github.com/nexusday/pain-bot) (GPL-3.0)
- Baileys: @whiskeysockets/baileys & @itsliaaa/baileys
- Limpieza + Termux guard: MultiBot Team

## 📄 Licencia

GPL-3.0-or-later
