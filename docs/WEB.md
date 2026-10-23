# 🌐 MultiBot Web

Panel responsive/PWA con la línea visual adaptada de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka). Descubre los bots de `bots/`, administra perfiles y, cuando el manifiesto lo permite, controla un runtime web protegido.

> **Universal Bot admite dos modos:** Termux y runtime web autorizado. En web, Pairing Code/QR son los reales que entrega Baileys. El control está limitado a emails allowlisted y a **un proceso simultáneo** para respetar Render Free. No se ofrece garantía 24/7.

## Funciones

- Catálogo y plugins descubiertos desde `bots/*`.
- Cuentas del panel y perfiles guardados en PostgreSQL o JSON local.
- Inicio/parada de procesos únicamente para bots que declaran `webRuntime: true` y un entrypoint web.
- Presentación privada del QR o Pairing Code real, estado básico y registro reciente del runtime.
- Enlace a la guía Termux como alternativa.

## Desarrollo local

```bash
npm ci
npm ci --prefix bots/universal-bot --omit=dev
WEB_RUNTIME_ENABLED=true WEB_RUNTIME_ADMIN_EMAILS=tu-email@example.com npm start
```

Abre `http://localhost:3000`, crea una cuenta con ese email y entra al detalle de Universal Bot. Si no defines `DATABASE_URL`, el panel usa `data/multibot-local.json`. El servidor Node no carga `.env` por sí solo; exporta las variables en la terminal o usa una herramienta dotenv. El proceso del bot debe poder acceder a Internet para conectar con WhatsApp.

## Render Free

El [`render.yaml`](../render.yaml) configura:

- `multibot-panel`: servicio web Node en plan **Free**. Instala las dependencias de la web y de Universal Bot.
- `multibot-db`: PostgreSQL en plan **Free**, conectado mediante `DATABASE_URL`.
- `WEB_RUNTIME_ENABLED=true` y `WEB_RUNTIME_ADMIN_EMAILS` para habilitar el runtime de forma restringida.

En Render: **New → Blueprint → selecciona el repositorio/rama MultiBot → Apply**. Durante el primer arranque, deja `WEB_RUNTIME_ADMIN_EMAILS` vacío. Crea la cuenta del panel con el email que quieres autorizar; después agrega ese email exacto en la variable de Render y reinicia/repliega el servicio. La API bloquea registrar una cuenta nueva cuyo email ya esté en la allowlist, para evitar apropiaciones del nombre de administrador. Puedes autorizar varios emails separados por coma. El registro es abierto y no verifica la propiedad del email: configura la allowlist solo después de crear tu cuenta. Una cuenta fuera de ella no puede consultar QR, Pairing Code, logs ni iniciar/detener procesos.

**Costos y límites aceptados:** el blueprint mantiene servicio web y base de datos en Free; no cambies a planes pagos. El web service Free tiene 512 MB de RAM y 0.1 CPU; el panel y Universal Bot comparten esos recursos, así que plugins de IA/OCR u otras tareas pesadas pueden quedarse sin memoria o tardar demasiado. Render Free puede suspender el servicio cuando está inactivo, reiniciarlo o desplegar una nueva versión. Los procesos de bots se detendrán en esos ciclos y la sesión de Baileys podría perderse. El filesystem de la instancia web es efímero: las credenciales se guardan localmente bajo `bots/universal-bot/sessions/`, no en PostgreSQL ni en un disco persistente. No se garantiza 24/7.

PostgreSQL Free de Render vence a los **30 días**; exporta o migra tus cuentas/perfiles antes del vencimiento. Esta base de datos guarda datos del panel, nunca credenciales Baileys. Si la base se elimina y debes recrear la cuenta administradora, vacía temporalmente `WEB_RUNTIME_ADMIN_EMAILS`, registra la cuenta, vuelve a configurar la allowlist y reinicia. No se requiere ni se configura disco persistente.

### Variables de entorno

| Variable | Uso |
|---|---|
| `PORT` | Lo asigna Render; localmente el valor predeterminado es `3000`. |
| `DATABASE_URL` | Conexión PostgreSQL provista por el Blueprint. Sin ella se usa JSON local. |
| `PGSSL` | `true` solo si el proveedor PostgreSQL requiere TLS. |
| `WEB_RUNTIME_ENABLED` | Debe ser `true` para habilitar los endpoints de runtime. Render Blueprint lo establece. |
| `WEB_RUNTIME_ADMIN_EMAILS` | Allowlist separada por coma/punto y coma/espacios de emails de cuentas del panel autorizadas. Obligatoria. |
| `BOT_UNIVERSAL_BOT_OWNER_PHONE` | Número administrador del bot, opcional, con código de país y sin `+`. Distinto del número ingresado para Pairing Code. |
| `BOT_UNIVERSAL_BOT_OWNER_NAME` | Nombre visible del propietario del bot, opcional. |
| `BOT_UNIVERSAL_BOT_OWNER_LID` | LID del propietario, opcional. |
| `BOT_UNIVERSAL_BOT_API_<PROVEEDOR>_KEY` | Claves opcionales de APIs externas, por ejemplo `...API_VREDEN_KEY`. No las publiques ni las guardes en Git. |

