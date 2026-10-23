# 🌐 MultiBot Web

Panel responsive/PWA con la línea visual adaptada de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka). Descubre bots de `bots/` y despliega Universal Bot como proceso dentro del servicio web para vincular WhatsApp con **Pairing Code** (te pide tu número) o **QR**.

> **Universal Bot admite dos modos:** Termux y runtime web. En web, Pairing Code/QR son los reales que entrega Baileys. El control se limita a la **cuenta propietaria** (o a una allowlist opcional) y a **un proceso simultáneo** para respetar Render Free. No se ofrece garantía 24/7.

## Cómo funciona el acceso

- El runtime web viene **habilitado por defecto**; no hace falta configurar ningún email antes de desplegar.
- La **primera cuenta creada** en el panel queda como **propietaria** del runtime. Esa cuenta puede iniciar/detener el bot y ver el QR o el Pairing Code.
- Las demás cuentas pueden registrarse, ver el catálogo y guardar favoritos, pero no controlar el proceso.
- Si prefieres una allowlist explícita, define `WEB_RUNTIME_ADMIN_EMAILS` (separa emails con comas). Cuando esa variable tiene valor, **reemplaza** al modo propietario.
- `WEB_RUNTIME_OWNER_EMAIL` permite fijar el email propietario en lugar de usar la primera cuenta (útil si la base se recrea).
- `WEB_RUNTIME_ENABLED=false` desactiva por completo los controles de proceso.

## Funciones

- Catálogo y plugins descubiertos desde `bots/*`.
- Cuenta del panel en PostgreSQL o JSON local. La interfaz **Crear bot** no crea perfiles de configuración.
- Inicio/parada de procesos para bots que declaran `webRuntime: true` y un entrypoint web.
- Selector de método de vinculación: **Pairing Code** (pide número internacional) o **QR**.
- Presentación privada del QR o Pairing Code real, estado del proceso y registro reciente del runtime.
- Enlace a la guía Termux como alternativa.

## Desarrollo local

```bash
npm ci
npm ci --prefix bots/universal-bot --omit=dev
npm start
```

Abre `http://localhost:3000`, crea la primera cuenta y entra en **Crear bot**. No necesitas variables para probar el runtime; si no defines `DATABASE_URL`, el panel usa `data/multibot-local.json`. El proceso del bot debe poder acceder a Internet para conectar con WhatsApp.

## Render Free

El [`render.yaml`](../render.yaml) configura:

- `multibot-panel`: servicio web Node en plan **Free**. Instala las dependencias de la web y de Universal Bot.
- `multibot-db`: PostgreSQL en plan **Free**, conectado mediante `DATABASE_URL`.
- `WEB_RUNTIME_ENABLED=true` (ya es el valor por defecto) y sin allowlist obligatoria.

En Render: **New → Blueprint → selecciona el repositorio/rama MultiBot → Apply**. Cuando el servicio esté disponible:

1. Abre la URL y pulsa **Crear cuenta**. Esa primera cuenta queda como propietaria.
2. Entra en **Crear bot** y elige el método:
   - **Pairing Code real**: escribe tu **número de WhatsApp con código de país** (sin `+`, por ejemplo `59899123456`).
   - **Código QR real**: se muestra la imagen; escanéala desde WhatsApp.
3. Pulsa **Desplegar bot y vincular**. El proceso arranca dentro del servicio web ya desplegado; el panel muestra el código real que entrega Baileys.

Si necesitas autorizar otra cuenta, agrega su email a `WEB_RUNTIME_ADMIN_EMAILS` y reinicia el servicio. La API bloquea registrar una cuenta cuyo email ya esté en la allowlist antes de que exista, para evitar apropiaciones. El registro es abierto y no verifica la propiedad del email: sé el primero en crear la cuenta propietaria en tu deploy.

