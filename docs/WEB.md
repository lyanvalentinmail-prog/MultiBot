# 🌐 MultiBot Web

Panel responsive/PWA con la línea visual de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka), adaptado al catálogo `bots/` de este repositorio. Lista bots, guarda perfiles de configuración, muestra la salud de la web/base de datos y documenta el despliegue correcto.

> **Límite importante:** Universal Bot sigue siendo **exclusivo de Termux**. El servidor web nunca inicia Baileys, nunca crea una sesión de WhatsApp y nunca guarda números, códigos de vinculación, QR ni credenciales. Pairing Code y QR siguen disponibles al iniciar el bot desde Termux.

## Funciones

- Landing, panel, catálogo/detalle de bots, navegador de plugins, métricas, referencia de API, guía Termux, favoritos, soporte y cuenta.
- Catálogo detectado desde `bots/*/package.json`, `bots/*/bot.json` (opcional) y `bots/*/plugins/`.
- Registro/inicio de sesión con hashes de contraseña scrypt y tokens de sesión opacos (30 días).
- Perfiles por cuenta: bot, nombre, prefijo y método preferido QR/Pairing Code; con alta, edición y eliminación.
- PostgreSQL mediante `DATABASE_URL` en Render, con archivo JSON atómico como alternativa local.
- PWA, fuentes locales, navegación adaptable, formularios accesibles y comprobación periódica del estado.

La web guarda un **perfil de despliegue**, no un bot de WhatsApp en ejecución. Para Universal Bot, el perfil ofrece instrucciones de Termux y conserva las preferencias elegidas en la base de datos del panel.

## Ejecutar localmente

```bash
npm ci
npm start
# http://localhost:3000
```

Sin `DATABASE_URL`, la persistencia local usa `data/multibot-local.json`. Para usar PostgreSQL local, define `DATABASE_URL` (y `PGSSL=true` solo si el proveedor requiere TLS). El servidor Node no carga archivos `.env` por sí solo; puedes exportar las variables en la terminal o usar una herramienta dotenv.

## Render Blueprint + PostgreSQL

El [`render.yaml`](../render.yaml) crea:

- `multibot-panel`: servicio web Node con health check en `/api/health`.
- `multibot-db`: base PostgreSQL. Render conecta automáticamente la cadena mediante `DATABASE_URL`.

En Render: **New → Blueprint → selecciona el repositorio/rama MultiBot → Apply**. El Blueprint configura tanto el servicio web como PostgreSQL en el plan **Free**, así que no debería crear recursos de pago ni pedirte elegir un plan pago. El servicio web Free puede suspenderse si queda inactivo. **Límite importante:** la base PostgreSQL Free de Render es temporal y vence a los 30 días; exporta tus datos antes de esa fecha. No actualices la base a un plan pago si no quieres cargos. No se requiere disco persistente.

Este Blueprint prioriza costo cero, no almacenamiento permanente. Si necesitas conservar los perfiles más de 30 días sin pagar, conecta `DATABASE_URL` a un proveedor PostgreSQL externo con plan gratuito y sus propios límites; Render no ofrece almacenamiento Postgres gratuito permanente en este Blueprint.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/lyanvalentinmail-prog/MultiBot)

### Variables de entorno

| Variable | Uso |
|---|---|
| `PORT` | Lo asigna Render; localmente el valor predeterminado es `3000`. |
| `DATABASE_URL` | Conexión PostgreSQL provista por el Blueprint. Sin ella localmente se usa JSON. |
| `MULTIBOT_DATA_DIR` | Ruta opcional para el almacén JSON local. |
| `PGSSL` | `true` solo si el proveedor PostgreSQL requiere TLS. |

El Blueprint no despliega Universal Bot. Mantén el bot ejecutándose en Termux, tal como exige su guard.

## Cuentas y datos almacenados

- Se guardan email, nombre de usuario, hash scrypt de contraseña, hash del token de sesión y metadatos del perfil.
- Cada perfil contiene nombre visible, id del bot, prefijo, método preferido y fechas.
- La web no solicita el número de WhatsApp ni almacena sesiones, QR o pairing codes.
- El registro de cuentas está abierto; cada cuenta solo puede consultar y modificar sus perfiles.
- Todavía no hay verificación de email ni recuperación de contraseña. Usa una contraseña única y protege tu cuenta.

## API

`GET /api/endpoints` devuelve la lista de rutas. Las principales son:

| Método | Ruta | Auth | Uso |
|---|---|---:|---|
| GET | `/api/health` | No | Salud del proceso web y base de datos. |
| GET | `/api/state` | Opcional | Catálogo y perfiles del usuario autenticado. |
| GET | `/api/system` | No | Métricas del proceso, memoria, base y catálogo. |
| GET | `/api/bots` | No | Lista los bots de `bots/`. |
| GET | `/api/bots/:id` | No | Detalles y plugins de un bot. |
| GET | `/api/plugins?botId=universal-bot` | No | Catálogo de archivos de plugins. |
| POST | `/api/auth/register` | No | Crea cuenta e inicia sesión. |
| POST | `/api/auth/login` | No | Inicia sesión. |
| POST | `/api/auth/logout` | Sí | Revoca la sesión actual. |
| GET | `/api/auth/me` | Sí | Devuelve la cuenta actual. |
| GET/POST | `/api/instances` | Sí | Lista/crea perfiles de despliegue. |
| GET/PATCH/DELETE | `/api/instances/:id` | Sí | Lee/edita/elimina un perfil propio. |

Las solicitudes autenticadas envían `Authorization: Bearer <token-de-sesión>`. Las acciones `/pairing` y `/qr` responden intencionalmente `409 TERMUX_ONLY`: no son endpoints de vinculación web.

## Atribución

El diseño y algunos assets de la interfaz se adaptaron de TomiOka; ver [`web/THIRD_PARTY_NOTICES.md`](../web/THIRD_PARTY_NOTICES.md). Las fuentes locales conservan sus avisos OFL en `web/fonts/OFL.txt`.
