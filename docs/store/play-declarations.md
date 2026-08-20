# Google Play — App content declarations

Answers for every item under **Play Console → Policy → App content**, plus the
store settings that sit next to them. Each answer is a claim about the shipped
binary; the "source" column is what to re-read before changing it.

| Declaration | Answer | Source |
|---|---|---|
| Privacy policy | `https://cultuvilla.es/legal/privacy` | [docs/legal/politica-de-privacidad.md](../legal/politica-de-privacidad.md) → [apps/mobile/app/legal/privacy.tsx](../../apps/mobile/app/legal/privacy.tsx) |
| App access | **Parts restricted** — credenciales de prueba obligatorias | ver abajo |
| Ads | **No contiene anuncios** | sin SDK de publicidad en [apps/mobile/package.json](../../apps/mobile/package.json) |
| Content rating | Cuestionario → categoría **Social / UGC** | ver abajo |
| Target audience | **18+** (público objetivo declarado); edad mínima de registro 14 | `MIN_SELF_REGISTRATION_AGE = 14` |
| Data safety | ver tabla completa abajo | modelos `users` / `persons`, `blockedPermissions` |
| Government apps | **No** — Cultuvilla no está desarrollada por ni en nombre de una administración pública | — |
| Financial features | **Ninguna** — sin pagos, sin compras in-app, sin criptoactivos | no existe campo `price` en el modelo de evento |
| Health | **No** — sin funciones de salud, sin investigación clínica, sin seguimiento físico | — |

## App access (sign-in details)

El contenido es **legible sin cuenta** (guest browsing, ver
[docs/decisions/guest-browsing.md](../decisions/guest-browsing.md)): eventos,
noticias, pueblos y organizaciones se ven sin iniciar sesión. La sesión sólo se
exige para **actuar** — inscribirse a un evento, unirse a una organización,
publicar contenido, administrar.

Aun así hay que declarar **"Todas o algunas funciones están restringidas"** y
dar instrucciones, porque el revisor no puede evaluar la mitad de la app sin
cuenta.

> ⚠️ **Decisión pendiente.** El inicio de sesión es (a) código OTP de 6 dígitos
> enviado por email o (b) Google Sign-In. Ninguna de las dos da al revisor una
> credencial usable tal cual: el OTP exige acceso al buzón y Google bloquea con
> frecuencia los inicios de sesión desde los centros de revisión.
> Opciones, por orden de preferencia:
> 1. Buzón de revisión dedicado (p. ej. `cultuvilla.review@gmail.com`) y entregar
>    email + contraseña del buzón junto con el paso "lee el código en
>    mail.google.com". Funciona en ambas tiendas y no toca el código.
> 2. Cuenta de revisión con contraseña de Firebase Auth — requiere exponer
>    `signInWithEmailAndPassword` en la UI, que hoy sólo existe como seam de
>    tests. No hacerlo sólo por la review.
>
> Sea cual sea, la cuenta debe estar **dada de alta en un pueblo activo con
> eventos**, o el revisor verá una app vacía.

Texto de instrucciones para la consola (rellenar `<email>` / `<clave>`):

> La mayor parte de la app se puede usar sin cuenta: eventos, noticias, pueblos
> y asociaciones son públicos. Se necesita cuenta para inscribirse a un evento,
> unirse a una asociación o publicar contenido.
> Para acceder: pantalla de inicio → "Entrar" → introducir `<email>` → se envía
> un código de 6 dígitos a ese buzón → leerlo en https://mail.google.com con la
> contraseña `<clave>` → introducirlo en la app.

## Content rating

Cuestionario (IARC). Respuestas que se derivan del código:

- **Categoría**: Red social / con contenido generado por usuarios.
- **Contenido generado por usuarios**: **Sí** — comentarios (`EntityComments`),
  noticias, biografías de perfil, imágenes subidas.
- **Interacción entre usuarios**: **Sí** — comentarios y menciones.
- **Compartir ubicación con otros usuarios**: **No** — la ubicación se usa una
  sola vez para fijar el pin del pueblo, no se comparte la del usuario.
