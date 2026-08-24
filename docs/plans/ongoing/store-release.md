# Store release runbook — Google Play (primary) and App Store

Status: **ongoing** — the 14-day closed test is running; `0.24.0` is in Play
review to replace the stale build it started on. iOS has not begun.

**State as of 2026-08-24**

- Play developer account (**personal**) verified. App created, `com.cultuvilla.app` claimed.
- First EAS build succeeded: **0.19.0, versionCode 3**, built from a laptop.
  (versionCode 1 and 2 were consumed by a failed build — Play only needs them increasing.)
- **Closed testing (alpha) is live** since **22 Aug 14:38**, 177 countries. It started
  on that same `3 (0.19.0)` artifact, promoted from internal rather than rebuilt, so
  the first two days of the clock ran on code five versions old.
- **`4 (0.24.0)` uploaded to the closed track on 24 Aug.** Built by `mobile-release`
  run 32711478586 from `main` @ `04d13165` — the first time that workflow has ever
  run. Uploaded by hand (`submit: false`), because the Play service account did not
  exist yet at that point.
  Why it mattered: `0.19.0` predates `fix(mobile): stop detail info cards eating the
  whole scroll view on native` (4f6dc1b6, 22 Aug 14:18), so **every closed tester saw
  the event detail screen broken** — the FECHA/UBICACIÓN cards ate the viewport and
  everything below them was unreachable.
- App signing SHA-1 + SHA-256 registered in Firebase `cultuvilla-prod`; SHA-256 committed
  to `prod/assetlinks.json`.
- **The Play service account exists as of 24 Aug 10:12.**
  `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is a **repository** secret, not a `production`
  environment one — deliberately, because `beta-build-and-submit` cannot name that
  environment, whose branch policy admits only `main`.
- **The 14-day clock is NOT running: 10 of 12 testers are opted in** (checked 24 Aug).
  Play requires **≥12 continuously opted in for 14 days**, so the days elapsed since
  22 Aug count for nothing and the window effectively starts when the 12th tester
  accepts. "Opted in" means accepted the invite and installed — being on the tester
  list is not enough.
- **Next: recruit 2 more testers.** It is the only item on this plan that cannot be
  done in parallel with anything else; every day at 10/12 is a day the production
  track does not get closer.

**`beta-build-and-submit` will ship whatever ref it is dispatched from.** It has a
`workflow_dispatch` trigger with no branch restriction, no `environment` scope, and
reads a repo-level secret, so a dispatch from any branch builds that code and
auto-submits it to the closed track. That is how `5 (0.24.0)` — carrying Sign in with
Apple, the OTA channel and unsoaked `AuthContext` changes — reached testers from
`develop` on 24 Aug without a promotion. The workflow's own header says store binaries
move only by explicit decision; today nothing enforces that. A `github.ref_name != 'beta'`
guard on the dispatch path would.

**Two facts the first `mobile-release` run settled.**

- The `production` GitHub Environment admits **only `main`** as a deployment ref
  (custom branch policy), so a release build always requires the `beta` → `main`
  promotion to have landed first. Dispatching from `develop` or `beta` is rejected.
- `EXPO_TOKEN` is a **personal token under `alvaro-francisco-gil`**, who is Admin on
  the `cultuvilla.app` account that owns the EAS project — the build logged
  *Started by alvaro-francisco-gil*. It had never been exercised before 24 Aug
  because every prior build came from a laptop.
- Apple: joined an existing team (Team ID `78RB67NT38`) as Admin. No bundle IDs
  registered, no ASC app record, no iOS build has ever run.
- **Sign in with Apple is implemented** (`expo-apple-authentication`,
  `AuthContext.signInWithApple`, `AppleButton` on the login screen, iOS-only).
  It satisfies guideline 4.8 for the eventual *public* App Store submission —
  it does **not** gate TestFlight internal testing, which needs no App Review.
- `mobile-release.yml`'s iOS job now materialises an App Store Connect API key
  from CI secrets/vars at runtime (same pattern as the Android Play service
  account key) and accepts an optional `testflightGroup` dispatch input to add
  a build straight to a named TestFlight internal testing group. None of this
  has run yet — it needs `ASC_APP_ID`, `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID`
  (repo vars) and `APPLE_ASC_API_KEY_P8` (repo secret), none of which exist,
  plus a bundle ID + ASC app record that don't exist yet either. It is also
  subject to the same `production` GitHub Environment ref restriction noted
  above — a dispatch only runs from `main`.

This is the one place that records what has to happen outside the repo to get
Cultuvilla onto the stores, and which knob in the repo each external fact feeds.
Retire it to `docs/decisions/` once v1.0.0 is live on both stores.

## The one decision that sets the timeline

Google requires **personal** developer accounts registered after 13 Nov 2023 to
run a **closed test with at least 12 testers, continuously opted in for 14 days**,
before the production track unlocks. **Organization** accounts are exempt but
need a D‑U‑N‑S number (free, ~1–2 weeks to obtain).

| | Personal | Organization |
|---|---|---|
| Fee | $25 one-time | $25 one-time |
| Prerequisite | Government ID | D‑U‑N‑S number |
| 12 testers × 14 days before production | **Required** | Not required |

**Decidido: cuenta personal**, y arrancar el closed test el mismo día que suba
el primer AAB. La vía organización se salta los 12 testers × 14 días pero exige
D‑U‑N‑S (1–2 semanas) y una entidad jurídica registrada; la política de
privacidad nombra a una persona física como responsable del tratamiento, así
que personal es lo honesto y lo rápido. El reloj de 14 días corre en paralelo
con la ficha, las capturas y los formularios.

The requirement is **per package name**. Testing `com.cultuvilla.app.beta` earns
nothing toward `com.cultuvilla.app` — which is why `mobile-release.yml` builds
every track from the single `production` EAS profile and promotes the same
artifact across tracks, rather than shipping the beta package to Play.

That arrangement is now a recorded decision rather than a workflow comment:
[docs/decisions/store-tracks-share-prod.md](../../decisions/store-tracks-share-prod.md)
covers what `cultuvilla-beta` is for once no binary points at it, and why the
package name must not split per track (a separate package is a separate install
— the entangled beta/prod installs Órdago's testers hit).

## Critical path

1. Register the Play developer account and clear identity verification.
2. Create the app; `com.cultuvilla.app` is claimed on first upload and is **permanent**.
3. Create the Play service account, grant it **Release Manager**, store the JSON
   as the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` repository secret.