**Costos y límites aceptados:** el blueprint mantiene servicio web y base de datos en Free; no cambies a planes pagos. El web service Free tiene 512 MB de RAM y 0.1 CPU; el panel y Universal Bot comparten esos recursos, así que plugins de IA/OCR u otras tareas pesadas pueden quedarse sin memoria o tardar demasiado. Render Free puede suspender el servicio cuando está inactivo, reiniciarlo o desplegar una nueva versión. Los procesos de bots se detendrán en esos ciclos y la sesión de Baileys podría perderse. El filesystem de la instancia web es efímero: las credenciales se guardan localmente bajo `bots/universal-bot/sessions/`, no en PostgreSQL ni en un disco persistente. No se garantiza 24/7.

PostgreSQL Free de Render vence a los **30 días**; exporta o migra tus cuentas antes del vencimiento. Esta base de datos guarda datos del panel, nunca credenciales Baileys. Si la base se elimina, la primera cuenta que crees en el panel nuevo vuelve a ser la propietaria. No se requiere ni se configura disco persistente.

### Variables de entorno

| Variable | Uso |
|---|---|
| `PORT` | Lo asigna Render; localmente el valor predeterminado es `3000`. |
| `DATABASE_URL` | Conexión PostgreSQL provista por el Blueprint. Sin ella se usa JSON local. |
| `PGSSL` | `true` solo si el proveedor PostgreSQL requiere TLS. |
| `WEB_RUNTIME_ENABLED` | `true` por defecto. `false` desactiva los endpoints de runtime. |
| `WEB_RUNTIME_OWNER_EMAIL` | Opcional. Fija el email propietario en lugar de usar la primera cuenta. |
| `WEB_RUNTIME_ADMIN_EMAILS` | Opcional. Allowlist separada por coma/punto y coma de cuentas autorizadas; reemplaza el modo propietario. |
| `BOT_UNIVERSAL_BOT_OWNER_PHONE` | Número administrador del bot, opcional, con código de país y sin `+`. Distinto del número ingresado para Pairing Code. |
| `BOT_UNIVERSAL_BOT_OWNER_NAME` | Nombre visible del propietario del bot, opcional. |
| `BOT_UNIVERSAL_BOT_OWNER_LID` | LID del propietario, opcional. |
| `BOT_UNIVERSAL_BOT_API_<PROVEEDOR>_KEY` | Claves opcionales de APIs externas, por ejemplo `...API_VREDEN_KEY`. No las publiques ni las guardes en Git. |

Las variables `BOT_UNIVERSAL_BOT_*` se pasan solo al proceso hijo de Universal Bot. `config.js` sigue ignorado por Git; en un deploy limpio se carga la configuración de ejemplo y se aplican esos valores de entorno. Sin propietario/API keys opcionales, ciertas funciones pueden requerir configuración adicional o quedar limitadas.

## Iniciar desde la web

1. Despliega el Blueprint y abre la URL del servicio.
2. Crea la primera cuenta del panel (queda como propietaria). Si ya tenías cuenta, inicia sesión con ella.
3. Abre **Crear bot** y selecciona Universal Bot.
4. Elige **Pairing Code real** o **Código QR real**:
   - Pairing Code: escribe tu número internacional. El panel lo envía al runtime para solicitar el código y no lo guarda.
   - QR: no necesitas escribir el número.
5. Pulsa **Desplegar bot y vincular**. Esto inicia Universal Bot como proceso dentro del servicio web ya desplegado; no crea otro servicio de Render. El panel muestra el Pairing Code o QR real que llega desde Baileys. Escanea el QR o introduce el código en WhatsApp → Dispositivos vinculados.
6. Cuando se vincule, el panel indicará el estado conectado. Usa **Detener** para cerrar el proceso. Solo se permite un runtime a la vez.

Si el código caduca o la conexión se reinicia, el bot vuelve a solicitar un Pairing Code con el mismo número y el panel se actualiza. Si WhatsApp cierra la sesión (logout o sesión inválida), el runtime borra las credenciales efímeras y se detiene: vuelve a pulsar **Desplegar bot y vincular** para generar un código nuevo. Para reintentar manualmente en cualquier caso: **Detener** y **Desplegar bot y vincular** de nuevo.

