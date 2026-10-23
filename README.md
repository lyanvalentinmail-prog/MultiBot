# 🤖 MultiBot

Repositorio para mantener **bots de WhatsApp aislados por carpeta**, con Baileys, Pairing Code/QR, Universal Bot compatible con **Termux y runtime web autorizado**, y un panel web desplegable en Render Free.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lyanvalentinmail-prog/MultiBot)

```text
MultiBot/
├── bots/
│   ├── universal-bot/       # Todo-en-uno; Termux + web admin; sin NSFW/+18
│   └── _template/           # Plantilla ligera para nuevos bots
├── web/                     # SPA/PWA MultiBot (diseño adaptado de TomiOka)
├── scripts/serve-web.js     # Servidor/API del catálogo, cuentas y runtime (más rutas heredadas)
├── scripts/web-runtime.js   # Gestión protegida de procesos hijos
├── data/                    # Fallback local ignorado por Git
├── docs/                    # Guías de repositorio, Termux y web
├── termux.sh                # Terminal personalizada Termux (menú, QR, pairing code)
└── render.yaml              # Blueprint Free: panel + PostgreSQL
```

## Bots

| Bot | Plataforma | Qué incluye |
|---|---|---|
| **Universal Bot** | **Termux o runtime web autorizado** | RPG, juegos, IA, descargas, stickers, grupos y más; sin contenido NSFW/+18. QR/Pairing Code reales de Baileys. |
| `_template` | Desarrollo | Plantilla pequeña, oculta del catálogo público. |

> La ejecución web solo está disponible para bots con `webRuntime: true`. La primera cuenta del panel queda como propietaria del runtime (o puedes definir `WEB_RUNTIME_ADMIN_EMAILS`). Por límites de Render Free se inicia **un proceso de bot a la vez**; el web service ofrece 512 MB de RAM y 0.1 CPU compartidos entre panel y bot, por lo que algunas tareas pesadas de IA/OCR pueden fallar. El servicio puede suspenderse/reiniciarse y las credenciales de Baileys se guardan en filesystem efímero; no hay garantía 24/7 ni persistencia de sesión.

## Universal Bot en Termux

```bash
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts ffmpeg imagemagick python -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
npm install
npm run setup              # asistente: tu número, nombre y LID (sin nano)
npm run doctor             # opcional: verifica Node, deps y config
npm start                  # elige "code" (pairing) o "qr"
```

> ¿`SyntaxError: Unexpected identifier 'start'` al arrancar? Pegaste `npm start` dentro del editor.
> Ejecuta `npm run setup -- --fix` (o `rm config.js && npm run setup`).

Guías completas: [`docs/TERMUX_GUIDE.md`](docs/TERMUX_GUIDE.md) · [`bots/universal-bot/docs/TERMUX.md`](bots/universal-bot/docs/TERMUX.md)

## 🤖 Terminal personalizada (Termux)

`termux.sh` es la forma más fácil de usar MultiBot en Termux: menú interactivo
en español, sin instalar nada extra, que **detecta tus bots**, te deja
**elegir cuál iniciar**, **pide el Pairing Code o muestra el QR** y
personaliza el prompt de Termux (colores, alias `multibot`, banner).

```bash
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot
bash termux.sh            # menú: elegir bot, QR, pairing code, config…
bash termux.sh --code 59899123456   # atajo directo a pairing code
bash termux.sh --qr                 # atajo directo a QR
```

Guía completa: [`docs/TERMUX_TERMINAL.md`](docs/TERMUX_TERMINAL.md)

## Panel web y runtime

La web descubre bots y plugins y ofrece **Crear bot** para desplegar/iniciar Universal Bot como proceso dentro del servicio web existente y vincular WhatsApp con un QR o Pairing Code real. Esto no aprovisiona un servicio Render nuevo. El despliegue no necesita variables extra: **la primera cuenta creada en el panel queda como propietaria** y es la única que puede iniciar/detener el bot y ver los códigos. Si quieres cambiar eso, define `WEB_RUNTIME_OWNER_EMAIL` o una allowlist en `WEB_RUNTIME_ADMIN_EMAILS` (consulta [`docs/WEB.md`](docs/WEB.md)).

### Desplegar y vincular en 3 pasos

1. En Render: **New → Blueprint → Apply** (servicio web y PostgreSQL en plan Free).
2. Abre la URL del servicio y pulsa **Crear cuenta**. La primera cuenta queda como propietaria del runtime.
3. Entra en **Crear bot**, elige **Pairing Code** (escribe tu número internacional) o **QR**, y pulsa **Desplegar bot y vincular**.

En **Crear bot** eliges Pairing Code o QR. Con Pairing Code el panel te pide tu **número de WhatsApp con código de país** (por ejemplo `59899123456`); ese número se envía al proceso del bot para solicitar el código y no se guarda en la base ni en la sesión. Con QR solo escaneas la imagen. Las credenciales de Baileys no van a PostgreSQL.

### Ejecutar localmente

```bash
npm ci
npm ci --prefix bots/universal-bot --omit=dev
npm start
# http://localhost:3000 → crea la primera cuenta → Crear bot
```

Sin `DATABASE_URL`, la persistencia local usa `data/multibot-local.json` (ignorado por Git). El servidor no carga `.env` automáticamente; exporta variables o usa una herramienta dotenv.

### Render Free: costos y límites

El Blueprint configura web service y PostgreSQL en plan **Free**, sin cambiar a recursos pagos. El servicio puede dormir cuando está inactivo; sus procesos de bot pueden detenerse en suspensión, reinicio o deploy. Render Free no ofrece almacenamiento persistente aquí; las sesiones locales de Baileys pueden perderse.

La base de datos PostgreSQL Free de Render vence a los **30 días**: exporta cuentas y configuraciones antiguas o migra antes de esa fecha. No actualices a un plan pago si no quieres cargos. La base del panel nunca almacena credenciales de Baileys.

Más detalles: [`docs/WEB.md`](docs/WEB.md).

## Añadir un bot

```bash
bash scripts/create-bot.sh mi-bot
```

La carpeta se detecta automáticamente en el catálogo. Para iniciarse desde la web, el bot necesita un entrypoint no interactivo, contrato de eventos seguro, pruebas y opt-in explícito en `bot.json`; consulta [`docs/ADD_NEW_BOT.md`](docs/ADD_NEW_BOT.md).

## Atribución y contenido

La interfaz está adaptada de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka); se conserva su atribución/licencia en `web/THIRD_PARTY_NOTICES.md` y `web/LICENSE-TOMIOKA.txt`. Universal Bot se mantiene sin contenido NSFW/adulto/+18.