4. Run `mobile-release` (platform `android`, track `internal`) — proves the whole
   pipeline end to end without any review wait.
5. Copy the **app signing** SHA-256 out of Play Console → sets two things (below).
6. Run `mobile-release` with track `closed`, recruit 12 testers → the 14-day clock
   starts here, so do it as early as a working build exists. Everything else
   (listing copy, screenshots, data safety) can be finished while it runs.
7. Production rollout.

## Dónde estamos (actualizar al avanzar)

Marcar aquí, no en la cabeza. Esto es lo que una sesión nueva lee primero.

**Repo — hecho**

- [x] `contentReports/` + `users/{uid}/blockedUsers/` con denuncia y bloqueo en la
      app, cola de moderación en Administración → Denuncias (PR #242).
- [x] Página pública de eliminación de cuenta: `/legal/eliminar-cuenta`.
- [x] `ITSAppUsesNonExemptEncryption: false` en el `infoPlist`.
- [x] Copys de ficha, declaraciones y specs de gráficos en [docs/store/](../../store/).

- [x] **Cuenta de revisión con código de acceso fijo** (`_admin/reviewAccess` +
      `scripts/set-review-access.mjs`) para que el revisor entre sin abrir un
      buzón. Falta desplegarla a prod y escribir el doc allí.

- [x] **Sign in with Apple** (guideline 4.8) — `expo-apple-authentication` +
      `AuthContext.signInWithApple` + `AppleButton`, iOS-only en la pantalla de
      login. Bloqueaba la submission pública de iOS, no la de Play ni el
      TestFlight interno (sin App Review).
- [x] `mobile-release.yml`: job de iOS materializa la App Store Connect API key
      desde secrets/vars en runtime, igual que el service account de Play, y
      admite `testflightGroup` para añadir el build a un grupo de TestFlight.

**Repo — pendiente**

- (nada bloquea desde el código; todo lo que sigue es externo)

**Consola / fuera del repo — hecho**

- [x] Alta de la cuenta de desarrollador (personal) y verificación de identidad.
- [x] App creada en Play Console; `com.cultuvilla.app` reclamado.
- [x] `0.19.0` / versionCode 3 en el track **internal** (build lanzado desde un
      portátil con `eas build`, no por el workflow).
- [x] SHA-1 + SHA-256 de la app signing key registrados en `cultuvilla-prod`;
      el SHA-256 commiteado en `prod/assetlinks.json`.

**Consola / fuera del repo — pendiente**

- [ ] Service account de Play → secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. **No
      existe en ningún sitio**, comprobado el 2026-08-24 en los tres:
      secretos del repo (sólo `EXPO_TOKEN`), entorno `production` (vacío) y la
      cuenta de EAS — `meActor.accounts.googleServiceAccountKeys` devuelve `[]`.
      Por eso `mobile-release` falla en submit y `eas submit` tampoco funciona
      desde un portátil. **Corolario:** el 0.19.0 que hay en el track internal
      se subió *a mano* por la consola, no con `eas submit`; ese es hoy el único
      camino para publicar, y requiere sesión de navegador en Play Console.
      Para automatizarlo: Play Console → Setup → API access → crear/enlazar la
      service account, darle **Release Manager**, descargar el JSON y guardarlo
      como secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (el `submit` de
      [eas.json](../../../apps/mobile/eas.json) lo espera en
      `./google-play-service-account.json`, que el workflow escribe desde el
      secret).
      **Automatizado en [scripts/setup-play-publisher.sh](../../../scripts/setup-play-publisher.sh)**:
      habilita la API, crea la service account, exime *sólo ese proyecto* de
      la política de organización, mina la clave, la guarda como secret de
      GitHub y vuelve a armar la política. Requiere `gcloud auth login
      cultuvilla.app@gmail.com` antes (es la única cuenta con acceso a los
      tres proyectos; `matabuena.unida@` sólo ve `cultuvilla-beta`).
      **Ojo — `constraints/iam.disableServiceAccountKeyCreation` está
      impuesta a nivel de ORGANIZACIÓN** (org `1005684282225`, puesta el
      2026-04-25), así que hereda a todos los proyectos y `keys create`
      falla en todos por defecto. No hay camino sin clave: `eas submit`
      (y fastlane por debajo) sólo se autentica con un JSON de service
      account, no con Workload Identity.
- [ ] Cliente OAuth **Android** en `cultuvilla-prod` con el SHA-1 de la app signing key.
- [ ] Escribir `_admin/reviewAccess` en prod y rellenar el formulario App access
      con ese par ([play-declarations.md](../../store/play-declarations.md)).
- [ ] Content rating, Target audience, Data safety, Government apps, Financial
      features, Health — respuestas en [play-declarations.md](../../store/play-declarations.md).
- [ ] Gráficos: icono 512×512, feature 1024×500, ≥2 capturas
      ([assets.md](../../store/assets.md)).
- [ ] Ficha es-ES ([listing-es-ES.md](../../store/listing-es-ES.md)).
- [x] `mobile-release` track `closed` + 12 testers → el reloj de 14 días arrancó
      el **22 ago 14:38**, con `3 (0.19.0)` promovido desde internal (no un build
      nuevo), 177 países.
- [ ] **Subir `0.24.0` al track closed.** Los testers están probando una versión
      con el bug de detalle de evento. Orden: mergear la PR #254 (`beta` → `main`,
      verde desde el 22 ago) → `main` queda en `0.24.0` → lanzar `mobile-release`
      desde `main`. `versionCode` autoincrementa (`appVersionSource: remote`), así
      que saldrá `4`, por encima del `3` actual.
