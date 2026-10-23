# 📱 Universal Bot — Guía Termux

Esta guía explica el inicio en Termux. Universal Bot también dispone de un runtime web de MultiBot protegido por allowlist; revisa [`../../../docs/WEB.md`](../../../docs/WEB.md) para Render Free.

## Instalación rápida

```bash
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg imagemagick python -y
git clone https://github.com/lyanvalentinmail-prog/MultiBot.git
cd MultiBot/bots/universal-bot
npm install
npm run setup        # asistente: escribe config.js con tu número (sin nano)
npm start            # elige code (pairing) o qr
```

`npm run setup` reemplaza a `cp config.example.js config.js && nano config.js`: pregunta tu
número con código de país y guarda `config.js` correctamente. Si prefieres no interactivo:

```bash
npm run setup -- --owner 59899123456 --name TuNombre --yes
```

`npm run setup` también sirve después para cambiar el número o las API keys sin tocar el editor.
Antes de arrancar puedes comprobar todo con `npm run doctor`.

## Guard

`lib/termux-guard.js` permite Termux y el modo web explícitamente autorizado por el process manager de MultiBot. En otros entornos el inicio se bloquea. `ALLOW_NON_TERMUX=1 npm start` es solo un bypass de desarrollo.

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

**`SyntaxError: Unexpected identifier 'start'` en `config.js`**

Pasó al pegar `npm start` dentro de `nano config.js`. El mensaje típico es:

```
config.js:1
npm start/* Universal Bot — MultiBot
    ^^^^^
SyntaxError: Unexpected identifier 'start'
```

Soluciones (de la más rápida a la manual):

```bash
npm run setup -- --fix     # elimina el texto de shell pegado y conserva el resto
npm run setup              # o reescribe config.js preguntándote tu número
rm config.js && npm run setup
```

Desde la v1.1 el bot detecta ese archivo roto al arrancar, lo repara solo si solo era ruido
de shell (deja copia en `config.js.bak`) y, si no puede, usa `config.example.js` avisando
en pantalla en lugar de entrar en un bucle de errores.

**El bot no arranca / reinicia en bucle**
```bash
npm run doctor    # Node, dependencias, config.js, sesión y carpeta
```
El reinicio automático se detiene tras 4 fallos seguidos y muestra el diagnóstico.

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
