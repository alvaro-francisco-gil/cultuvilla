# Store release runbook — Google Play (primary) and App Store

Status: **ongoing** — Play internal testing is live; the 14-day closed test has
not started. iOS has not begun.

**State as of 2026-08-18**

- Play developer account (**personal**) verified. App created, `com.cultuvilla.app` claimed.
- First EAS build succeeded: **0.19.0, versionCode 3**, live on the **internal** track.
  (versionCode 1 and 2 were consumed by a failed build — Play only needs them increasing.)
- App signing SHA-1 + SHA-256 registered in Firebase `cultuvilla-prod`; SHA-256 committed
  to `prod/assetlinks.json`.
- **Next:** promote to closed testing, recruit 12 testers, start the clock.
- Apple: joined an existing team (Team ID `78RB67NT38`) as Admin. No bundle IDs
  registered, no ASC app record, no iOS build has ever run.

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

**Repo — pendiente**

- [ ] **Sign in with Apple** (guideline 4.8), mientras Google Sign-In siga en la
      pantalla de acceso. Bloquea la primera submission de iOS, no la de Play.

**Consola / fuera del repo — pendiente**

- [ ] Alta de la cuenta de desarrollador (personal) y verificación de identidad.
- [ ] Crear la app en Play Console (`com.cultuvilla.app`, permanente al primer subir).
- [ ] Service account de Play → secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
- [ ] `mobile-release` track `internal` (prueba de tubería, sin espera de review).
- [ ] Cliente OAuth **Android** en `cultuvilla-prod` con el SHA-1 de la app signing key.
- [ ] Buzón de revisión + cuenta dada de alta en un pueblo activo con eventos
      (ver [play-declarations.md](../../store/play-declarations.md#app-access-sign-in-details)).
- [ ] Formulario App access con esos datos.
- [ ] Content rating, Target audience, Data safety, Government apps, Financial
      features, Health — respuestas en [play-declarations.md](../../store/play-declarations.md).
- [ ] Gráficos: icono 512×512, feature 1024×500, ≥2 capturas
      ([assets.md](../../store/assets.md)).
- [ ] Ficha es-ES ([listing-es-ES.md](../../store/listing-es-ES.md)).
- [ ] `mobile-release` track `closed` + 12 testers → arranca el reloj de 14 días.
- [ ] Rollout a producción.

## External facts and where each one lands

| Fact | Where you get it | Where it goes |
|---|---|---|
| Play service account JSON | GCP → service account key, then Play Console → Users and permissions → Release Manager | repo secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| App signing key SHA-256 | Play Console → **Protected with Play → Play Store protection → Play app signing** | committed into `apps/mobile/public/.well-known/{env}/assetlinks.json` |
| App signing key SHA-1 | same screen | **new Android OAuth client** in the `cultuvilla-prod` GCP project |
| Apple Team ID | Apple Developer → Membership | committed into `apps/mobile/public/.well-known/{env}/apple-app-site-association` |
| App Store Connect app id | App Store Connect → App Information | repo var `ASC_APP_ID` |

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
guideline 1.2 de Apple **ya está en el código**. Lo que sigue bloqueando desde
fuera del repo: **una cuenta/buzón de revisión utilizable** (el login es OTP por
email o Google, así que ninguna credencial suelta sirve) y, para iOS, **Sign in
with Apple** mientras Google Sign-In esté en la pantalla de acceso.

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
