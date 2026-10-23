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
└── render.yaml              # Blueprint Free: panel + PostgreSQL
```

## Bots

| Bot | Plataforma | Qué incluye |
|---|---|---|
| **Universal Bot** | **Termux o runtime web autorizado** | RPG, juegos, IA, descargas, stickers, grupos y más; sin contenido NSFW/+18. QR/Pairing Code reales de Baileys. |
| `_template` | Desarrollo | Plantilla pequeña, oculta del catálogo público. |

> La ejecución web solo está disponible para bots con `webRuntime: true` y requiere un email incluido en `WEB_RUNTIME_ADMIN_EMAILS`. Por límites de Render Free se inicia **un proceso de bot a la vez**; el web service ofrece 512 MB de RAM y 0.1 CPU compartidos entre panel y bot, por lo que algunas tareas pesadas de IA/OCR pueden fallar. El servicio puede suspenderse/reiniciarse y las credenciales de Baileys se guardan en filesystem efímero; no hay garantía 24/7 ni persistencia de sesión.

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

## Panel web y runtime

La web descubre bots y plugins y ofrece **Crear bot** para iniciar Universal Bot y vincular WhatsApp con un QR o Pairing Code real. Los controles del runtime se limitan a administradores autorizados. Consulta [`docs/WEB.md`](docs/WEB.md): despliega el Blueprint con `WEB_RUNTIME_ADMIN_EMAILS` vacío, crea primero tu cuenta, agrega su email exacto a esa variable en Render y reinicia el servicio. Luego abre **Crear bot**.

El Pairing Code puede requerir ingresar el teléfono internacional en el panel. Ese número se envía al runtime protegido para solicitar el código y no se guarda. Las credenciales no van a PostgreSQL.

### Ejecutar localmente

```bash
npm ci
npm ci --prefix bots/universal-bot --omit=dev
WEB_RUNTIME_ENABLED=true WEB_RUNTIME_ADMIN_EMAILS=tu-email@example.com npm start
# http://localhost:3000
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