- [ ] Rollout a producción.

**iOS — pendiente, orden sugerido**

1. [ ] Registrar el bundle ID `com.cultuvilla.app` en Apple Developer →
       Certificates, Identifiers & Profiles, con **Sign In with Apple**
       marcado como capability.
2. [ ] Crear el registro de la app en App Store Connect → recoge el
       **App Store Connect app id** → var de repo `ASC_APP_ID`.
3. [ ] Crear una **App Store Connect API Key** (Users and Access → Integrations
       → App Store Connect API → rol **Admin** o **App Manager**, no menos) →
       descarga el `.p8` **una sola vez** (Apple no lo deja volver a descargar):
       - el contenido del `.p8` → secret de repo `APPLE_ASC_API_KEY_P8`
       - el Key ID que muestra la consola → var de repo `APPLE_ASC_KEY_ID`
       - el Issuer ID (arriba de la tabla de keys) → var de repo `APPLE_ASC_ISSUER_ID`
4. [ ] Habilitar el proveedor **Apple** en Firebase Console → Authentication →
       Sign-in method, para `cultuvilla-prod` (y `beta`/`dev` si se quiere probar
       ahí también). El flujo nativo no necesita Service ID ni return URL — solo
       el proveedor activado.
5. [ ] Primer build de iOS: `mobile-release` (`platform: ios`, `submit: false`)
       desde `main` — igual que el primer AAB de Android, para descubrir
       gotchas de build antes de intentar el submit. Si EAS pide credenciales
       de firma (certificado de distribución / provisioning profile) de forma
       interactiva porque nunca se generaron, hace falta un `eas credentials -p
       ios` local, una única vez, con el Apple ID + 2FA de quien administra el
       team — después queda guardado en los servidores de EAS y todo build de
       CI posterior es no interactivo.