Las variables `BOT_UNIVERSAL_BOT_*` se pasan solo al proceso hijo de Universal Bot. `config.js` sigue ignorado por Git; en un deploy limpio se carga la configuración de ejemplo y se aplican esos valores de entorno. Sin propietario/API keys opcionales, ciertas funciones pueden requerir configuración adicional o quedar limitadas.

## Iniciar desde la web

1. Despliega el Blueprint y agrega el email de tu cuenta a `WEB_RUNTIME_ADMIN_EMAILS` en Render.
2. Entra al panel con esa cuenta y abre **Bots → Universal Bot → Ejecutar en la web**.
3. Selecciona **Código QR real** o **Pairing Code real**. Para pairing ingresa el número internacional que recibirá el código; no se guarda en el perfil.
4. Inicia el proceso. Escanea el QR o introduce el código en WhatsApp → Dispositivos vinculados. Cuando se vincule, el panel mostrará el estado conectado.
5. Pulsa **Detener** para cerrar el proceso. Solo se permite un runtime a la vez en esta versión.

El QR, Pairing Code y logs son información sensible: solo el email administrador configurado debe tener acceso. No compartas capturas/códigos. La cuenta administradora y el teléfono de pairing son conceptos distintos. La interfaz no inventa códigos: el código mostrado proviene del proceso Baileys.

El runtime ejecuta `bots/universal-bot/main.js` directamente (no el wrapper `index.js` de cluster), para mantener un único proceso administrable. El guard del bot permite este modo solo con las dos variables de protocolo internas que el servidor añade al entorno hijo; no actives manualmente esas variables en un servicio distinto.

## Datos y privacidad

- PostgreSQL/JSON guarda cuentas del panel, hash scrypt de contraseñas, hash del token de sesión y preferencias de perfiles.
- El teléfono de pairing se envía al endpoint protegido para solicitar un código; no se añade al perfil ni se devuelve en el estado.
- QR y Pairing Code se mantienen temporalmente en memoria del proceso web y solo se devuelven a una cuenta allowlisted.
- Las credenciales de Baileys se escriben en el filesystem efímero del servicio web. Render puede borrarlas al suspender, reiniciar o desplegar; no hay promesa de conservación.
- Los logs visibles al administrador se limitan y filtran; no contienen la carga del evento QR/Pairing Code.
- Las sesiones de usuario del panel duran 30 días; aún no hay verificación de email ni recuperación de contraseña. Usa una contraseña única.

## API

`GET /api/endpoints` publica la referencia. Las rutas de runtime requieren `Authorization: Bearer <token-de-sesión>` y que la cuenta esté en `WEB_RUNTIME_ADMIN_EMAILS`.

| Método | Ruta | Auth | Uso |
|---|---|---:|---|
| GET | `/api/health` | No | Salud web/base de datos. |
| GET | `/api/state` | Opcional | Catálogo y perfiles propios. |
| GET | `/api/system` | No | Métricas del proceso web, base y catálogo. |
| GET | `/api/bots` | No | Lista bots del repositorio. |
| GET | `/api/bots/:id` | No | Detalles y plugins. |
| GET | `/api/plugins?botId=universal-bot` | No | Catálogo de plugins. |
| GET | `/api/runtime` | Admin | Estado y, si está esperando vinculación, QR/código del runtime. |
| POST | `/api/bots/:id/runtime/start` | Admin | `{ "method": "qr" }` o `{ "method": "pairing-code", "phoneNumber": "598..." }`. |
| POST | `/api/bots/:id/runtime/stop` | Admin | Detiene el proceso administrado. |
| POST | `/api/auth/register` | No | Crea cuenta e inicia sesión. |
| POST | `/api/auth/login` | No | Inicia sesión. |
| POST | `/api/auth/logout` | Sí | Revoca la sesión actual. |
| GET | `/api/auth/me` | Sí | Devuelve la cuenta actual. |
| GET/POST | `/api/instances` | Sí | Lista/crea perfiles de configuración. |
| GET/PATCH/DELETE | `/api/instances/:id` | Sí | Lee/edita/elimina un perfil propio. |

Los perfiles son preferencias, no procesos. Las rutas antiguas `/api/instances/:id/pairing` y `/qr` no inician un bot; usa el endpoint del runtime asociado al id del bot.

## Atribución

La interfaz se adaptó de TomiOka; conserva la atribución y licencia en [`web/THIRD_PARTY_NOTICES.md`](../web/THIRD_PARTY_NOTICES.md) y [`web/LICENSE-TOMIOKA.txt`](../web/LICENSE-TOMIOKA.txt). Las fuentes locales conservan sus avisos OFL en `web/fonts/OFL.txt`.
