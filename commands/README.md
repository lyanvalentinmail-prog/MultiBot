# 📂 Carpeta `commands/` — todos los comandos del repo

Esta es la **única carpeta** con las implementaciones de los comandos de todos
los bots. Antes cada bot tenía su propia carpeta (`plugins/`, `src/commands/`);
ahora viven aquí, **organizadas por categoría**.

```text
commands/
├── audio/        # audio-slow, audio-speed, audio-tts…
├── busqueda/     # google-search, search-sticker, tiktok-search…
├── conversion/   # sticker-toimg, text-pdf, take, toimg, tovideo…
├── descargas/    # Download-fb, tiktok-2, ytmp3…
├── extras/       # help, debug, pack, emojimix, timer…
├── grupos/       # group-kick, group-open, tag-all, add, kick, promote…
├── herramientas/ # lyrics, timer
├── ia/           # ia-chatgpt, chatgpt, deepseek, gemini…
├── imagen/       # img-hd, img-meme…
├── info/         # info-grupo, main-menu2, ping, qr-generate…
├── juegos/       # dado, game-html-snake, moneda, random-cat
├── moderacion/   # anti-link, anti-spam, solo-admin, publicacion-spam…
├── modos/        # modo-ia, modo-sub, modo-human…
├── owner/        # owner-restart, owner-mod, owner-verplugin…
├── perfiles/     # perfiles-perfil, perfiles-setname…
├── reacciones/   # reaccion-abrazo, reaccion-beso…
├── rpg/          # rpg-char-buy, rpg-daily, rpg-michi, economia-coins…
├── stickers/     # stickers-sticker, attp, brat, search, searchpack, ttp…
├── subbots/      # sub-bots, subbots-maxsubs, serbot-serbot…
├── top/          # top-activos, top-coins, top-femboys…
├── categories.json   # Listado oficial de categorías
└── README.md         # Este archivo
```

## El contrato de un comando

Todos los comandos exportan el **mismo objeto**, sin importar el bot que los
use:

```js
export default {
  name: 'kick',                    // nombre del comando (obligatorio)
  aliases: ['expulsar'],           // otros nombres que lo invocan
  category: 'grupos',              // categoría (debe existir en categories.json)
  description: 'Elimina a un usuario del grupo',
  usage: '.kick @usuario',
  examples: ['.kick @usuario'],
  async run(ctx) {
    // ctx: el contexto del comando (ver más abajo)
    await ctx.reply('Listo ✅')
  }
}
```

Opcionalmente un comando puede declarar:

| Campo | Para qué sirve |
|---|---|
| `tags` | Etiquetas legacy (`grupo`, `admins`, `stickers`…) que usa el bot universal. |
| `all(ctx)` | Hook que se ejecuta con **cada** mensaje (menús, packs). |
| `before(ctx)` | Hook que se ejecuta antes de buscar coincidencias. |
| `customPrefix` | Prefijo propio del comando. |
| `disabled` | El comando existe pero no responde. |

## El contexto (`ctx`)

El contexto es lo que recibe `run(ctx)`. Los bots construyen uno con los
mismos campos, así que un comando escrito una vez sirve para todos:

| Campo | Qué es |
|---|---|
| `ctx.reply(texto)` | Responde citando el mensaje. |
| `ctx.send(texto)` | Responde sin citar. |
| `ctx.sendImage/sendVideo/sendSticker/sendFile` | Envía multimedia. |
| `ctx.sendList({...})` | Envía la lista interactiva de WhatsApp. |
| `ctx.react(emoji)` | Reacciona al mensaje. |
| `ctx.config` | Config del bot (`ctx.config.bot.name`, `ctx.config.bot.emojis`…). |
| `ctx.commands` | Mapa nombre/alias → comando. |
| `ctx.commandList` / `ctx.visibleCommands` | Listados de comandos. |
| `ctx.menu` | Módulo de menú del bot (para el comando `help`). |
| `ctx.isOwner` / `ctx.isAdmin` / `ctx.isGroup` | Permisos y contexto del chat. |
| `ctx.m` | El mensaje original (formato Baileys). |

## El manifiesto de cada bot

Cada bot declara **qué comandos usa** en su propio `commands.json`:

```json
{
  "bot": "tomioka",
  "description": "Comandos que usa TomiOka.",
  "commands": [
    "extras/debug.js",
    "grupos/kick.js",
    "ia/chatgpt.js"
  ]
}
```

El cargador común (`lib/commands.js`) lee ese manifiesto, importa los ficheros
y arma el registro (nombre/alias → comando). Si un comando no está en el
manifiesto, ese bot no lo carga.

```js
import { loadBotCommands } from '../../lib/commands.js'

const { commandList, visibleCommands, commands, findCommand } =
  await loadBotCommands(rutaDelBot)
```

## Añadir un comando

1. Crea el fichero en la categoría que corresponda: `commands/<categoría>/<nombre>.js`.
2. Exporte el objeto canónico con `name`, `aliases`, `category`, `description`
   y `run(ctx)`.
3. Añade su ruta al `commands.json` de los bots que lo usen.

## Compatibilidad con los bots antiguos

Los plugins del bot universal conservan su cuerpo original (`handler(m, {...})`)
y se envuelven en el contrato canónico:

```js
export default {
  name: 'ban',
  aliases: ['kick'],
  category: 'grupos',
  description: '…',
  async run(ctx) {
    return handler(ctx.m, ctx)   // el cuerpo no cambia
  }
}
```

Así el mismo bot puede usar comandos escritos con cualquiera de los dos
estilos, y los nuevos pueden escribirse una sola vez para todos.
