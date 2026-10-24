# MultiBot Web

SPA/PWA adaptada del diseño de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka) y del catálogo de este repositorio. La API Node, runtime protegido y Blueprint de Render se configuran desde la raíz. Consulta [`../docs/WEB.md`(../docs/guides/WEB.md).

El portal muestra bots y plugins; el flujo **Crear bot** despliega/inicia el runtime como proceso dentro del servicio web existente y permite la vinculación real con Pairing Code o QR, además de Termux, métricas y API. No aprovisiona un servicio Render nuevo. **Universal Bot puede ejecutarse desde Termux o desde el runtime web de la cuenta propietaria.** El QR/Pairing Code web lo genera Baileys; las credenciales se guardan en el filesystem efímero del servicio, no en PostgreSQL. Render Free puede suspender el servicio y no garantiza 24/7.

La web y sus assets conservan atribución/licencia de TomiOka en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) y [`LICENSE-TOMIOKA.txt`](LICENSE-TOMIOKA.txt).