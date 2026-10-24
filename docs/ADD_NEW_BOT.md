# ➕ Cómo añadir un bot

Cada bot vive aislado en `bots/<id>`. El catálogo web lo detecta cuando encuentra un `package.json` válido; un `bot.json` opcional declara nombre, seguridad y capacidades. Los bots sin runtime web siguen siendo solo catálogo y no pueden iniciarse desde el panel.

> No subir credenciales ni contenido NSFW/adulto/+18. Universal Bot puede ejecutarse desde Termux o, para una cuenta autorizada, desde el runtime web de Render Free. El disco del runtime es efímero.

## Método rápido

```bash
bash scripts/create-bot.sh mi-bot
cd bots/mi-bot
cp config.example.js config.js
nano config.js
npm install --omit=dev
(cd ../.. && npm install --omit=dev)  # dependencias de los módulos compartidos lib/ y commands/
npm start
```

El script copia `_template`, actualiza el nombre de `package.json` y prepara carpetas locales. Los bots también importan módulos compartidos desde `MultiBot/lib`, así que hay que instalar las dependencias en la raíz del repo además de las propias del bot. `config.js`, sesiones y bases mutables deben permanecer fuera de Git.

## Metadatos del catálogo

Agrega `bots/mi-bot/bot.json` para controlar el nombre y capacidades mostradas:

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

`id` debe coincidir con el nombre de la carpeta. `adultContent: true` excluye el bot del catálogo. `executionMode: "termux"` o `lib/termux-guard.js` lo marcan como Termux-only, salvo que el manifest declare explícitamente tanto `executionMode: "web"` como `webRuntime: true`.

## Requisitos para ejecutar desde web

`webRuntime: true` es una autorización para ejecutar código del repositorio en el mismo host que sirve el panel. Solo actívalo tras revisar sus implicancias de seguridad. El bot necesita:

1. Un `webEntrypoint` dentro de su propia carpeta (o un `package.json.main` seguro) que funcione como proceso hijo sin prompts por terminal.
2. Un contrato de eventos por stdout para el panel:
   - `MULTIBOT_RUNTIME_EVENT:{"type":"qr","value":"<QR real>"}`
   - `MULTIBOT_RUNTIME_EVENT:{"type":"pairing-code","value":"<código real>"}`
   - `MULTIBOT_RUNTIME_EVENT:{"type":"connected"}` / `{"type":"disconnected"}`
3. Sesiones y datos escritos solo a almacenamiento efímero, nunca a PostgreSQL ni al frontend.
4. Guard de ejecución que solo permita el modo web autorizado y sin exponer secretos en logs.
5. Declarar en el manifiesto `executionMode: "web"`, `webRuntime: true` y `webEntrypoint: "main.js"` (ajusta el punto de entrada según el bot).
6. Añadir la instalación de las dependencias del bot al `buildCommand` de `render.yaml`, con lockfile y sin cambiar el plan Free.
7. Pruebas de permisos, rutas, código sensible, parada de procesos y límites de memoria.

La versión actual permite un proceso de bot a la vez en Render Free. El servicio puede dormir/reiniciar, matar el proceso y borrar sesiones. No prometas 24/7 ni persistencia de credenciales.

## Checklist

- [ ] Carpeta `bots/<id>` con nombre único y `package.json`/entrypoint válidos.
- [ ] `config.example.js` sin secretos; configuración privada ignorada por Git.
- [ ] `sessions/`, `tmp/` y bases locales ignoradas por Git.
- [ ] `webRuntime` desactivado salvo implementación y autorización expresas.
- [ ] Pairing Code/QR probados en el entorno real (Termux o runtime web). Nunca inventar códigos.
- [ ] Sin contenido NSFW/adulto/+18.
- [ ] `bot.json` con metadatos seguros (recomendado).
- [ ] Dependencias web instaladas en `render.yaml` si aplica.
- [ ] `npm test` ejecutado desde la raíz.

Consulta [`STRUCTURE.md`](STRUCTURE.md) y [`WEB.md`](WEB.md) para estructura, permisos, API y límites del runtime.
