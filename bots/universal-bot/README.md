# 🤖 Universal Bot

**Bot todo-en-uno para WhatsApp** — RPG, stickers, IA, descargas, antis, grupos y más.
**Termux + runtime web autorizado** · **Baileys** · **Pairing Code & QR reales** · **Sin contenido +18** ✅

> Parte de [MultiBot](../../README.md) · Basado en Pain-Bot, limpiado de NSFW.

## ✨ Funciones

- **Conexión**: Pairing Code y QR generados por Baileys.
- **Runtimes**: Termux; runtime web Free para la cuenta propietaria del panel (o allowlist opcional).
- **RPG**: economía, banco, daily, work, robar, slot, ruleta, pescar, etc.
- **Gacha/juegos**: personajes, michi, miner, bomba, dado, adivinanza.
- **Stickers, grupos, protección, IA, multimedia y descargas**.
- **Sub-bots**: `qr`/`code` para crear sub-bots, `bots`, `reconnect`.

> **Sin NSFW:** hentai, xnxx, xvideos, onlyfans, waifu +18, modohot, cmd18 y el contenido para adultos fueron eliminados.

## 📱 Termux

```bash
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg imagemagick python -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
npm install
npm run setup   # asistente: owner, nombre y LID (sin editor)
npm run doctor  # diagnóstico rápido (opcional)
npm start       # elige code o qr
```

¿Pegaste comandos en `config.js`? El error `Unexpected identifier 'start'` se arregla con
`npm run setup -- --fix`. El bot también lo detecta al arrancar y muestra qué hacer.

Guía completa: [`docs/TERMUX.md`](./docs/TERMUX.md) y [`../../docs/TERMUX_GUIDE.md`](../../docs/TERMUX_GUIDE.md).

## 🌐 Runtime web autorizado

El panel puede iniciar `main.js` desde Render Free. Abre el detalle de Universal Bot con una cuenta incluida en `WEB_RUNTIME_ADMIN_EMAILS` y solicita el QR o Pairing Code real. En Pairing Code, ingresa el número internacional que recibirá el código. Consulta [`../../docs/WEB.md`](../../docs/WEB.md) para despliegue, permisos y variables opcionales.

- Una instancia de bot como máximo a la vez.
- Render Free comparte 512 MB de RAM y 0.1 CPU entre el panel y el bot; IA/OCR y tareas pesadas pueden agotar recursos.
- Render Free puede suspenderse y detener/reiniciar el bot; no hay uptime 24/7.
- Las credenciales Baileys viven en `sessions/` dentro del filesystem efímero de Render; pueden perderse. No se guardan en PostgreSQL.
- La API key/owner opcionales se pasan mediante variables `BOT_UNIVERSAL_BOT_*`; no publiques secretos.

## ⚙️ Configuración Termux

Edita `config.js` (privado/ignorado por Git):

```js
global.owner = [['598XXXXXXXX', 'TuNombre', true]]
global.ownerLid = [['tu_lid', 'TuNombre', true]] // saca con .id en privado
global.namebot = 'UNIVERSAL BOT'
global.moneda = 'USD'
```

`config-loader.js` usa `config.js` cuando existe; en un deploy limpio cae a los defaults seguros de `config.example.js`. Para web puedes configurar `BOT_UNIVERSAL_BOT_OWNER_PHONE`, `BOT_UNIVERSAL_BOT_OWNER_NAME` y `BOT_UNIVERSAL_BOT_OWNER_LID` en el entorno del servicio.

## 🔐 Login

En Termux se elige `qr` o `code` en la terminal. Desde web, el panel no usa el prompt: seleccionas QR o Pairing Code en la interfaz y el proceso transmite a la cuenta administradora el código real que genere Baileys.

- **QR** → escanea con WhatsApp → Dispositivos vinculados.
- **Pairing Code** → ingresa el código de Baileys en WhatsApp → Dispositivos vinculados → Vincular con número.

La sesión se guarda en `sessions/creds.json`. En Termux persiste en el almacenamiento del dispositivo; en Render Free es efímera y puede borrarse al reiniciar/suspender/desplegar.

## 🔒 Guard

`lib/termux-guard.js` permite el modo Termux o un runtime web explícito con las dos variables internas que añade el process manager. No uses esas variables como bypass manual en otro servicio. El bypass `ALLOW_NON_TERMUX=1` sigue siendo solo para desarrollo.

## 📂 Estructura

```text
universal-bot/
├── config.js / config.example.js / config-loader.js
├── bot.json            # webRuntime y webEntrypoint declarados
├── index.js / main.js / handler.js
├── lib/                # Guard, modos, antis y utilidades
├── plugins/            # Comandos
├── storage/            # DB + imágenes (efímero en Render)
├── sessions/           # creds (gitignored)
├── tmp/                # temporales (gitignored)
└── docs/
```

## 🛠️ Scripts

| Comando | Descripción |
|---|---|
| `npm start` | Inicio Termux con sharp check y cluster |
| `npm run start:raw` | Inicio sin sharp check |
| `npm run dev` | Inicio de desarrollo sin Termux guard |
| `npm run fix:sharp` | Repara sharp |

## 🤝 Créditos y licencia

- Base: [nexusday/pain-bot](https://github.com/nexusday/pain-bot) (GPL-3.0).
- Baileys: `@whiskeysockets/baileys` y `@itsliaaa/baileys`.
- Limpieza y guard: MultiBot Team.
- GPL-3.0-or-later.
