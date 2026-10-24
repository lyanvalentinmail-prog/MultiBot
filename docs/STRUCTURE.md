# 📁 Estructura de MultiBot

```text
MultiBot/
├── package.json / package-lock.json   # Panel/API, PostgreSQL y generador de QR
├── render.yaml                        # Blueprint Free: portal + PostgreSQL
├── .env.example                       # Variables opcionales locales/runtime
├── commands/                          # ⭐ ÚNICA carpeta con los comandos de todos los bots
│   ├── <categoría>/                   # audio, busqueda, grupos, ia, rpg, stickers, top…
│   ├── categories.json                # Listado oficial de categorías
│   └── README.md                      # Contrato canónico, ctx y manifiestos
├── lib/                               # Kit compartido por los bots, por dominio
│   ├── commands.js                    # Cargador común (manifiesto → registro); ancla de la raíz
│   ├── runtime.js                     # Raíz y marca del bot activo; ancla del kit
│   ├── core/                          # branding, banner, cache, concurrencia, tmp, sesión
│   ├── media/                         # media, sticker, ffmpeg, webp, emojimix, zip…
│   ├── ai/                            # ai.js (gateways de IA) y text.js (texto)
│   ├── net/                           # http.js y downloaders.js (red y descargas)
│   └── wa/                            # groups, interactive, live-messages, message
├── bots/
│   ├── _template/                     # Base para crear bots (oculta del catálogo web y del menú de Termux)
│   ├── tomioka/                       # Stickers, packs, descargas e IA (Termux)
│   │   └── commands.json              # Los 36 comandos que usa
│   ├── izuku-bot/                     # Estilo Deku: stickers, packs, IA (Termux)
│   │   └── commands.json              # Los 36 comandos que usa
│   └── universal-bot/                 # Baileys, Termux + runtime web autorizado
│       ├── bot.json                   # Metadatos y entrypoint web opt-in
│       ├── config-loader.js           # config.js privado o defaults/env
│       ├── config.example.js          # Plantilla sin secretos
│       ├── package.json / lockfile     # Dependencias reproducibles del bot
│       ├── index.js / main.js          # Inicio Termux y proceso Baileys
│       ├── handler.js                 # Router de mensajes/plugins
│       ├── lib/                       # Guard, modos y utilidades del bot
│       ├── commands.json              # Comandos que usa este bot (rutas de commands/)
│       ├── storage/                   # Datos propios del bot (efímeros en Render)
│       ├── sessions/                  # Credenciales Baileys, ignoradas por Git
│       ├── tmp/                       # Archivos temporales, ignorados por Git
│       └── docs/                      # Guías específicas del bot
├── web/                               # SPA/PWA adaptada de TomiOka
│   ├── index.html                     # Shell y símbolos SVG
│   ├── app.js                         # Navegación, vistas y cliente API
│   ├── styles.css                     # Diseño responsive y panel de runtime
│   ├── fonts/                         # Outfit, JetBrains Mono y licencia OFL
│   ├── manifest.webmanifest           # Metadatos PWA
│   └── sw.js                          # Cache shell, excluye API dinámica
├── scripts/
│   ├── server/
│   │   ├── serve-web.js               # Servidor, catálogo, API y permisos
│   │   ├── web-runtime.js             # Procesos hijos, QR/código y parada
│   │   └── ensure-bot-dependencies.js # Instala dependencias de un bot bajo demanda
│   ├── create-bot.sh                  # Crea bot desde _template
│   ├── install-termux.sh              # Ayuda de instalación Termux
│   └── termux-go.sh                   # Bootstrap remoto (URL pública estable)
├── data/                              # JSON local de cuentas/perfiles (ignorado)
├── tests/                             # Pruebas organizadas por área
│   ├── web/                           # API y UI del panel
│   ├── kit/                           # Comandos, stickers y kit compartido
│   └── bots/                          # Catálogo, personalización y terminales
└── docs/                              # STRUCTURE.md (índice) y guías en guides/
    └── guides/                        # WEB, TERMUX_GUIDE, TERMUX_TERMINAL, ADD_NEW_BOT
```

## Principios

1. **Comandos centralizados:** todas las implementaciones de comandos viven en `commands/`, por categoría. Cada bot declara en `commands.json` los que usa; su carpeta solo guarda lo suyo (configuración, storage, sesiones).
2. **Runtime explícito:** el catálogo solo permite ejecución web si el manifiesto declara `executionMode: "web"` y `webRuntime: true`. Universal Bot también conserva Termux.
3. **Permiso de runtime:** QR, Pairing Code, estado y acciones de ejecución requieren la cuenta propietaria del panel (la primera cuenta creada) o un email de `WEB_RUNTIME_ADMIN_EMAILS`.
4. **Recursos Free:** el manager permite un proceso de bot a la vez. Render Free puede suspender el servicio; no promete uptime continuo ni persistencia de credenciales.
5. **Credenciales fuera de PostgreSQL:** cuentas/perfiles se guardan en la base del panel; credenciales Baileys se escriben en el filesystem efímero del servicio.
6. **Catálogo extensible:** la API descubre subcarpetas de `bots/`, `package.json`, el manifiesto `commands.json` y un `bot.json` opcional.
7. **Datos privados ignorados:** `config.js`, `sessions/`, temporales y el fallback local no se suben a Git.
8. **Contenido apto:** bots declarados como `adultContent: true` no aparecen en catálogo ni pueden iniciar desde API.

## ¿Dónde va cada cosa?

| Necesito... | Carpeta/archivo |
|---|---|
| Añadir un comando (a cualquier bot) | `commands/<categoría>/` + el `commands.json` del bot |
| Configurar propietario del bot | `config.js` privado o variables `BOT_UNIVERSAL_BOT_*` |
| Consultar logs del bot | Panel autenticado o consola Termux |
| Crear un bot nuevo | `bots/<id>/` desde `_template` |
| Ajustar interfaz SPA | `web/app.js`, `web/index.html`, `web/styles.css` |
| Modificar API/permisos | `scripts/server/serve-web.js` |
| Gestionar procesos web | `scripts/server/web-runtime.js` |
| Cambiar Render o PostgreSQL | `render.yaml` y `docs/guides/WEB.md` |
| Ejecutar pruebas | `npm test` |

## Gitignore

- `bots/*/sessions/` y `config.js` → credenciales/configuración privada.
- `bots/*/storage/databases/database.json` → datos mutables del bot.
- `bots/*/tmp/`, `node_modules/` → temporales y dependencias.
- `data/*.json` → fallback local de cuentas y perfiles del panel.
- Los lockfiles raíz y de Universal Bot se versionan para instalaciones reproducibles.
