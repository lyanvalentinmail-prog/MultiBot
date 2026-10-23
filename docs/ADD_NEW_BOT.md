# ➕ Cómo añadir un nuevo bot

Cada bot está en `bots/<nombre>` aislado.

## Método rápido (script)

```bash
# Desde la raíz del repo
bash scripts/create-bot.sh mi-bot

# Ejemplo:
bash scripts/create-bot.sh ventas-bot
```

Esto:

1. Copia `bots/_template` → `bots/mi-bot`
2. Inicializa `package.json` con nombre nuevo
3. Crea `config.example.js` base
4. Hace `npm install` opcional

Luego:

```bash
cd bots/mi-bot
cp config.example.js config.js
nano config.js
npm start
```

## Método manual

```bash
cp -r bots/_template bots/mi-bot
# o si no existe template, copia universal-bot y limpia:
cp -r bots/universal-bot bots/mi-bot
rm -rf bots/mi-bot/sessions bots/mi-bot/storage/databases/database.json bots/mi-bot/tmp
```

Edita:

- `bots/mi-bot/package.json` → cambia `name` y `description`
- `bots/mi-bot/config.js` → cambia `global.namebot`, `global.owner`

## Estructura mínima de un bot

```
bots/mi-bot/
├── config.example.js
├── config.js          # no commitear, solo example
├── index.js           # launcher cluster
├── main.js            # conexión Baileys + login
├── handler.js         # router
├── package.json
├── lib/
│   └── termux-guard.js  # opcional, quita si quieres permitir VPS
├── plugins/           # tus comandos
├── storage/
│   ├── databases/
│   └── img/
├── sessions/          # gitignored
├── scripts/
└── docs/
```

## Compartir código entre bots

Opciones:

- **Duplicar**: cada bot copia plugins que necesita (más simple, aislamiento).
- **Lib shared**: crea `lib/shared/` en raíz y symlink o importa con `../../lib/shared/...`.

Recomendado: duplicar para mantener aislamiento.

## Web: ¿cada bot necesita soporte web?

No. La futura `web/` leerá todos los `bots/*` automáticamente. Solo asegúrate que cada bot tenga:

- `package.json` con `name` único
- `sessions/` separado (no compartir creds)

## Checklist nuevo bot

- [ ] Carpeta en `bots/<nombre>` sin espacios
- [ ] `package.json` name único
- [ ] `config.js` con owner correcto
- [ ] `sessions/` gitignored
- [ ] Probado `npm start` → QR/code funciona
- [ ] Documentado en `bots/README.md`
- [ ] Si es solo Termux, deja `lib/termux-guard.js`; si no, elimínalo

## Ejemplo: bot minimal

```js
// plugins/ping.js
let handler = async (m, { conn }) => {
  await conn.sendMessage(m.chat, { text: '🏓 Pong!' }, { quoted: m })
}
handler.command = ['ping', 'p']
export default handler
```

¡Listo! `npm start` y prueba `.ping` en WhatsApp.