- **Compartir información personal**: **Sí** — el perfil (nombre, foto, pueblo)
  es visible para otras personas usuarias.
- Violencia, sexo, lenguaje soez, drogas, apuestas, compras: **No**.

**Herramientas de moderación** (lo que el cuestionario pregunta a continuación):

- **Denuncia dentro de la app**: sí — bandera en cada comentario ajeno, siete
  motivos, escribe en `contentReports/`.
- **Bloqueo de personas usuarias**: sí — desde la misma hoja; se deshace en
  Ajustes → Personas bloqueadas.
- **Revisión por parte de administradores**: sí — Administración → Denuncias
  (cola de denuncias abiertas del pueblo) y ocultación de contenido vía
  `setContentVisibility`, con registro de auditoría en `moderationEvents/`.
- **Contacto de moderación**: `cultuvilla.app@gmail.com`.

## Target audience and content

- Grupos de edad seleccionados: **18 y más**. Aunque los Términos permiten el
  registro desde los 14, declarar cualquier franja por debajo de 18 activa
  Families Policy (política de diseño para menores, consentimiento parental
  verificable, revisión adicional) — desproporcionado para esta app.
- ¿Atrae a menores por su aspecto? **No.**
- Google Play SDK Index: sin SDKs de terceros que traten datos de menores.

## Data safety

Recogida y **no compartida** en todos los casos: los datos viven en Firebase
(Google Cloud, encargado del tratamiento), no se venden ni se ceden a terceros
con fines propios.

| Tipo (categoría Play) | Recogido | Obligatorio | Finalidad | Origen en el código |
|---|---|---|---|---|
| Personal info → Name | Sí | Sí | App functionality, Account management | `persons` (nombre y apellidos) |
| Personal info → Email address | Sí | Sí | Account management, autenticación | Firebase Auth |
| Personal info → Phone number | Sí | No | App functionality | perfil, campo opcional |
| Personal info → Other info | Sí | No | App functionality | fecha y lugar de nacimiento, sexo, biografía |
| Photos and videos → Photos | Sí | No | App functionality | foto de perfil, escudo, imágenes de evento/noticia |
| Location → Approximate + Precise | Sí | No | App functionality | `expo-location`, una sola vez, para el pin del pueblo |
| App activity → Other actions | Sí | No | App functionality | inscripciones, pertenencias, solicitudes |
| App info and performance → Crash logs | Sí | No | Diagnóstico | `captureError` → Cloud Logging |
| App info and performance → Diagnostics | Sí | No | Diagnóstico | mismo puente de errores |

Prácticas de seguridad a declarar:

- **Cifrado en tránsito**: sí (HTTPS/Firebase en todo el camino).
- **Se puede solicitar la eliminación de los datos**: sí — Ajustes → Eliminar
  cuenta (callable `deleteAccount`, borrado RGPD).
- **URL de solicitud de eliminación**: `https://cultuvilla.es/legal/eliminar-cuenta`.
- **Sin SDK de analítica de terceros en nativo**: el backend de analítica de
  `apps/mobile/lib/observability/analytics.ts` es hoy un no-op; los errores van
  a Cloud Logging propio. Si se activa `@react-native-firebase/analytics`,
  esta tabla cambia (Device or other IDs pasa a recogerse).

### Permisos del manifiesto

`ACCESS_COARSE_LOCATION` y `ACCESS_FINE_LOCATION` (uso puntual) y lectura de la
fototeca vía selector del sistema. Bloqueados en
[apps/mobile/app.config.ts](../../apps/mobile/app.config.ts):
`ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `RECORD_AUDIO`,
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`. Desbloquear cualquiera de
ellos obliga a rehacer el formulario de Data safety (y, en el caso de
background location, a una declaración escrita más un vídeo de revisión).

## Store settings

- **Categoría de la app**: Estilo de vida.
- **Etiquetas**: eventos, comunidad, pueblo.
- **Datos de contacto**: `cultuvilla.app@gmail.com`, `https://cultuvilla.es`.
- **Aplicación gratuita** — no se puede cambiar a de pago después.
- **Países**: España (ampliable después sin re-review).
