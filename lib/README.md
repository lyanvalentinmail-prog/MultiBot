# lib/ — Kit compartido

Módulos comunes que usan los comandos de `commands/` y los bots de `bots/`.
Está organizado por dominio; los dos módulos ancla se mantienen en la raíz de
`lib/` porque de su ubicación física se derivan rutas del repositorio.

```text
lib/
├── commands.js   # ANCLA: cargador de comandos (manifiestos → registro); calcula REPO_ROOT
├── runtime.js    # ANCLA: raíz del bot activo y su marca (branding)
├── core/         # branding, banner, cache, concurrency, tmp y session
├── media/        # media, sticker y sticker-pack/search, text-sticker, ffmpeg, webp, emojimix, zip
├── ai/           # ai.js (gateways de IA) y text.js (utilidades de texto)
├── net/          # http.js y downloaders.js (cliente HTTP y descargas)
└── wa/           # groups, interactive, live-messages y message (integración WhatsApp/Baileys)
```

## Notas para importar

- Los comandos importan con rutas relativas, p. ej.
  `import { createSticker } from '../../lib/media/sticker.js'`.
- Los módulos dentro de `lib/` se importan entre carpetas con `../<dominio>/…`
  y usan `../runtime.js` / `../commands.js` para los anclas.
- `commands.js` resuelve `REPO_ROOT` como la carpeta padre de `lib/`: si algún
  día se mueve `lib/`, hay que actualizar ese cálculo y todas las rutas.
- Cada bot conserva además su propio `lib/` interno (p. ej.
  `bots/universal-bot/lib/`), independiente de este kit compartido.