6. [ ] Con `ASC_APP_ID` + las tres variables de la API key ya puestas, relanzar
       `mobile-release` con `submit: true` y `testflightGroup` (crear antes un
       grupo interno en App Store Connect → TestFlight, p. ej. "internal") →
       el build llega a TestFlight sin ningún App Review, listo para testers
       reales.
7. [ ] Cuando se quiera abrir a la revisión pública: rellenar
       [app-store-declarations.md](../../store/app-store-declarations.md) y
       enviar a revisión desde App Store Connect (esto no lo hace `eas submit`
       automáticamente).

**Contenido en prod: un solo pueblo.** De 16 municipios con overlay de comunidad
activada, sólo **Matabuena** tiene contenido (25 eventos, 2 noticias, 156
miembros); los otros 15 tienen 1 miembro y 0 eventos. La app es navegable sin
cuenta, así que un revisor ve ese contenido de todas formas, pero conviene
saberlo antes de leer una captura vacía como un fallo.

## External facts and where each one lands

| Fact | Where you get it | Where it goes |
|---|---|---|
| Play service account JSON | GCP → service account key, then Play Console → Users and permissions → Release Manager | repo secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| App signing key SHA-256 | Play Console → **Protected with Play → Play Store protection → Play app signing** | committed into `apps/mobile/public/.well-known/{env}/assetlinks.json` |
| App signing key SHA-1 | same screen | **new Android OAuth client** in the `cultuvilla-prod` GCP project |
| Apple Team ID | Apple Developer → Membership | committed into `apps/mobile/public/.well-known/{env}/apple-app-site-association` **and** `apps/mobile/eas.json` (`submit.production.ios.appleTeamId`) |
| App Store Connect app id | App Store Connect → App Information | repo var `ASC_APP_ID` |
| ASC API Key `.p8` file | App Store Connect → Users and Access → Integrations → App Store Connect API | repo secret `APPLE_ASC_API_KEY_P8` |
| ASC API Key ID | same screen | repo var `APPLE_ASC_KEY_ID` |
| ASC API Key Issuer ID | same screen (above the keys table) | repo var `APPLE_ASC_ISSUER_ID` |

### The Android OAuth client is the easy thing to forget

Play re-signs every AAB with the **app signing key**, so the certificate on a
user's device is not the upload key EAS signed with. Google Sign-In verifies the
caller by `package name + signing SHA-1`. Without an Android OAuth client
registered for `com.cultuvilla.app` + the **app signing** SHA-1 in the
`cultuvilla-prod` project, sign-in fails on every Play-installed build while
working perfectly on every locally-installed one. Add it the moment the first
AAB uploads, before the closed test recruits anyone.

