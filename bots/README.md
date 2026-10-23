# 🤖 Bots

Cada bot vive en su **propia carpeta** dentro de `bots/` con todos sus componentes aislados.

## 📁 Estructura

```
bots/
├── _template/            # Plantilla vacía para nuevos bots
├── universal-bot/        # Bot todo-en-uno (Termux only, sin NSFW)
│   ├── config.js
│   ├── index.js / main.js
│   ├── handler.js
│   ├── lib/              # Modos, Antis, helpers
│   ├── plugins/          # Comandos
│   ├── storage/          # DB + imágenes
│   ├── sessions/         # Creds Baileys (no se commitea)
│   ├── scripts/
│   └── docs/TERMUX.md
└── tu-nuevo-bot/         # Futuro bot
```

## 🔑 Aislamiento

- **DB propia**: cada bot tiene `storage/databases/database.json` separado
- **Sessions propia**: `sessions/` con `creds.json` (QR/pairing)
- **Plugins propios**: puedes activar/desactivar por bot
- **Config propia**: `config.js` con owners/prefijos por bot

## ➕ Crear un nuevo bot

### Opción A: script

```bash
bash ../../scripts/create-bot.sh nombre-del-bot
```

### Opción B: manual

```bash
cp -r _template mi-bot
cd mi-bot
npm install
cp config.example.js config.js
nano config.js
npm start
```

Ver guía completa en [`/docs/ADD_NEW_BOT.md`](../../docs/ADD_NEW_BOT.md)

## 📋 Lista

| Carpeta | Bot | Descripción | Estado |
|---------|-----|-------------|--------|
| `universal-bot` | Universal Bot | Todo-en-uno, 200+ plugins, sin +18, solo Termux | ✅ |
| `_template` | Template | Base limpia para clonar | 📦 |

## 🌐 Termux & Baileys

Todos los bots usan **Baileys** con **pairing code** y **QR code** para login:

```
¿Cómo deseas iniciar sesión?
Escribe "qr" para escanear el código QR o "code" para usar un código de 8 dígitos:
```

En Termux: `pkg install git nodejs && npm install && npm start`

## 🚦 Web

Próximamente la carpeta [`/web`](../../web/) permitirá gestionar todos estos bots desde el navegador, pero cada bot seguirá funcionando independientemente por Termux.
