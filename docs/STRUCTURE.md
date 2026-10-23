# 📁 Estructura de MultiBot

```text
MultiBot/
├── package.json / package-lock.json   # Panel/API Node y dependencia PostgreSQL
├── render.yaml                        # Blueprint: web service + PostgreSQL
├── .env.example                       # Variables opcionales para desarrollo local
├── bots/
│   ├── _template/                     # Base para crear bots
│   └── universal-bot/                 # 200 plugins; Baileys; solo Termux
│       ├── bot.json                   # Metadatos que consume el catálogo web
│       ├── config.example.js          # Plantilla; config.js es privado/ignorado
│       ├── index.js / main.js          # Inicio y conexión desde Termux
│       ├── handler.js                 # Router de mensajes/plugins
│       ├── lib/                       # Guard Termux, modos y utilidades
│       ├── plugins/                   # Plugins JavaScript
│       ├── storage/                   # Datos propios del bot
│       ├── sessions/                  # Credenciales Baileys (ignorado)
│       ├── tmp/                       # Archivos temporales (ignorado)
│       └── docs/                      # Guías específicas del bot
├── web/                               # SPA/PWA MultiBot inspirada en TomiOka
│   ├── index.html                     # Shell y símbolos SVG
│   ├── app.js                         # Navegación, vistas y cliente API
│   ├── styles.css                     # Diseño responsive
│   ├── fonts/                         # Outfit, JetBrains Mono y licencia OFL
│   ├── manifest.webmanifest           # Metadatos de PWA
│   └── sw.js                          # Cache shell, excluye API dinámica
├── scripts/
│   ├── serve-web.js                   # Servidor HTTP, catálogo y API de perfiles
│   ├── create-bot.sh                  # Crea bot desde _template
│   └── install-termux.sh              # Ayuda de instalación Termux
├── data/                              # JSON local (ignorado; no se despliega)
├── tests/web-api.test.js              # Smoke/integration de auth y perfiles
└── docs/                              # Guías globales
```

## Principios

1. **Aislamiento por bot:** cada `bots/<id>` mantiene plugins, configuración, storage y sesiones independientes.
2. **Universal Bot es Termux-only:** Pairing Code y QR se usan desde el inicio del proceso en Termux. No trasladar sus sesiones al panel ni a Render.
3. **El panel no ejecuta bots:** la web lee metadatos/plugins y persiste perfiles de configuración. PostgreSQL guarda cuentas y perfiles, no credenciales Baileys.
4. **Catálogo extensible:** la API descubre subcarpetas de `bots/`, lee su `package.json`, plugins y un `bot.json` opcional.
5. **Datos privados ignorados:** `config.js`, `sessions/`, temporales y el fallback local no se agregan a Git.

## Añadir un bot al catálogo

Cada nueva carpeta debe tener un `package.json`; `bot.json` es opcional pero recomendado. Declara explícitamente el modo y capacidades, por ejemplo:

```json
{
  "id": "mi-bot",
  "name": "Mi Bot",
  "description": "Descripción pública",
  "executionMode": "termux",
  "webRuntime": false,
  "supportsPairingCode": true,
  "supportsQr": true,
  "adultContent": false,
  "defaultPrefix": ".",
  "features": ["Moderación", "Stickers"]
}
```

No declares `webRuntime: true` a menos que ese bot realmente tenga un runtime web separado y compatible. Ver [`ADD_NEW_BOT.md`](ADD_NEW_BOT.md).

## ¿Dónde va cada cosa?

| Necesito... | Carpeta/archivo |
|---|---|
| Añadir plugin al Universal Bot | `bots/universal-bot/plugins/` |
| Configurar propietario del Universal Bot | crear `bots/universal-bot/config.js` desde `config.example.js` |
| Consultar logs del bot | consola Termux y `bots/universal-bot/tmp/` |
| Crear un bot nuevo | `bots/<id>/` desde `_template` |
| Ajustar interfaz SPA | `web/app.js`, `web/index.html`, `web/styles.css` |
| Modificar API/servidor | `scripts/serve-web.js` |
| Cambiar despliegue o PostgreSQL | `render.yaml` y `docs/WEB.md` |
| Ejecutar smoke tests | `npm test` |

## Gitignore

- `bots/*/sessions/` y `config.js` → credenciales y configuración privada.
- `bots/*/storage/databases/database.json` → datos mutables de cada bot.
- `bots/*/tmp/`, `node_modules/` → archivos temporales/dependencias.
- `data/*.json` → fallback local de cuentas y perfiles del panel.
