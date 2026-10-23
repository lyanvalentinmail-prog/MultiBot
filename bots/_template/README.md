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
├── config.example.js
├── index.js
├── main.js
├── handler.js
├── package.json
├── lib/
│   └── termux-guard.js (opcional)
├── plugins/
│   └── ping.js (ejemplo)
├── storage/
├── sessions/  (gitignored)
└── scripts/
```

Esta plantilla es **ligera** (sin 200 plugins). Copia plugins desde `universal-bot` si los necesitas:

```bash
cp ../universal-bot/plugins/sticker*.js plugins/
cp ../universal-bot/lib/menu-categories.js lib/
```

## Personaliza

- `config.example.js` → cambia nombre, owner, prefijo
- `plugins/` → añade tus comandos
- `lib/termux-guard.js` → elimina si quieres VPS, deja si solo Termux
