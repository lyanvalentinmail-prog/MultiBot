# 🤖 MultiBot

Repositorio central para **múltiples bots de WhatsApp** basados en **Baileys** — con soporte para **Termux**, **Pairing Code & QR**, y una **web** de gestión.

> Creado por y para la comunidad. Cada bot vive en su propia carpeta dentro de `bots/` con sus plugins, configs y storage aislados.

```
MultiBot/
├── bots/                  # ← Aquí van TODOS los bots, uno por carpeta
│   ├── universal-bot/     # Bot todo-en-uno (Termux only, sin NSFW)
│   └── _template/         # Plantilla para crear nuevos bots
├── web/                   # Dashboard web (próximamente)
├── docs/                  # Documentación
└── scripts/               # Scripts útiles
```

## 📦 Bots disponibles

| Bot | Descripción | Plataforma | Estado |
|-----|-------------|------------|--------|
| **Universal Bot** | Bot completo: RPG, juegos, stickers, IA, descargas, antis, grupos y más. Sin contenido +18. | Termux | ✅ Listo |
| *(próximos)* | Cada nuevo bot se crea copiando `_template` | Termux / Web / VPS | 🔜 |

## ✨ Características generales (Universal Bot)

- **Baileys** con **Pairing Code (8 dígitos)** y **QR Code**
- 100% compatible con **Termux** (Android)
- **Sin contenido NSFW / +18** — limpio para todo público
- RPG, economía, gacha/harem, casino, juegos (michi, miner, bomba, etc.)
- Stickers, stickers con texto, clearmeta, toimg, etc.
- Anti-link, anti-spam, anti-img, anti-audio, welcome/goodbye, etc.
- IA (Gemini, ChatGPT, Copilot), OCR, TTS/STT
- Descargas: Play, FB, IG, TikTok, Spotify, Pinterest, etc.
- Sub-bots (serbot) con reconexión automática
- Y mucho más (200+ plugins)

## 🚀 Inicio rápido (Universal Bot en Termux)

```bash
# 1. Actualiza Termux
pkg update && pkg upgrade -y

# 2. Instala dependencias
pkg install git nodejs ffmpeg imagemagick python -y

# 3. Clona el repo
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot

# 4. Instala módulos
npm install

# 5. Configura owner (opcional)
cp config.example.js config.js
nano config.js   # pon tu número wa.me/@usuario

# 6. Inicia
npm start
# Elige "code" para pairing code o "qr" para QR
```

📖 Guía detallada: [`docs/TERMUX_GUIDE.md`](./docs/TERMUX_GUIDE.md) y [`bots/universal-bot/docs/TERMUX.md`](./bots/universal-bot/docs/TERMUX.md)

## 🏗️ Estructura

Ver [`docs/STRUCTURE.md`](./docs/STRUCTURE.md) para el detalle completo de carpetas.

Resumen:

```
bots/<nombre-bot>/
├── config.js / config.example.js
├── index.js / main.js            # entrypoints
├── handler.js                    # router de plugins
├── lib/                          # librerías internas
│   ├── Modos/                    # modo-ia, modo-human, etc.
│   ├── Antis/
│   └── termux-guard.js           # bloquea ejecución fuera de Termux
├── plugins/                      # 200+ comandos (.js)
├── storage/                      # DBs JSON + imgs
│   ├── databases/
│   └── img/
├── sessions/                     # creds Baileys (gitignored)
├── scripts/                      # ensure-sharp, sync, etc.
├── tmp/                          # temp (gitignored)
└── docs/
```

## ➕ Crear un nuevo bot

```bash
# Usa el script helper
bash scripts/create-bot.sh mi-nuevo-bot

# O manualmente:
cp -r bots/_template bots/mi-nuevo-bot
# edita bots/mi-nuevo-bot/config.js y package.json
```

Guía: [`docs/ADD_NEW_BOT.md`](./docs/ADD_NEW_BOT.md)

## 🌐 Web Dashboard (en progreso)

Carpeta [`web/`](./web/) — será el panel para:

- Ver estado de bots (online/offline, uptime)
- Escanear QR / pedir pairing code desde el navegador
- Gestionar plugins on/off por bot
- Ver logs y stats

Por ahora es un placeholder. Cada bot seguirá funcionando 100% por Termux.

## 🔒 Solo Termux (Universal Bot)

El Universal Bot tiene un **guard** (`lib/termux-guard.js`) que bloquea la ejecución fuera de Termux:

```
✖ ESTE BOT SOLO PUEDE EJECUTARSE EN TERMUX
```

Para desarrollo puedes bypassear con:

```bash
ALLOW_NON_TERMUX=1 npm start
node main.js --allow-non-termux
```

## 📚 Docs

- [Estructura del repo](./docs/STRUCTURE.md)
- [Guía Termux completa](./docs/TERMUX_GUIDE.md)
- [Cómo añadir un bot](./docs/ADD_NEW_BOT.md)

## 🤝 Contribuir

1. Haz fork
2. Crea rama `feature/<tu-feature>`
3. PR hacia `main`

## 📄 Licencia

GPL-3.0-or-later — basado en [Pain-Bot](https://github.com/nexusday/pain-bot) (limpiado de contenido +18).

---

Hecho con 💙 para Termux & Baileys
