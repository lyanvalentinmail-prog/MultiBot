# 🤖 MultiBot Terminal — terminal personalizada para Termux

`termux.sh` es la terminal personalizada de MultiBot: un menú interactivo en
español que funciona solo con `bash` (sin instalar nada extra) para elegir qué
bot iniciar, vincularlo por **QR** o **Pairing Code**, configurarlo y dejar
Termux con prompt, colores y alias propios.

## Instalación (Termux)

```bash
pkg update -y && pkg upgrade -y
pkg install git nodejs-lts -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot
bash termux.sh
```

> También funciona con `./termux.sh` (ya tiene permiso de ejecución).
>
> **¿Estás dentro de `bots/universal-bot`?** No importa: desde esa carpeta
> `bash termux.sh` también funciona, hay un acceso directo que abre la
> terminal real con los mismos argumentos.

## ❓ Error: «bash: termux.sh: No such file or directory»

Pasa por una de estas causas (de más a menos común):

1. **Estás en la carpeta equivocada.** Las guías viejas te mandan a
   `cd MultiBot/bots/universal-bot`, pero `termux.sh` vive en la **raíz**.
   Solución:
   ```bash
   cd ~/MultiBot && bash termux.sh
   ```
2. **Tu clon está desactualizado** (la terminal se agregó después de tu
   `git clone`). Solución:
   ```bash
   cd ~/MultiBot && git pull && bash termux.sh
   ```
3. **Descargaste el ZIP** o tu carpeta no es un clon git. Solución: el
   instalador de un comando (abajo).

### Arreglo en un solo comando

Pega esto en Termux — clona o actualiza el repo y abre la terminal.
Si tu carpeta existe pero no es un clon, la **respalda con fecha en vez de
borrarla** (tu sesión queda a salvo):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/lyanvalentinmail-prog/MultiBot/main/scripts/termux-go.sh)
```

> Si falta `curl`: `pkg install curl -y`. Si falta `git`:
> `pkg install git -y`. Acepta argumentos: agrégale `--qr` o
> `--code 59899123456` al final.

## Menú principal

```text
  1) 🚀 Iniciar bot [universal-bot]
  2) 🤖 Elegir bot (actual: universal-bot)
  3) 🔑 Pedir Pairing Code
  4) 📷 Mostrar QR
  5) ⚙  Configurar bot (número, nombre)
  6) 📦 Instalar todo (sistema + dependencias)
  7) 🩺 Diagnóstico (doctor)
  8) ℹ  Ver info del bot
  9) 🚪 Borrar sesión (desvincular WhatsApp)
 10) ⬆  Actualizar desde GitHub
 11) 🎨 Personalizar terminal Termux
 12) 🎛 Personalizar bot (stickers, banner, owners…)
 13) ♻ Reinstalación limpia (borra node_modules)
  0) 👋 Salir
```

> La opción `1` muestra el estado del bot por defecto (`● listo`,
> `● sin config`, `● sin instalar`). La `10` (actualizar) reinstala
> sola las dependencias si el pull las cambió. Y si algo quedó roto,
> la `13` borra `node_modules` y reinstala limpio.

## Instalar todo (opción 6 · `bash termux.sh --install`)

Deja el bot funcionando de una sola vez, sin comandos manuales:

1. **Paquetes del sistema** con `pkg` (solo lo que falte): `nodejs-lts`,
   `ffmpeg` (stickers y audio), `imagemagick` (stickers), `git`,
   `python`, `make`, `clang` y `pkg-config` (para compilar deps nativas).
2. **Paquetes npm** del bot (`npm install`).
3. **Ajuste de sharp** para Android (`npm run fix:sharp`), para que los
   plugins de imagen (ocr, stickers, hd…) no fallen.
4. **Verificación final**: ffmpeg, ImageMagick y Baileys; si algo falta
   te dice qué y por qué importa.

También se instala solo lo que falte al elegir `1` (Iniciar bot) si el
bot está marcado como `● sin instalar`.

## Vincular WhatsApp

### Opción A · Pairing Code (recomendado si el QR no te enfoca)

1. Menú → `3` → elige el bot.
2. Escribe tu número **con código de país, sin `+`** (ej. `59899123456`).
   La terminal lo recuerda para la próxima vez.
3. Copia el código de 8 dígitos que aparece (`XXXX-XXXX`).
4. En WhatsApp: `⋮ → Dispositivos vinculados → Vincular con número` y pégalo.

### Opción B · QR

1. Menú → `4` → elige el bot.
2. Escanea el QR que sale en la terminal con
   `WhatsApp → ⋮ → Dispositivos vinculados → Vincular dispositivo`.

La terminal le pasa el método y el número al bot automáticamente, así el bot
**no vuelve a preguntar** `qr o code`. Si la sesión ya está vinculada, el bot
arranca directo sin pedir nada.

## Elegir qué bot

La terminal **detecta sola** todos los bots en `bots/` (los que tengan
`package.json` + `main.js`/`index.js` o script `start`) y muestra su estado:

- `● listo` → instalado y configurado, a iniciar.
- `● sin config` → falta `npm run setup` (la terminal lo hace por ti).
- `● sin instalar` → falta `npm install` (la terminal lo instala al iniciar).

Con la opción `2` cambias el bot por defecto (se guarda en
`~/.multibot-terminal.conf`). Cada bot nuevo creado con
`bash scripts/create-bot.sh mi-bot` aparece solo en el menú.

## Personalizar Termux (opción 11)

Deja tu Termux con identidad MultiBot:

- Prompt con colores: `🤖 multibot ruta ❯`
- Banner de bienvenida al abrir Termux
- Alias: `multibot`, `mb`, `mb-qr`, `mb-code`

```bash
bash termux.sh --personalize
source ~/.bashrc   # o cierra y reabre Termux
```

Es idempotente: puedes ejecutarlo las veces que quieras sin duplicar nada.

## Personalizar el bot (opción 12 · 🎛)

Desde la terminal puedes editar la configuración del bot sin tocar código:

```text
  1) ✏️  Nombre del bot        7) ⚡ Comandos on/off
  2) 📦 Nombre de stickers     8) 📨 Reenviados on/off
  3) 👤 Autor de stickers      9) 💬 Responder como (estado/responder)
  4) 💰 Moneda                 10) 📋 Menú de lista on/off
  5) 🖼️  Banner                11) 🌍 Modo público on/off
  6) 👑 Owners/admins          12) 📄 Ver todo