El QR, Pairing Code y logs son información sensible: solo la cuenta propietaria (o las cuentas allowlisted) deben tener acceso. No compartas capturas/códigos. La cuenta del panel y el teléfono de pairing son conceptos distintos. La interfaz no inventa códigos: el código mostrado proviene del proceso Baileys.

El runtime ejecuta `bots/universal-bot/main.js` directamente (no el wrapper `index.js` de cluster), para mantener un único proceso administrable. El guard del bot permite este modo solo con las dos variables de protocolo internas que el servidor añade al entorno hijo; no actives manualmente esas variables en un servicio distinto.

## Datos y privacidad

- PostgreSQL/JSON guarda cuentas del panel, hash scrypt de contraseñas, hash del token de sesión y datos heredados creados a través de la API de instancias. La interfaz **Crear bot** no crea perfiles.
- El teléfono de Pairing Code se envía al proceso del bot para solicitar el código; no se guarda en la base de datos, no se devuelve en el estado y se oculta en los logs.
- QR y Pairing Code se mantienen temporalmente en memoria del proceso web y solo se devuelven a la cuenta propietaria o allowlisted.
- Las credenciales de Baileys se escriben en el filesystem efímero del servicio web. Render puede borrarlas al suspender, reiniciar o desplegar; no hay promesa de conservación.
- Los logs visibles a la cuenta propietaria se limitan y filtran; no contienen la carga del evento QR/Pairing Code.
- Las sesiones de usuario del panel duran 30 días; aún no hay verificación de email ni recuperación de contraseña. Usa una contraseña única.

## API

`GET /api/endpoints` publica la referencia. Las rutas de runtime requieren `Authorization: Bearer <token-de-sesión>` y que la cuenta sea la propietaria (o esté en `WEB_RUNTIME_ADMIN_EMAILS`).

| Método | Ruta | Auth | Uso |
|---|---|---:|---|
| GET | `/api/health` | No | Salud web/base de datos. |
| GET | `/api/state` | Opcional | Catálogo y datos heredados de instancias propias. |
| GET | `/api/system` | No | Métricas del proceso web, base y catálogo. |
| GET | `/api/bots` | No | Lista bots del repositorio. |
| GET | `/api/bots/:id` | No | Detalles y plugins. |
| GET | `/api/plugins?botId=universal-bot` | No | Catálogo de plugins. |
| GET | `/api/runtime` | Propietario | Estado y, si está esperando vinculación, QR/código del runtime. |
| POST | `/api/bots/:id/runtime/start` | Propietario | `{ "method": "qr" }` o `{ "method": "pairing-code", "phoneNumber": "59899123456" }`. |
| POST | `/api/bots/:id/runtime/stop` | Propietario | Detiene el proceso administrado. |
| POST | `/api/auth/register` | No | Crea cuenta e inicia sesión. |
| POST | `/api/auth/login` | No | Inicia sesión. |
| POST | `/api/auth/logout` | Sí | Revoca la sesión actual. |
| GET | `/api/auth/me` | Sí | Devuelve la cuenta actual. |
| GET/POST | `/api/instances` | Sí | API heredada de configuraciones; no forma parte del flujo web Crear bot. |
| GET/PATCH/DELETE | `/api/instances/:id` | Sí | API heredada para configuraciones propias. |

Las rutas `/api/instances` se conservan por compatibilidad con datos/clientes anteriores; no inician procesos ni las usa la interfaz de creación. Para conectar WhatsApp, usa **Crear bot** o los endpoints de runtime. Las rutas antiguas `/api/instances/:id/pairing` y `/qr` no inician un bot.

## Atribución

La interfaz se adaptó de TomiOka; conserva la atribución y licencia en [`web/THIRD_PARTY_NOTICES.md`](../web/THIRD_PARTY_NOTICES.md) y [`web/LICENSE-TOMIOKA.txt`](../web/LICENSE-TOMIOKA.txt). Las fuentes locales conservan sus avisos OFL en `web/fonts/OFL.txt`.