The **SHA-256** from the same screen belongs in
`apps/mobile/public/.well-known/prod/assetlinks.json`, which is already filled
in — that is what makes a shared `https://cultuvilla.es/event/...` link open the
app instead of the browser. `dev` and `beta` still carry placeholders; fill each
one when that build is first distributed.

## Store listing, declarations, assets

Moved out of this runbook into [docs/store/](../../store/) so the same answers
serve both consoles and stay reviewable in git:

- [docs/store/listing-es-ES.md](../../store/listing-es-ES.md) — nombre, descripciones, categoría, keywords.
- [docs/store/play-declarations.md](../../store/play-declarations.md) — todo el checklist de **App content**: privacy policy, app access, ads, content rating, target audience, data safety, government apps, financial features, health.
- [docs/store/app-store-declarations.md](../../store/app-store-declarations.md) — App Privacy labels, age rating, notas de revisión, export compliance.
- [docs/store/assets.md](../../store/assets.md) — icono, feature graphic, capturas.

El flujo de denuncia/bloqueo de UGC que piden el content rating de Play y la
guideline 1.2 de Apple, y Sign in with Apple para la guideline 4.8, **ya están
en el código**. Lo que sigue bloqueando desde fuera del repo, para ambas
plataformas: **una cuenta/buzón de revisión utilizable** (el login es OTP por
email o Google/Apple, así que ninguna credencial suelta sirve).

## Repo knobs this runbook feeds

- `apps/mobile/eas.json` — `submit.internal` / `submit.closed` / `submit.production`
  map 1:1 to the Play tracks `internal` / `alpha` / `production`.
- `.github/workflows/mobile-release.yml` — the manual build+submit entry point.
- `apps/mobile/public/.well-known/{env}/` — the deep-link association files,
  signing identities committed; copied into place at hosting-deploy time by
  `apps/mobile/scripts/copy-well-known.mjs`.

## Build gotchas proven the hard way

Both of these cost a failed build on the first-ever EAS run. Neither is
reproducible locally, because locally the missing pieces already exist.

**`packages/shared` must be built on the EAS builder.** Its `exports` resolve to
`./dist/*`, `dist/` is gitignored, and EAS uploads *committed git state* — so the
builder never receives it. Metro has no `src` alias (unlike tsconfig `paths` and the
jest `moduleNameMapper`, which both point at `src`), so the import is simply
unresolvable and the build dies in **Bundle JavaScript** with no useful message.
`eas-build-post-install` in `apps/mobile/package.json` runs `pnpm --filter
@cultuvilla/shared build` on the builder. `@cultuvilla/i18n` needs no equivalent —
its entry is `index.ts` and Metro transpiles it directly.

**Every `FIREBASE_*_<ENV>` var must exist in the EAS environment the profile binds
to.** `app.config.ts` resolves each through `?? ''`, so a missing variable does not
fail the build — it ships an app whose Firebase config is empty strings, which looks
fine until the first launch. The `production` environment initially held only
`FIREBASE_*_DEV`. Check with `eas env:list --environment production` before building,
and note the `production` build profile pins `"environment": "production"` explicitly
rather than relying on eas-cli's default.

## The EAS project is pinned, deliberately

`apps/mobile/app.config.ts` hardcodes `owner: 'cultuvilla.app'` and the literal
`projectId`, rather than reading `EAS_PROJECT_ID` from the environment. An env var is
machine-global, and the same dev machines check out `ordago-apps` (owner
`ordago-apps`); a stray export would silently build one repo into the other's EAS
project. `apps/mobile/__tests__/appConfig.test.ts` fails if the env indirection
returns. The eas-cli login is global and per-*user*, not per-repo — one Expo user
belongs to many accounts, and `owner` is what routes each repo.

## Follow-ups deliberately not done yet

- No automatic build on merge to `main`. Auto-submitting to the production track
  on every merge is the wrong default while a closed test is running; revisit
  once the release cadence is established.
- Play release notes are entered by hand in the console. If that becomes a
  recurring chore, script it against the Play Developer API (ordago-apps has a
  `push-play-release-notes.js` worth copying).