```

- **Stickers**: nombre del pack y autor que llevan los stickers creados
  con `.s` (cada usuario puede poner los suyos con `.setmeta`).
- **Moneda**: la que muestran RPG, juegos y precios (ej. `UYU`, `USD`, `MXN`).
- **Banner**: imagen del `.menu`. Por defecto es el gato 🐱
  (`storage/img/banner-default.jpg`); puedes poner una imagen local o una URL,
  o restaurar el defecto cuando quieras. El bot usa tu banner sin reiniciar
  nada más (los cambios de config se recargan solos).
- **Owners/admins**: agregar o quitar owners (número + nombre) y admins/mods.
- **Comandos OFF**: el bot no responde comandos a nadie salvo al owner.
- **Modo público ON** (así viene): todos pueden usar el bot, en privado
  y en grupos sin alquiler. En OFF vuelve el modo cerrado (privado
  solo-owner y grupos con plan). Los comandos de owner/admin siguen
  protegidos en ambos modos.
- **Reenviados OFF**: los mensajes del bot dejan de verse como "reenviados".
- **Responder como**: `estado` = cita estilo estado de WhatsApp (como ahora) ·
  `responder` = cita normal de tu mensaje.
- **Menú de lista ON**: `.menu` envía foto + lista para elegir categoría
  (más compatible) en vez del menú interactivo.

Atajo directo: `bash termux.sh --customize` (o `--bot <id> --customize`).

> Los cambios se guardan en `bots/<id>/config.js` y el bot los toma al
> instante (observa el archivo). Si el bot está corriendo, verás
> `Update 'config.js'` y listo.

## Audios que suenan y fotos en álbum

- **Audios**: se corrigió el envío (antes algunos se etiquetaban con un
  formato inválido y no se escuchaban). Notas de voz en ogg/opus, audios
  normales en su formato original, y `.tag` conserva el formato citado.
- **Fotos juntas**: `.imagen`, `.pinterest`, descargas de TikTok e
  IG-search múltiple ahora llegan como **álbum** (leyenda en la primera,
  sin citas que lo rompan). Las búsquedas numeradas (cada foto con su
  texto) siguen por separado a propósito.

## Atajos directos (sin menú)

```bash
bash termux.sh --qr                    # QR con el bot por defecto
bash termux.sh --code 59899123456      # Pairing code directo
bash termux.sh --code                  # Reutiliza el último número
bash termux.sh --bot universal-bot --qr
bash termux.sh --list-bots             # Ver bots detectados
bash termux.sh --install               # Instala todo: sistema + npm + sharp
bash termux.sh --reinstall             # Reinstala limpio (borra node_modules)
bash termux.sh --doctor                # Diagnóstico
bash termux.sh --setup                 # Configurar owner/nombre
bash termux.sh --customize            # Personalizar bot (stickers, banner, owners…)
bash termux.sh --logout                # Borrar sesión (desvincular)
bash termux.sh --update                # git pull del repo
```

## Preguntas frecuentes

**¿Pide el número dos veces?**
No. La terminal lo pide una vez y se lo entrega al bot con
`MULTIBOT_LOGIN_METHOD` / `MULTIBOT_LOGIN_PHONE`. Solo si el número guardado
es inválido el bot lo vuelve a pedir.

**¿Cómo cambio de número?**
Inicia con `bash termux.sh --code <nuevo-número>` o elige la opción `3`
y escribe el nuevo número (reemplaza al guardado).

**¿Cómo desvinculo y vinculo otra cuenta?**
Opción `9` (borrar sesión) y luego `3` o `4`.

**¿Funciona fuera de Termux (PC)?**
El menú funciona en cualquier bash para desarrollo; al iniciar exporta
`ALLOW_NON_TERMUX=1` automáticamente si no detecta Termux. En producción el
bot está pensado para Termux o el runtime web autorizado.
