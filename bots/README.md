# 🤖 Bots

Cada bot vive en su **propia carpeta** dentro de `bots/` con plugins, configuración y sesiones aislados.

## 📁 Estructura

```text
bots/
├── _template/            # Plantilla para bots nuevos (oculta del catálogo)
├── universal-bot/        # Todo-en-uno: Termux + runtime web autorizado, sin NSFW
│   ├── config.js          # Configuración privada, ignorada por Git
│   ├── index.js / main.js
│   ├── handler.js
│   ├── lib/
│   ├── plugins/
│   ├── storage/
│   ├── sessions/          # Credenciales Baileys (no se commitea)
│   └── docs/
└── tu-nuevo-bot/
```

## 🔑 Aislamiento

- DB propia en `storage/databases/`.
- `sessions/` propia con credenciales Baileys.
- Plugins independientes.
- Configuración privada por bot.

## ➕ Crear un bot

```bash
bash scripts/create-bot.sh nombre-del-bot
```

O crea la carpeta manualmente con `package.json`, `config.example.js`, guard y plugins. Ver [`docs/ADD_NEW_BOT.md`](../docs/ADD_NEW_BOT.md).

## 📋 Catálogo

| Carpeta | Bot | Descripción | Runtime |
|---|---|---|---|
| `universal-bot` | Universal Bot | 200+ plugins, sin +18 | Termux + web Free (admin) |
| `_template` | Template | Base limpia para clonar | No publicado |

Universal Bot permite QR y Pairing Code reales en ambos entornos. En web la primera cuenta del panel (propietaria) o los emails de `WEB_RUNTIME_ADMIN_EMAILS` pueden operar el proceso y consultar los códigos. Render Free permite un proceso simultáneo, puede suspenderse y usa almacenamiento efímero.

## 🌐 Panel web

La web lista los bots visibles y ofrece controles de runtime solo para manifiestos que optan explícitamente por `executionMode: "web"` y `webRuntime: true`. Para activar Universal Bot en Render, consulta [`docs/WEB.md`](../docs/WEB.md). PostgreSQL Free del panel vence a los 30 días; credenciales Baileys no se guardan ahí.
