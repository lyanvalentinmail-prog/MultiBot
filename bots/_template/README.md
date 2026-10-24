# 🆕 Template Bot

Plantilla base para crear un nuevo bot en MultiBot.

## Uso

```bash
# Desde la raíz del repo
bash ../../scripts/create-bot.sh mi-nuevo-bot

# O manual:
cp -r _template ../mi-nuevo-bot
cd ../mi-nuevo-bot
npm install
cp config.example.js config.js
nano config.js
npm start
```

## Estructura mínima

```
_template/
├── config.example.js   # se copia a config.js (privado, gitignored) al configurar
├── index.js            # maestro cluster: vigila y reinicia main.js
├── main.js             # worker: Baileys, QR/pairing y carga de comandos
├── handler.js          # placeholder de lógica de mensajes
├── commands.json       # comandos de commands/ que usa este bot
├── package.json
├── lib/
│   ├── simple.js       # protoType/serialize/smsg mínimos y autocontenidos
│   └── termux-guard.js # exige Termux o el runtime web autorizado
├── storage/
└── sessions/           # gitignored
```

Esta plantilla es **ligera y arranca tal cual** tras `npm install` y crear
`config.js`. No aparece en el menú de Termux ni en el catálogo web (las
carpetas con prefijo `_` se ocultan); solo se usa como base al crear un bot.
El `simple.js` incluye utilidades mínimas sin módulos hermanos: si necesitas
el wrapper completo (`sendFile`, vista única, baileys dual…), copia las piezas
desde `universal-bot/lib/`:

```bash
cp ../universal-bot/lib/menu-categories.js lib/
```

## Personaliza

- `config.example.js` → cambia nombre, owner, prefijo
- `plugins/` → añade tus comandos
- `lib/termux-guard.js` → elimina si quieres VPS, deja si solo Termux
