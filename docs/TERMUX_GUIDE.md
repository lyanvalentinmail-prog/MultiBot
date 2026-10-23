# 📱 Guía Termux — Universal Bot

> Esta guía es para **Universal Bot** (`bots/universal-bot`) que solo corre en **Termux**.

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

### 4. Configurar

```bash
cp config.example.js config.js
nano config.js
```

Edita:

```js
global.owner = [
  ['521XXXXXXXXXX', 'TuNombre', true]  // tu número con código país
]
global.ownerLid = [
  ['TU_LID_AQUI', 'TuNombre', true]  // saca tu LID con .id en privado del bot
]
```

Guarda: `Ctrl+O`, `Enter`, `Ctrl+X`.

Opcional cambia:

```js
global.namebot = 'UNIVERSAL BOT'
global.moneda = 'USD'
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
| `npm run start:raw` | Inicia sin check sharp |
| `ALLOW_NON_TERMUX=1 npm start` | Bypass guard (solo dev) |
| `npm run fix:sharp` | Repara sharp |

## Pairing Code vs QR

- **Pairing Code**: más rápido, no necesita cámara. Recomendado en Termux.
- **QR**: clásico, scan con otro móvil.

Ambos usan Baileys `useMultiFileAuthState` en `sessions/`.

## Troubleshooting

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
- Verifica `sessions/creds.json` existe
- Revisa `config.js` owner
- Mira logs de Termux

**Guard: Solo Termux**
Si ves `✖ ESTE BOT SOLO PUEDE EJECUTARSE EN TERMUX` en PC, usa `ALLOW_NON_TERMUX=1 npm start` para dev, pero producción es Termux solo.

## Storage

- `sessions/` → no borrar si quieres mantener login
- `storage/databases/database.json` → DB usuarios/chats
- `tmp/` → archivos temporales auto-limpiados cada 3min

Todo `sessions`, `database.json` y `tmp` está en `.gitignore`.

---

Hecho para Termux 💙 — cualquier duda abre issue en GitHub.
