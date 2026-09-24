# apps/panel — the founders' panel

An internal tool for the two people running Cultuvilla. It reads the business
registry in [project/](../../project/) and nothing else. **No villager ever sees
it, and no product feature belongs here.**

Root [AGENTS.md](../../AGENTS.md) governs the codebase; this file governs this
app. It is Vite + React, not Expo — deliberately not part of `apps/mobile`.

**Live at https://cultuvilla-panel.web.app** (dev project, `villa-events`).

## Why it is a separate app

It used to be a screen inside `apps/mobile` at `/admin/negocio`, and that was
wrong for two reasons. The tolerable one: a tool for two people has no business
travelling in the bundle villagers install. The serious one: **the app-admin
route guard hid the screen, but the snapshot JSON still shipped in the public web
bundle**, so anyone loading the web build could fetch it. "Admin dashboard"
promised a privacy it did not have.

So the data path is the whole design:

```
project/**.md  →  pnpm business:snapshot  →  functions/src/business/snapshot.json
                                                   ↓  (bundled into functions, not served)
                                          getBusinessSnapshot callable
                                                   ↓  only if admins/{uid} exists
                                              apps/panel  ← no data compiled in
```

`apps/panel/dist` is a shell. Nothing in it reveals the registry.

## Three tabs, two of them registry

`Registro` · `Propuestas` · `Fiestas`, in the hash so a reload keeps its place.

Proposals earned their own tab because they are the only kind whose readiness is
computed rather than declared — *"marcadas listas pero con huecos"* belongs next
to the proposals, not floating above the whole registry. `Con reloj` deliberately
stays in `Registro` and still spans every kind, proposals included: it answers
"what has a clock on it", which is not a per-kind question.

`Lista`/`Calendario` inside `Registro` is a *view* of the same records, so it is
a second control inside that tab rather than two more top-level tabs.

**Fiestas** reads `project/mercado/pueblos-vecinos-matabuena.json` — 48 pueblos
around Matabuena and when they celebrate. Two things about it are load-bearing:

- **Dates are recurrences, not dates,** and there are two kinds.
  `nextFiestaOccurrence` resolves the year in the browser, so a January fiesta
  viewed in December is next year's. A **fixed** feast is its month-day — San
  Miguel is always 29 September. A **moveable** one is computed from `regla`
  every year, because the bulletin prints "5 October 2026" for what is really
  *the first Sunday of October observed on the Monday*; freezing that as a
  month-day is wrong from 2027 on and nothing goes red. A moveable date with no
  rule yet falls back to its anchor and shows a **"fecha sin regla"** chip.
- **Provenance is rendered, always.** A `declarada` date is one of the two
  *fiestas locales* a municipality declares in the bulletin — the liturgical
  anchor of the main núcleo, **not** the week it celebrates. Matabuena declares
  16 and 25 July and holds four fiesta windows, the biggest 22–28 August. Only
  `verificada` has a dated public source, and the panel prints that source under
  every row. Showing the two alike would make the panel confidently wrong.
- **The tab opens with what the search did NOT cover.** `cobertura` — radius,
  sweeps, verified percentage, open `[[confirmar]]` count — before any fiesta.
  The dataset is 22 % verified; a calendar that looked finished at 22 % would be
  the most expensive thing on this screen.

## Dev only, on purpose

One hosting target, on the dev project, with **no release path**. Its content
comes from git rather than from an environment, so a beta and a prod copy would
show the same thing — and keeping it off prod means a broken panel can never
block the app's promotion. That is also why
[deploy-panel.yml](../../.github/workflows/deploy-panel.yml) is a separate
workflow instead of a step in `deploy-firebase.yml`.

It redeploys on pushes to `develop` that touch `project/**` or this app, because
the panel's content *is* the registry: a new convocatoria should reach it without
anyone remembering to.

## Two gotchas that a second hosting site brings

Both bit this app on its first deploy. They are per-**site**, so a custom domain
(`panel.cultuvilla.es`) needs the second one again.

**1. `--only hosting` deploys every target.** `firebase.json` has targets `app`
and `panel`, so a bare `--only hosting` tries to deploy both: it fails from
beta/prod on a target that does not exist there, and from dev whenever the panel
has not been built — turning an internal tool into a blocker for shipping the
app. Every deploy path names its target, and
[hostingTargets.test.ts](../../packages/shared/test/ci/hostingTargets.test.ts)
fails the build if one regresses.

