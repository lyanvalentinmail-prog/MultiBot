# 📱 Universal Bot — Termux

Solo Termux. Solo Baileys. Solo limpio.

## Instalación rápida

```bash
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg imagemagick python -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
npm install
cp config.example.js config.js
nano config.js
npm start
```

Elige `code` (pairing) o `qr`.

## Guard

`lib/termux-guard.js` bloquea ejecución fuera de Termux. Si ves:

```
✖ ESTE BOT SOLO PUEDE EJECUTARSE EN TERMUX
```

Estás en PC/VPS. Para dev usa `ALLOW_NON_TERMUX=1 npm start`, pero prod es Termux.

## Pairing Code

```
code
Ingresa el número: 521XXXXXXXXXX
Tu código de emparejamiento es: XXXX-XXXX
```

WhatsApp > ⋮ > Dispositivos vinculados > Vincular dispositivo > Vincular con número de teléfono > pega código.

## QR

```
qr
Generando código QR, escanéalo con tu WhatsApp...
[QR en terminal]
```

Escanea con WhatsApp > Dispositivos vinculados.

## Mantener vivo

```bash
pkg install screen -y
screen -S universal
npm start
# Ctrl+A, D para detach
# screen -r universal para volver

# o pm2
npm i -g pm2
pm2 start index.js --name universal
pm2 save
pm2 logs
```

## Troubleshooting

**sharp error**
```bash
npm run fix:sharp
# o
pkg install libjpeg-turbo libpng
npm install --include=optional sharp
```

**Sesión expirada**
```bash
rm -rf sessions
npm start
```

**No responde**
- Revisa `config.js` owner
- Revisa `sessions/creds.json` existe
- `adb logcat` si es necesario

---

Más: `../../docs/TERMUX_GUIDE.md`
