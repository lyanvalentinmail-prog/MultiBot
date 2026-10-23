# 📱 Guía Termux — Universal Bot

> Esta guía es para **Universal Bot** (`bots/universal-bot`) que solo corre en **Termux**.
> ¿Quieres lo fácil? Usa la **terminal personalizada**: desde la raíz del repo
> ejecuta `bash termux.sh` — menú para elegir bot, pedir Pairing Code o QR,
> configurar e instalar todo. Detalles en [`TERMUX_TERMINAL.md`](TERMUX_TERMINAL.md).

## Requisitos

- Android 7.0+
- Termux instalado desde **F-Droid** (no Play Store, está desactualizado)
  - https://f-droid.org/es/packages/com.termux/
- ~1GB libre

## Instalación paso a paso

### 1. Preparar Termux

```bash
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg imagemagick python -y
node -v   # debe ser >=18
npm -v
```

Si `sharp` falla:

```bash
pkg install libjpeg-turbo libpng
npm run fix:sharp
```

### 2. Clonar repo

```bash
cd ~
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
```

### 3. Instalar dependencias

```bash
npm install
```

Espera 2-5 min en móviles lentos.

### 4. Configurar (sin nano)

```bash
npm run setup
```

El asistente pregunta:

```text
Tu número de WhatsApp con código de país (ej. 59899123456): 59899123456
Tu nombre (para comandos de owner) [MultiBot Owner]: TuNombre
Tu LID (opcional, Enter para omitir):
JID del canal newsletter (opcional, Enter para omitir):
```

Escribe `config.js` con `global.owner` y `global.ownerLid` correctos y guarda tu archivo anterior en
`config.js.bak`. No interactivo:

```bash
npm run setup -- --owner 59899123456 --name TuNombre --yes
```

> El LID lo obtienes con `.id` en privado del bot después del primer inicio; puedes añadirlo luego
> ejecutando `npm run setup` otra vez.

### 4b. Verificar antes de arrancar

```bash
npm run doctor      # Node, dependencias, config.js, sesión y carpeta
npm run check:config
```

### 5. Iniciar

```bash
npm start
```

Verás:

```
¿Cómo deseas iniciar sesión?
Escribe "qr" para escanear el código QR o "code" para usar un código de 8 dígitos:
```

- Escribe `qr` → aparece QR en terminal → escanea desde WhatsApp > Dispositivos vinculados
- Escribe `code` → pide tu número → te da código `XXXX-XXXX` → WhatsApp > Vincular con número

¡Listo! `Conectado correctamente.`

### 6. Mantener vivo

En Termux, usa `screen` o deja Termux en segundo plano:

```bash
pkg install screen -y
screen -S bot
npm start
# para salir sin matar: Ctrl+A, D
# para volver: screen -r bot
```

O usa `pm2`:

```bash
npm install -g pm2
pm2 start index.js --name universal
pm2 save
pm2 logs
```

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia con check sharp + cluster |
| `npm run setup` | Asistente de `config.js` (número, nombre, LID) |
| `npm run setup -- --fix` | Repara texto de shell pegado en `config.js` |
| `npm run doctor` | Diagnóstico completo para Termux |
| `npm run check:config` | Valida solo `config.js` |
| `npm run start:raw` | Inicia sin check sharp |
| `ALLOW_NON_TERMUX=1 npm start` | Bypass guard (solo dev) |
| `npm run fix:sharp` | Repara sharp |

## Pairing Code vs QR

- **Pairing Code**: más rápido, no necesita cámara. Recomendado en Termux.
- **QR**: clásico, scan con otro móvil.

Ambos usan Baileys `useMultiFileAuthState` en `sessions/`.

## Troubleshooting

**`SyntaxError: Unexpected identifier 'start'` en `config.js`**

Síntoma exacto:

```text
file:///data/data/com.termux/files/home/MultiBot/bots/universal-bot/config.js:1
npm start/* Universal Bot — MultiBot
    ^^^^^
SyntaxError: Unexpected identifier 'start'
```

Causa: se pegó `npm start` (u otro comando de Termux) dentro de `nano config.js` antes del
comentario. Arreglo:

```bash
npm run setup -- --fix   # quita el ruido de shell y conserva tu configuración
# o, si prefieres empezar de cero:
rm config.js && npm run setup
```

El bot también lo detecta al arrancar: repara el archivo si solo era ruido de shell, deja
`config.js.bak`, y si el archivo está irrecuperable arranca con `config.example.js` mostrando el
error en vez de repetirlo en bucle.

**`sharp` error / android-arm64**
```bash
node scripts/ensure-sharp.js
npm install --include=optional sharp
```

**Sesión cerrada**
```bash
rm -rf sessions
npm start  # re-loguea
```

**Bot no responde**
- Ejecuta `npm run doctor` para revisar Node, dependencias, config, sesión y carpeta
- Verifica `sessions/creds.json` existe
- Revisa `config.js` owner
- Mira logs de Termux

**Guard de ejecución**
El inicio normal funciona en Termux. La web puede arrancar el proceso solo cuando MultiBot lo autoriza con sus variables internas; no las configures manualmente en otro servicio. `ALLOW_NON_TERMUX=1` sigue siendo un bypass únicamente para desarrollo.

## Storage

- `sessions/` → no borrar si quieres mantener login
- `storage/databases/database.json` → DB usuarios/chats
- `tmp/` → archivos temporales auto-limpiados cada 3min

Todo `sessions`, `database.json` y `tmp` está en `.gitignore`.

---

Hecho para Termux 💙 — cualquier duda abre issue en GitHub.
