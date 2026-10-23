# ➕ Cómo añadir un bot

Cada bot vive aislado en `bots/<id>`. El catálogo web lo detecta al cargar la API si encuentra un `package.json` válido; no es necesario registrarlo en un archivo central. El panel **no ejecuta** el bot ni administra sus sesiones de WhatsApp.

> Universal Bot debe permanecer exclusivo de Termux. Pairing Code y QR se generan desde el flujo de inicio del bot en Termux. No subir credenciales ni contenido NSFW/adulto/+18.

## Método rápido

```bash
# Desde la raíz del repositorio
bash scripts/create-bot.sh mi-bot
cd bots/mi-bot
cp config.example.js config.js
nano config.js
npm install
npm start
```

El script copia `_template`, actualiza el nombre de `package.json` y prepara las carpetas locales. `config.js`, sesiones y bases mutables deben permanecer sin seguimiento en Git.

## Método manual

```bash
cp -r bots/_template bots/mi-bot
cd bots/mi-bot
cp config.example.js config.js
```

También se puede crear una carpeta nueva, siempre con `package.json` y un entrypoint funcional. Evita copiar las credenciales, `sessions/`, bases de datos y temporales de otro bot.

## Metadatos opcionales para el catálogo

Agrega `bots/mi-bot/bot.json` para controlar el nombre y las capacidades mostradas. El manifiesto se carga en cada solicitud, sin reiniciar el catálogo:

```json
{
  "id": "mi-bot",
  "name": "Mi Bot",
  "description": "Descripción breve, apta para todo público",
  "executionMode": "termux",
  "webRuntime": false,
  "supportsPairingCode": true,
  "supportsQr": true,
  "adultContent": false,
  "defaultPrefix": ".",
  "features": ["Moderación", "Stickers"]
}
```

`id` debe coincidir con el nombre de la carpeta. `executionMode: "termux"` o `lib/termux-guard.js` marca el bot como Termux-only. La web fuerza `webRuntime: false` para bots Termux-only. Cualquier bot que declare `adultContent: true` queda fuera del catálogo público.

Declarar `webRuntime: true` solo describe un runtime web real; no hace que el panel lo ejecute. Los perfiles guardados por usuarios son metadatos de configuración y nunca se muestran como bots conectados.

## Checklist

- [ ] Carpeta `bots/<id>` con nombre único y sin espacios.
- [ ] `package.json` y entrypoint válidos.
- [ ] `config.example.js` sin secretos; configuración privada ignorada por Git.
- [ ] `sessions/`, `tmp/` y bases locales ignorados por Git.
- [ ] Pairing Code/QR probados en el entorno real de ejecución (Termux para Universal Bot).
- [ ] Sin contenido NSFW/adulto/+18.
- [ ] `bot.json` con metadatos seguros para el catálogo (recomendado).
- [ ] Guía agregada a `bots/README.md`.
- [ ] `npm test` ejecutado desde la raíz para probar el portal.

Consulta [`STRUCTURE.md`](STRUCTURE.md) y [`WEB.md`](WEB.md) para la estructura del portal y el despliegue.