**2. Firebase Auth does not authorize a new site's domain.** It auto-authorizes
the *default* site (`villa-events.web.app`, `villa-events.firebaseapp.com`), not
additional ones, so Google sign-in failed with `auth/unauthorized-domain` until
`cultuvilla-panel.web.app` was added under Authentication → Settings →
Authorized domains. The Firebase CLI cannot do it; the Identity Toolkit admin
API can:

```bash
# GET the config, then PATCH with the domain APPENDED — replacing the list would
# break sign-in on the app's own web build.
curl -H "Authorization: Bearer $TOKEN" \
  https://identitytoolkit.googleapis.com/admin/v2/projects/villa-events/config
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  'https://identitytoolkit.googleapis.com/admin/v2/projects/villa-events/config?updateMask=authorizedDomains' \
  -d '{"authorizedDomains":["localhost","villa-events.firebaseapp.com","villa-events.web.app","cultuvilla-panel.web.app"]}'
```

ADC alone returns 403 ("requires a quota project") — use the dev service account
key instead.

## Conventions

- **No second set of secrets.** `envDir` points Vite at `apps/mobile/.env`, so the
  panel reads the same `FIREBASE_*_DEV` values the mobile build uses. Without it
  Vite looks only in `apps/panel/`, finds nothing, and silently builds a bundle
  with an empty Firebase config — the app then renders "Falta configuración".
- **No Tailwind, no primitives.** Plain CSS, with the colours published as CSS
  custom properties at boot. **[theme.ts](src/theme.ts) is the only place a colour
  may be written**, and [styles.css](src/styles.css) contains no hex literal — a
  test asserts that, because a hex chosen by eye in the stylesheet is a colour
  that escapes the contrast check.
- **The panel does NOT reuse the app's text tokens, and that is deliberate.** The
  brand palette is tuned for a warm consumer app; on a dense table it fails
  badly. The shipped `fg-muted` (sage) measures **2.15:1** on `bg-surface`
  (cream) and **1.19:1** on `bg-subtle` (peach) — which is why the panel's first
  version had secondary text nobody could read. Brand hues stay for accents; the
  ink ramp is darker and measured. `theme.test.ts` asserts every pairing the
  panel can render against WCAG AA (4.5:1), including the monogram colours, and
  it keeps a regression test for that exact sage-on-cream failure.
- **Chips are coloured by what a label means, not by which field it came from.**
  `submitted` on a convocatoria and `enviada` on a propuesta are the same kind of
  fact, so they share a colour — a reader learns five colours instead of twenty
  words. The families are *nothing yet* / *working on it* / *handed over* / *it
  worked* / *over*, plus urgency and hole-count. An unmapped state still renders,
  as a grey chip with the raw word, so a new registry state is visible rather
  than silently dropped. See [labels.ts](src/labels.ts).
- **Entity marks are best-effort.** A favicon when the record has a real `url`,
  otherwise a deterministic coloured monogram. Most entities carry
  `[[confirmar]]` rather than a URL, so **the monogram is the normal case, not
  the error case**. Favicons come from DuckDuckGo's icon endpoint rather than
  Google's: this is internal, but a per-entity request to Google would still tell
  Google which funders we are reading about.
- **The calendar renders three months and marks only days that carry something.**
  The registry is sparse, so a single month grid would usually be empty; three
  compact months make "nothing due" read as an answer instead of as a broken
  widget. Anything falling outside the window is listed rather than dropped.
- **Hardcoded Spanish.** Two users, no localisation need — the carve-out root
  AGENTS.md makes for internal admin surfaces.
- **Parse, never cast.** The panel runs the callable's response through
  `BusinessSnapshotSchema`, so a shape change says so instead of rendering as
  silently missing sections. The schema lives in `packages/shared` because it
  crosses three workspaces (generator writes, functions serves, panel reads).
- **`@cultuvilla/shared` is CommonJS and workspace-linked**, so Rollup cannot
  trace named exports through its `__exportStar` barrels. Metro handles that
  interop for mobile; Vite needs the `commonjsOptions` in
  [vite.config.ts](vite.config.ts). Expect to hit this when adding a new
  workspace import.

## Access

Anyone with a doc at `admins/{uid}` **on dev**. Not prod — this is a dev-project
app, so a prod-only admin cannot get in. A user's uid exists only after they have
signed in with Google at least once.

## Commands

```bash
pnpm panel:build     # shared build + vite build
pnpm deploy:panel    # build + deploy hosting:panel to dev

# the callable serves the data, so its own deploy is what refreshes the registry
bash scripts/firebase.sh deploy --only functions:getBusinessSnapshot --project dev
```
