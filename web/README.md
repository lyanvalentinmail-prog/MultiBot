# MultiBot Web

SPA/PWA adaptada del diseño de [TomiOka](https://github.com/lyanvalentinmail-prog/TomiOka) y del catálogo de este repositorio. La API Node, runtime protegido y Blueprint de Render se configuran desde la raíz. Consulta [`../docs/WEB.md`](../docs/WEB.md).

El portal muestra bots, plugins y perfiles; además incluye Termux, métricas y API. **Universal Bot puede ejecutarse desde Termux o desde un runtime web allowlisted.** El QR/Pairing Code web lo genera Baileys; las credenciales se guardan en el filesystem efímero del servicio, no en PostgreSQL. Render Free puede suspender el servicio y no garantiza 24/7.

La web y sus assets conservan atribución/licencia de TomiOka en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) y [`LICENSE-TOMIOKA.txt`](LICENSE-TOMIOKA.txt).