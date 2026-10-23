# 🤖 MultiBot

Repositorio para mantener **varios bots de WhatsApp aislados por carpeta**, con Baileys, Pairing Code/QR, Universal Bot para Termux y un panel web desplegable en **Render con Blueprint + PostgreSQL**.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lyanvalentinmail-prog/MultiBot)

```text
MultiBot/
├── bots/
│   ├── universal-bot/       # Todo-en-uno, 200 plugins, Termux-only, sin NSFW/+18
│   └── _template/           # Plantilla ligera para nuevos bots
├── web/                     # SPA/PWA de MultiBot (diseño inspirado en TomiOka)
├── scripts/serve-web.js     # Servidor/API del portal; PostgreSQL o JSON local
├── data/                    # Fallback local ignorado por Git
├── docs/                    # Guías de repositorio, Termux y web
└── render.yaml              # Blueprint: web service + PostgreSQL
```

## Bots

| Bot | Plataforma | Estado | Qué incluye |
|---|---|---|---|
| **Universal Bot** | **Termux solamente** | ✅ | RPG, juegos, IA, descargas, stickers, grupos, antis y más; sin contenido NSFW/+18. Pairing Code y QR en la terminal. |
| `_template` | Para desarrollar un bot nuevo | 📦 | Base pequeña para duplicar y adaptar. |

> Universal Bot conserva el guard de Termux. El panel web **no ejecuta el bot**: cataloga componentes y guarda perfiles de configuración. WhatsApp se vincula desde Termux y las credenciales permanecen en el dispositivo.

## Universal Bot en Termux

```bash
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts ffmpeg imagemagick python -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
npm install
cp config.example.js config.js
nano config.js             # configura owner y LID
npm start                  # elige "code" (pairing) o "qr"
```

Guías completas: [`docs/TERMUX_GUIDE.md`](docs/TERMUX_GUIDE.md) · [`bots/universal-bot/docs/TERMUX.md`](bots/universal-bot/docs/TERMUX.md)

## Panel web

Diseño responsive/PWA inspirado en [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka), adaptado al catálogo `bots/`:

- Descubre bots y plugins del repositorio.
- Permite registrar una cuenta y guardar/editar/eliminar perfiles de configuración.
- Muestra métricas reales del proceso web y estado de la base de datos.
- Documenta la instalación Termux, Pairing Code, QR y API del panel.
- No solicita el número de WhatsApp, no crea sesiones, y no afirma que un bot Termux esté conectado al servidor.

### Ejecutar localmente

```bash
npm ci
npm start
# http://localhost:3000
```

Si `DATABASE_URL` está configurada, se utiliza PostgreSQL; en local, sin esa variable, la persistencia usa `data/multibot-local.json` (ignorado por Git).

### Desplegar en Render

1. Abre Render → **New → Blueprint**.
2. Selecciona el repositorio MultiBot y aplica `render.yaml`.
3. Render crea el servicio web `multibot-panel` y PostgreSQL `multibot-db`, y conecta `DATABASE_URL`.
4. Abre la URL del servicio y crea una cuenta para guardar perfiles.

El Blueprint usa web service **Free** y base de datos PostgreSQL **Basic 256 MB** (la base tiene costo; verifica el precio actual de Render antes de aplicar). El plan Free del servicio puede suspenderse cuando está inactivo. Render aloja el panel y la base de datos, no Universal Bot.

Más detalles: [`docs/WEB.md`](docs/WEB.md).

## Crear otro bot

```bash
bash scripts/create-bot.sh mi-bot
```

Agrega un `package.json`, plugins y, opcionalmente, un `bot.json` para declarar el nombre, el modo de ejecución y las capacidades. El panel lee el catálogo desde `bots/` al cargar la API. Ver [`docs/ADD_NEW_BOT.md`](docs/ADD_NEW_BOT.md).

## API web

`GET /api/health`, `/api/state`, `/api/system`, `/api/bots`, `/api/plugins`, `/api/endpoints`; perfiles autenticados en `/api/instances`. La referencia actualizada está en la página [`/endpoints`](docs/WEB.md#api) o en [`docs/WEB.md`](docs/WEB.md#api).

## Seguridad y límites

- Universal Bot fue limpiado de funciones y contenido NSFW/+18.
- El panel almacena hashes de contraseñas y tokens de sesión; los perfiles pertenecen a la cuenta que los creó.
- No guardar `config.js`, `sessions/`, tokens o datos privados en commits.
- Pairing Code/QR se generan en el flujo de inicio del bot desde Termux; nunca compartas el código con terceros.

## Documentación

- [Estructura del repo](docs/STRUCTURE.md)
- [Instalación Termux](docs/TERMUX_GUIDE.md)
- [Agregar bot](docs/ADD_NEW_BOT.md)
- [Panel web + PostgreSQL + Render](docs/WEB.md)

## Créditos y licencias

Universal Bot se basa en [nexusday/pain-bot](https://github.com/nexusday/pain-bot) y mantiene sus obligaciones GPL-3.0-or-later. El diseño web se adaptó de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka); ver [`web/THIRD_PARTY_NOTICES.md`](web/THIRD_PARTY_NOTICES.md).
