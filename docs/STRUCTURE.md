# 📁 Estructura de MultiBot

## Árbol completo

```
MultiBot/
├── README.md                 # Root readme
├── .gitignore
├── bots/                     # TODOS los bots
│   ├── README.md
│   ├── _template/            # Plantilla para nuevos bots
│   │   ├── config.example.js
│   │   ├── index.js
│   │   ├── main.js
│   │   ├── handler.js
│   │   ├── package.json
│   │   ├── lib/
│   │   ├── plugins/
│   │   ├── storage/
│   │   ├── sessions.example/
│   │   ├── scripts/
│   │   └── docs/
│   └── universal-bot/        # Bot 1: Universal Bot
│       ├── config.js         # Config real (gitignored ejemplo)
│       ├── config.example.js
│       ├── index.js          # Launcher con cluster + cfonts
│       ├── main.js           # Core Baileys + login QR/code
│       ├── handler.js        # Router de mensajes/plugins
│       ├── package.json
│       ├── eng.traineddata / spa.traineddata  # OCR
│       ├── lib/
│       │   ├── termux-guard.js     # Solo Termux
│       │   ├── Modos/              # modo-ia, human, sad, psico, ilegal, custom, descargas
│       │   ├── Antis/              # anti-link, anti-spam, etc.
│       │   ├── characters/         # gacha/harem
│       │   ├── menu-categories.js  # Menú por categorías
│       │   ├── geminiAPI.js        # IA (sin hot)
│       │   └── ...                 # +30 libs
│       ├── plugins/                # 200+ comandos
│       │   ├── modo-*.js           # toggles de modos
│       │   ├── anti-*.js
│       │   ├── rpg-*.js
│       │   ├── group-*.js
│       │   ├── sticker*.js
│       │   ├── download-*.js
│       │   └── ...
│       ├── storage/
│       │   ├── databases/          # database.json (gitignored), characters-catalog.json
│       │   └── img/                # imgs del menú
│       ├── sessions/               # creds.json Baileys (gitignored)
│       ├── tmp/                    # temp files (gitignored)
│       ├── scripts/
│       │   ├── ensure-sharp.js
│       │   └── sync-characters-catalog.js
│       └── docs/
│           └── TERMUX.md
├── web/                      # Dashboard (placeholder)
│   ├── README.md
│   ├── src/
│   └── public/
├── docs/                     # Documentación
│   ├── STRUCTURE.md          # Este archivo
│   ├── TERMUX_GUIDE.md
│   ├── ADD_NEW_BOT.md
│   └── API.md
└── scripts/
    ├── create-bot.sh         # Crea nuevo bot desde template
    └── install-termux.sh     # Instalador Termux
```

## Principios

1. **Aislamiento por bot**: cada carpeta `bots/<nombre>` es autocontenida. Puede tener su propia `package.json`, `storage`, `sessions` y `config.js`. No comparten DB.
2. **Template**: `_template` es la base limpia. Para un nuevo bot: `cp -r _template bots/mi-bot`.
3. **Web separada**: `web/` no está dentro de un bot; es global y leerá/escribirá sobre `bots/*` vía API.
4. **Docs centralizadas**: `docs/` para guías globales, `bots/<bot>/docs/` para guías específicas del bot.

## ¿Dónde va cada cosa?

| Necesito... | Carpeta |
|-------------|---------|
| Añadir comando a Universal Bot | `bots/universal-bot/plugins/mi-comando.js` |
| Cambiar prefijo/owner de Universal Bot | `bots/universal-bot/config.js` |
| Ver logs de Universal Bot | `bots/universal-bot/tmp/` o consola Termux |
| Crear bot nuevo | `bots/mi-bot/` (desde `_template`) |
| Añadir página al dashboard | `web/src/app/` |

## Gitignore

- `bots/*/sessions/` → creds sensibles
- `bots/*/storage/databases/database.json` → DB mutable
- `bots/*/tmp/` → temporales
- `node_modules/` → dependencias
