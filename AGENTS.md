# AGENTS.md

The authoritative guide for anyone (human or AI) modifying this repo. Short, opinionated, load-bearing. When this file disagrees with code, the file wins — fix the code.

## What this project is

Cultuvilla is a mobile-first web app for Spanish village communities. Organizations (ayuntamientos, peñas, asociaciones) publish events; residents and visitors discover them, sign up themselves and family members ("personas"), and village admins manage invites and org approvals.

Design work lives under [docs/plans/](docs/plans/) by lifecycle stage (`ideas/` → `ready/` → `ongoing/`); durable rationale for shipped work is distilled into [docs/decisions/](docs/decisions/). **The code is the source of truth for *what* exists**; this file is the source of truth for *how* to build. See the `managing-plans-lifecycle` skill for where a given doc belongs. There is no `docs/superpowers/` or `docs/archive/`.

## Repo health beats every rule below

If a rule here makes the repo worse for a specific change, break the rule and update this file in the same PR. Rules exist to keep the codebase coherent, not to be obeyed mechanically.

## Architecture invariants

### 1. Service-layer ownership

Components, pages, and hooks **must not** import from `firebase/firestore`, `firebase/storage`, `firebase/functions`, or `firebase/auth` directly. All Firebase access goes through a service in [packages/shared/src/services/](packages/shared/src/services/). See [_services-map.md](packages/shared/src/services/_services-map.md) for the catalogue.

- Need `GeoPoint`, `Timestamp`, or the `User` type? Import from `@cultuvilla/shared/firebase` (the shared package re-exports them).
- The **only** exempt file is [apps/mobile/lib/auth/AuthContext.tsx](apps/mobile/lib/auth/AuthContext.tsx) — it owns the auth boundary (sign-in/out, listeners). Everything else routes through services.

`packages/shared` and `functions/` are ESLint-gated ([packages/shared/eslint.config.mjs](packages/shared/eslint.config.mjs), [functions/eslint.config.mjs](functions/eslint.config.mjs)); `apps/mobile` has no ESLint config yet, so there the rule is convention — don't import `firebase/*` from a screen, add a service instead.

> **See also:** the `touch-service` and `guardrail-enforcement` skills for the procedures.

**Why:** Firebase SDK calls scattered through UI code are the #1 source of duplicate reads, missing security checks, and broken offline behaviour. One place per collection. One place to add caching or migrate when needed.

### 2. Shared types, shared models

Anything that crosses workspace boundaries — between the mobile app and functions — lives in [packages/shared](packages/shared). Domain types live under `src/models/`, organized by entity (event, village, person, etc.). Services consume models, never the reverse.

### 3. First-class top-level collections, scoped by `municipalityId`

Single Firebase project. Domain entities (`events`, `organizations`, `persons`, `occupations`, news, …) live at the **top level** of Firestore and carry a `municipalityId` field that scopes them to a village. The only nesting we keep is for data that is genuinely owned by a parent doc (e.g. `municipalities/{id}/members/{userId}`, `organizations/{orgId}/members/{userId}`, `events/{eventId}/registrations/{regId}`, `users/{uid}/notifications/{nid}`).

**Municipality vs. village** — these are two layers of one entity, not synonyms: `municipality` = the physical INE doc and all identity/foreign-key/storage names (`municipalityId`, `municipalities/{id}/…`); `village` = that municipality once its `community` overlay is activated, and all community-facing display names (`villageName`, `VillageMemberData`, `syncVillageDenormalization`). Read [docs/architecture/municipality-vs-village.md](docs/architecture/municipality-vs-village.md) before adding a field or collection that touches either word.

This is the result of the migration recorded in [docs/decisions/open-feed-architecture.md](docs/decisions/open-feed-architecture.md): top-level keeps cross-village/global queries trivial, leaves the door open to multi-village orgs, and removes most of the collection-group indexing burden. Indexes on `municipalityId + <sortField>` (and similar single-collection composite indexes) are declared in [firestore.indexes.json](firestore.indexes.json) and must be added in the same change as a new query shape.

> **See also:** the `add-firestore-collection` skill for the multi-file checklist when adding a new collection.

### Request types (solicitudes)

Two user-initiated requests exist. The Solicitudes screen (mobile) is open to
everyone and has two tabs: **Recibidas** (inbox — items you can approve, scoped to
what you administer) and **Enviadas** (outbox — requests you've sent). Non-admins
simply see an empty inbox. Requests are created from in-context screens; outcomes
arrive as notifications.

| Request | Collection | Created by | Approved by |
|---|---|---|---|
| Organizer (be the pueblo's organizer) | `organizerRequests/` | any user | super admin (`respondToOrganizerRequest` callable) |
| Organization (create peña/asociación/ayuntamiento) | `organizations/` (status `pending`) | village member | village admin (own village) or super admin (`approveOrganization` callable; `rejectOrganization` stays a client write) |

**Joining a peña/asociación is not a request — it is instant self-service.** The
org detail FAB does a direct client write of `organizations/{orgId}/members/{uid}`
(role `member`, function-owned), gated by Firestore rules: a user may add only
themselves (`isOwner`), admins may add anyone. This mirrors village join
(`joinVillage`) — both memberships are direct, approval-free client writes. (The
legacy `organizationJoinRequests` approve-flow is superseded and slated for removal.)

**Membership roles & the audit log.** Villages and orgs are the same abstraction —
a membership group with members that carry a `role` and one *founder*. Authority is
ALWAYS the role flag, never the founder pointer:

- **Village:** members at `municipalities/{id}/members/{uid}` with `role: 'admin' | 'user'`.
  `community.organizerId` is the *founding organizer* — a single, nullable pointer
  (`null` during the wiki phase, where any member may edit basic info). It grants no
  authority of its own and it is **not** "the admin": a village can have many admins.
- **Org:** members at `organizations/{orgId}/members/{uid}` with `role: 'admin' | 'member'`;
  `requestedBy` is the founder, seeded as admin on approval.

`role` is **function-owned** — clients cannot write it. New admins are created (and
demoted) only through the audited callables **`changeVillageMemberRole` /
`changeOrgMemberRole`**, which verify authority, mutate the role, and append to the
append-only **`membershipEvents/`** log (top-level, scoped by `municipalityId`,
readable by the village/org admins) in one transaction. Organizer approval and org
approval also emit events. Village/app admins are the backstop.

### 4. Denormalized read models for high fan-out

When a query would require N reads or live across collection boundaries, write a denormalized read model and keep it in sync via a Cloud Function trigger. See [docs/architecture/denormalized-read-models.md](docs/architecture/denormalized-read-models.md) for the pattern; [functions/src/village/syncVillageDenormalization.ts](functions/src/village/syncVillageDenormalization.ts) is the canonical example.

> **See also:** the `denormalized-read-model` skill for the step-by-step.

### 5. Strict TypeScript

`strict: true` everywhere. No `any`. No `@ts-nocheck`. If a type is genuinely unknown at the boundary, use `unknown` and narrow. `@typescript-eslint/no-explicit-any` is an error in `packages/shared` and `functions`; the same standard applies in `apps/mobile` even though it isn't lint-gated yet — fix at the source, never silence with `as any`.

## Conventions

### Forms

Currently controlled inputs with `useState`. No form library yet. New forms should match the existing style until/unless we adopt `react-hook-form + zod` (see CHANGELOG — this is on the table).

### Entities

An **entity** is a village-scoped domain object that appears in a horizontal
`Section` scroll (as a `BigCard` / `EntityCard`) and opens a hero-image detail
screen. The family: **event, festival-poster (cartel), place, barrio,
organization, news**. `person` and `village` are **not** entities — they open
into forms (`ScreenHeader`), not hero-detail screens.

Every entity detail screen is a thin consumer of one scaffold,
[apps/mobile/components/feature/EntityDetailScaffold.tsx](apps/mobile/components/feature/EntityDetailScaffold.tsx):
a solid static top bar (`EntityDetailHeader` — back + action icons) above a
full-bleed flyer (`DetailHeroImage`), then title + body. Don't hand-roll a
detail screen; add a scaffold consumer. The term is also carried by
`EntityCard` and `useEntityCapabilities`; the per-kind fallback icon lives in
[apps/mobile/lib/entities/registry.ts](apps/mobile/lib/entities/registry.ts).

### State and data fetching

React Context for cross-tree state (auth, village). No global store. No query cache today — every component fetches its own data via services. If you add a feature where this hurts (revalidation, optimistic updates, dedup), surface it in the PR rather than rolling your own cache.

### Styling

Tailwind v3 via NativeWind v4, with a JS-based `tailwind.config.ts` ([apps/mobile/tailwind.config.ts](apps/mobile/tailwind.config.ts)).
**Design tokens live in `@cultuvilla/shared/design-system`** and feed
Tailwind's `backgroundColor` / `textColor` / `borderColor` / `boxShadow` /
`borderRadius` / `spacing` / `fontSize` / `zIndex` extensions. New code
must use semantic Tailwind classes (`bg-surface`, `text-primary`,
`rounded-md`, `shadow-sm`, `text-body`, etc.) — not raw Tailwind palette
names (`bg-white`, `text-gray-900`). Existing screens still use raw
classes; migration is opportunistic, not mandatory.

When a screen needs a raw numeric value (computed style, RN inline style),
import directly from the design-system: `spacing[4]`, `iconSizes.md`,
`elevation.sm.rn`. See [packages/shared/src/design-system/README.md]
(packages/shared/src/design-system/README.md) for the full token vocabulary.

**Primitives** live under
[apps/mobile/components/primitives/](apps/mobile/components/primitives/) —
`Screen`, `HStack`, `VStack`, `Text`, `Pressable`, `Button`, `Card`,
`Input`, and more. New screens compose primitives; an inline RN `<View>` +
NativeWind class is fine where a primitive doesn't fit, but reach for the
primitive first.

Icons: `@expo/vector-icons` (`Ionicons`). Pass
`iconSizes.sm | md | lg` for size — no ad-hoc `size={18}`.

### i18n

Messages live in [@cultuvilla/i18n](packages/i18n/) and are consumed by the
mobile app via the thin `useT()` adapter in
[apps/mobile/lib/i18n.tsx](apps/mobile/lib/i18n.tsx). User-facing strings go
through `useT()`; hardcoded Spanish is allowed only in dev-only admin
surfaces where i18n is not a current priority.

Locale formatting (`formatDate`, `formatPrice`, `formatRelativeTime`)
lives in `@cultuvilla/shared/utils/format.ts`, preset to `es-ES`. Never
call `Intl.DateTimeFormat` or `Intl.NumberFormat` directly in screens —
the formatter is the single point of locale truth.

### Cloud Functions logging

Cloud Functions write to Cloud Logging. **Never use `console.*`** — `console.log("foo " + bar)` produces an unstructured `textPayload` that filters and dashboards can't query. Use the v2 logger instead, with a structured second arg:

```ts
import { logger } from 'firebase-functions/v2';

logger.info('Migrated persons', {
  handler: 'onOccupationProposalApproved',
  proposalId,
  pendingOccupation: name,
  migratedCount: snap.size,
});
```

> **See also:** the `cloud-function-logging` skill for the rationale and severity guidance.

The second arg becomes searchable `jsonPayload` fields in Cloud Logging. Always include a `handler` field so you can filter by Cloud Function name. Use `logger.warn` for recoverable anomalies and `logger.error` only when the function bails out unsuccessfully.

This rule is enforced by [functions/src/__tests__/helpers/no-console.test.ts](functions/src/__tests__/helpers/no-console.test.ts) — any `console.*` call under `functions/src/` (outside `__tests__/`) fails the build.

### File naming

- React components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Services and models: `camelCaseService.ts`, `entityName.ts`
- Test files: colocated as `*.test.ts`

### Commit messages

Conventional commits, enforced by commitlint:

```
feat(scope): short imperative summary
fix(scope): ...
refactor(scope): ...
docs(scope): ...
chore(scope): ...
ci(scope): ...
```

Header ≤ 100 chars. Direct-to-`develop` is fine for small self-contained changes; `beta` and `main` advance only via promotion PRs (see the branch model under Development workflow).

### Versioning & releases

- **Store release is in progress; the web build is still the only shipped surface.** Web (Expo web export → Firebase Hosting) deploys on every promotion. The Android/iOS store release is being set up now — see [docs/plans/ongoing/store-release.md](docs/plans/ongoing/store-release.md) for the runbook and the current state of the external (Play Console / App Store Connect) side. Store **binaries**: a merge to `beta` builds and submits to Play's **closed** track automatically ([beta-build-and-submit.yml](.github/workflows/beta-build-and-submit.yml)); **production is never automatic** and moves only by an explicit `mobile-release` dispatch. The **JS bundle** is a separate matter — see *OTA updates* below.
- **Closed-track releases are automatic from `beta`.** Closed testing is not a public release, and Play's "12 testers for 14 continuous days" clock only advances while testers actually *have* builds — every manual step in that loop is a day the clock does not move. So `beta` builds the **`production` EAS profile** (package `com.cultuvilla.app`; the requirement is per package name, so a `com.cultuvilla.app.beta` build earns nothing) and auto-submits to the closed track. Production rollout stays a deliberate `mobile-release` dispatch.
  - It needs `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` as a **repo-level** secret and fails fast with a pointer to the runbook when it is absent.
  - It deliberately declares **no GitHub `environment`**: the `Production` environment's branch policy allows only `main`, so naming it from a `beta` trigger would be rejected before any step ran.
  - Locked by [storeRelease.test.ts](packages/shared/test/ci/storeRelease.test.ts).

- **OTA updates (`beta` only).** A merge to `beta` publishes the JS bundle to the `beta` EAS Update channel via [mobile-ota.yml](.github/workflows/mobile-ota.yml), so a fix reaches apps that are **already installed** instead of waiting for a store binary. This is the one thing that does auto-publish on a merge, and it exists because of a concrete failure: a native-only layout bug (`h-full` on `DetailInfoCard`) was fixed the same day it was reported and still could not reach a single user — the newest binary was four days old, there was no channel, and `mobile-release` had no Play credentials.
  - **`runtimeVersion` is `fingerprint`, never `appVersion`** ([app.config.ts](apps/mobile/app.config.ts)). We bump the MINOR on every `develop → beta` promotion, so an `appVersion` policy would strand each update against the binaries already installed — silently recreating the problem OTA solves. Locked by [otaUpdates.test.ts](packages/shared/test/ci/otaUpdates.test.ts).
  - **OTA carries JS and assets, never native code.** Adding a config plugin or a native module changes the fingerprint, and EAS then correctly refuses to serve the update to older binaries. Those changes still need `mobile-release` (and the `expo-native-rebuild` skill).
  - **`production` is deliberately NOT automatic.** Pushing to real users is a release decision, not a side effect of a merge; publish it with a manual `workflow_dispatch` on the same workflow.
  - **A binary only receives updates if it was built after `expo-updates` landed** and its profile names a channel (all of `preview-dev` / `preview-beta` / `production` do). Testers on an older build need one manual install before OTA reaches them at all.

- **Deep links:** the per-env association files (`apps/mobile/public/.well-known/{env}/{apple-app-site-association,assetlinks.json}`) are copied into place at hosting-deploy time by `apps/mobile/scripts/copy-well-known.mjs`. Signing identities are **committed** there, not injected from CI — they ship in a world-readable file, so there is nothing to hide, and a value in git is reviewable and identical for a local deploy. `prod` carries the real Apple Team ID and the Play **app signing** SHA-256 (Play re-signs every AAB, so it is never the upload key); `dev` and `beta` still hold `REPLACE_SHA256_FINGERPRINT_*` and get theirs when those builds are distributed. An env with a placeholder simply opens the web build instead of the app — expected, not a bug. What must always work is that every deep link resolves as a real **web route** (each share URL, including invite `…/join` paths, needs a matching file under `apps/mobile/app/**`).
- **Marketing version** (`app.config.ts` `version`, semver `MAJOR.MINOR.PATCH`) is the single source of truth; `apps/mobile/package.json` mirrors it. MAJOR = redesign/breaking migration, MINOR = new feature, PATCH = fixes.
- **Pre-release (now): stay on `0.x`.** Until the app is actually published to the stores, the MAJOR stays `0` — do **not** jump to `1.0.0`. Bump the **MINOR** on every `develop → beta` promotion (`0.1.0 → 0.2.0 → …`) as a running counter to track what's on beta. The `1.0.0` bump happens once, at the first real store release.
- **Set the version in the `develop → beta` promotion PR** (beta = release candidate); it rides unchanged into `main`. Build numbers auto-increment (EAS `appVersionSource: remote`). **CI enforces this**: `.github/workflows/version-gate.yml` fails any PR targeting `beta` whose `app.config.ts` `version` isn't strictly greater than beta's, so the bump can't be forgotten. Use the `prepare-release` skill to do it.
- **The version-bump commit message is the bare version string** — `0.10.0`, not `chore(release): 0.10.0`. commitlint (`commitlint.config.cjs`) has an `ignores` rule that exempts exactly a `X.Y.Z` header; every other commit still follows conventional commits. The bump commit contents are `apps/mobile/app.config.ts` + `apps/mobile/package.json` + the `CHANGELOG.md` stamp.
- **Force-update gate is dormant pre-release.** `config/appVersion.minSupported` is `0.0.0` (never blocks) while unreleased; keep `latest` in step with the current `app.config.ts` version. Only raise `minSupported` above `0.0.0` once real store clients exist.
- **`config/appVersion` is written from CI, not from a laptop.** It is a Firestore doc, so it is the one release step that is neither a code deploy (automatic on merge) nor a data migration (the backfill registry). Use **Actions → "Set App Version"** ([set-app-version.yml](.github/workflows/set-app-version.yml)) — keyless via WIF, dry-run by default. Blank `latest` means "the current `app.config.ts` version"; blank `min_supported` **preserves** whatever is stored, so a routine release can never accidentally un-wall the fleet. Locally the same script is `node scripts/seed-app-version-config.mjs --env=<env> [--latest=] [--min=] [--dry-run] [--confirm]`.
- **The `vX.Y.Z` tag is created by CI**, by the `tag` job in [deploy-prod.yml](.github/workflows/deploy-prod.yml), once the prod deploy is green — so a tag always names a commit that actually shipped. Don't tag by hand. It reads the version from `apps/mobile/package.json` and is idempotent, so a re-run (transient push failure, or re-deploying the same commit) succeeds rather than failing on an existing tag. It cannot retro-tag a release older than the job itself: a re-run uses the workflow file as it was at that commit. `v0.21.0` shipped before this existed and was tagged by hand — the only one.
- **CHANGELOG:** on a cut release, stamp the version into the section heading (`## vX.Y.Z — YYYY-MM-DD`).
- **Force-update gate:** clients read `config/appVersion` on launch (`appConfigService`) and block/nudge via `resolveVersionGate`. When you ship a client-breaking backend change (see *No retrocompat shims*), bump that doc's `minSupported` to the version carrying the client fix, at release time — that is the one case where you pass an explicit `min_supported`, since moving the wall is a deliberate product decision and never a side effect.

### Delete > deprecate

If something is unused, delete it. Don't leave dead code, "removed: …" comments, or shim re-exports. Git keeps history; the codebase should reflect the present.

### No retrocompat shims unless asked

When changing the shape of data already in Firestore, surface the migration explicitly:

- Note the affected docs and field(s) in the commit body and the PR description.
- Add a backfill script under `scripts/` when the change can't be expressed as a Cloud Function trigger.
- **Register the backfill so the deploy can enforce it** — see *Backfills* below. A registered backfill declares a `phase`, and `pre-deploy` ones block the promotion until they have actually run against the target env. That, not a doc, is what makes "a backfill is pending" a checkable fact: the completion marker at `_admin/backfills/markers/{id}.{env}` is the source of truth.
- **Also mark it in the CHANGELOG.** Put a `**Migration:**` marker inline in that `[Unreleased]` entry naming the script (e.g. `**Migration:** existing rows are purged by re-running \`scripts/backfill-municipality-people.mjs\` (per env)`). The `prepare-release` skill greps the stamped version block for `**Migration:**` and emits a per-env checklist into the `develop → beta` / `beta → main` promotion PRs. The registry is the *enforcement*; this marker is the human-readable release story that says which data moved and why.
- Don't leave dual-read code, shim re-exports, or `// removed: …` comments. Pairs with the `### Delete > deprecate` rule above.
- If the change breaks older store clients, raise `config/appVersion.minSupported` to the fixed version at release time (see *Versioning & releases*).

Only add a compatibility layer when the user explicitly asks for one (e.g. when an in-flight client release would break without it).

### Backfill dev when a schema field is added

Reads route through a **strict** Zod converter ([makeConverter](packages/shared/src/firebase/converters/makeConverter.ts) → `schema.parse`), so a doc missing a newly-added field makes the converter *throw* and crashes whatever screen reads that collection. When a feature adds or tightens a model field, backfill the existing dev docs (`villa-events`) in the same change — don't leave the field optional just to tolerate stale data (that's a retrocompat shim; see above).

- **Dev backfill is autonomous — no confirmation needed.** Dev (`villa-events`) is safe to mutate; an agent implementing a feature may write and run the backfill script directly. Beta/prod stay off-limits (CI / explicit user instruction only — see `firebase-admin-dev` skill).
- Write the backfill as a one-off, idempotent `scripts/backfill-<thing>.mjs` **registered on the harness** (mirror `scripts/backfill-municipality-namelower.mjs`): only patch docs missing the field, set the same default the model builder uses, and give it `phase: 'pre-deploy'` so the promotion to beta/prod blocks until it has run there. See *Backfills* above.
- Verify with **`pnpm check:dev-conformance`** ([scripts/check-dev-conformance.mjs](scripts/check-dev-conformance.mjs)) — it walks every dev collection through its converter and reports nonconforming docs. Run it before and after the backfill. It needs credentials, so it is **not** part of the `pnpm check` CI gate; run it manually against dev after schema changes.
- **Beta/prod are gated automatically, twice.** Every `develop → beta` and `beta → main` deploy runs, *before* any `firebase deploy` and against the target env's live data (via the WIF service account): the **conformance gate** (this same check — does the stored data parse under the shipped converters?) and the **backfill gate** (`pnpm backfills:verify` — has every `pre-deploy` backfill actually run here?). Either one failing blocks the whole promotion instead of shipping a converter crash. See the "Conformance gate" and "Backfill gate" steps in [.github/workflows/deploy-firebase.yml](.github/workflows/deploy-firebase.yml); the wiring is locked in by [conformanceGate.test.ts](packages/shared/test/ci/conformanceGate.test.ts) and [backfillGate.test.ts](packages/shared/test/ci/backfillGate.test.ts). So the practical rule is: backfill the target env before promoting, or the promotion's deploy will block.

- **Backfill the source before the projection, then the projection again.** A projection trigger (`syncMunicipalityPeople`, `syncPersonDenormalization`, …) writes its read model with a full `set()`, not a merge. On beta/prod the *currently deployed* trigger predates the new field, so patching the source collection fires it and it rewrites every projected row **without** the field — silently undoing a projection backfill you already ran. Backfilling `persons.isPublic` on beta wiped the `municipalityPeople.isPublic`/`barrioId` rows it had just written. The deploy can't go first (the gates block on the un-backfilled data), so the order is: **source collection first → let the old trigger clobber → re-run the projection backfills → verify conformance → promote.** Re-check conformance immediately before merging the promotion PR: any write to the source in between re-clobbers the projection until the new trigger is deployed.

### Backfills

A backfill is a script that mutates existing Firestore data to match a schema
change. **Code deploys on merge; data does not** — so every backfill is
registered, and the deploy verifies it actually ran against the env being
promoted to.

Registered backfills live under `scripts/` as a `.mjs` exporting `meta` + `run`:

```js
import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { backfillCollection } from './lib/backfill.mjs';

export const meta = {
  id: 'barrio-resident-count',   // kebab-case; == _admin/backfills/markers/{id}
  kind: 'backfill',              // backfill | cleanup | migration | audit
  description: 'why this exists, in one line',
  phase: 'pre-deploy',           // pre-deploy | post-deploy | none
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'], // envs the deploy runs this on unattended
  dependsOn: [],                 // ids that must run BEFORE this one
};

export async function run({ db, apply, log }) {
  // must honour `apply` — without it the run is a dry run and writes nothing
  return await backfillCollection(db, 'label', db.collection('x'), patchFor, { apply });
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
```

**`phase` is the load-bearing field**, and it is about ordering around the
deploy, not about a version. The strict Zod converters make it bidirectional:

| phase | meaning | deploy behaviour |
|---|---|---|
| `pre-deploy` | new code can't read old data (adding a required field) | **blocks** the deploy until the marker exists |
| `post-deploy` | old code can't read new data (dropping a field) | **warns** — blocking would deadlock |
| `none` | never gates (audits; one-offs already run everywhere) | ignored |

**`autoApply` is the default for an additive, idempotent `pre-deploy` backfill
— not the exception.** The deploy applies opted-in backfills itself, first,
before both gates, so the migration and the code that needs it land in one
green run. Leaving it empty means every promotion stops until a human dispatches
"Run Backfill" per env — and it stops *badly*: the deploy fails at the gate,
someone runs the script, someone re-runs the deploy. The 0.21.0 release did that
twelve times for six purely additive migrations. `pnpm backfills:lint` warns
about an idempotent `pre-deploy` backfill with an empty `autoApply`. Opt out
deliberately (destructive, non-idempotent, or needs a human reading the diff),
not by default.

**`dependsOn` declares run order.** Without it, auto-apply runs in `meta.id`
alphabetical order, which is not a safe order for a **projection**. A backfill
that writes a read model must declare the source-collection backfills it
follows — patching a source fires the currently-deployed trigger, which rewrites
projected rows with a full `set()` that predates the new field and silently
undoes projection work already done. `registration-person-denorm` is the worked
example. A cycle is an error, not a coin flip.

**The marker is the source of truth.** A successful `--apply` writes
`_admin/backfills/markers/{id}.{env}` with `{ completedAt, gitSha, actor, counts }`.
`_admin/**` is denied to all clients in `firestore.rules` (the Admin SDK bypasses
rules); a client-writable marker would let anyone wave a nonconforming schema
through the gate.

**Running one needs no local credentials.** Beta/prod enforce
`iam.disableServiceAccountKeyCreation`, so there is no key to hand out. Use
**Actions → "Run Backfill"** ([run-backfill.yml](.github/workflows/run-backfill.yml)),
which authenticates keylessly via the same WIF service account the deploy uses.
It is dry-run by default, always dry-runs before applying, and is dispatchable
via the GitHub API — so an agent can drive a migration it has no credentials
for. Locally, dev is autonomous; beta/prod need `--confirm`.

```bash
pnpm backfills:list                                   # the registry (no credentials needed)
pnpm backfills:verify --env=beta                      # what the deploy gate checks
pnpm backfills:run --id=<id> --env=dev                # dry run
pnpm backfills:run --id=<id> --env=dev --apply        # writes + records the marker
pnpm backfills:test                                   # registry unit tests
```

**Gotchas.**

- **`_admin` paths need an EVEN number of segments.** `_admin/backfills/markers/{id}`
  (4) is a document; `_admin/backfills/{id}` (3) is a collection and `db.doc()`
  throws on it at runtime.
- **Discovery imports every registered module**, so the `isMain(import.meta.url)`
  guard is what stops `backfills:list` from *running* all of them. It is covered
  by a test that fails if the guard is dropped.
- **`autoApply` opts a backfill into running unattended on every deploy.** Only
  for provably additive, idempotent work — `validateMeta` rejects the opt-in on
  a non-idempotent backfill. It runs **before both gates**, since it writes the
  data the conformance gate reads; that ordering is locked by
  [backfillGate.test.ts](packages/shared/test/ci/backfillGate.test.ts).
- **A backfill only reaches beta/prod once its script is on that branch.** The
  `beta` / `production` GitHub Environments are branch-restricted, so
  `run-backfill.yml` must be dispatched with `ref: beta` / `ref: main` — a
  dispatch from `develop` is rejected in ~2s before any step runs. That is the
  circularity `autoApply` dissolves: the deploy already runs on the right branch
  with the right credentials, so a self-applying migration never needs a
  manual dispatch at all.
- **Six legacy scripts** predate the registry and are not on it.
  `pnpm backfills:lint` warns about them in CI without failing. Convert
  opportunistically; register anything new. The other ~16 were spent one-offs
  and have been deleted (*Delete > deprecate*) — what survives is the set with a
  live pointer: five are the **backfill-of-record** named in
  [denormalized-read-models.md](docs/architecture/denormalized-read-models.md)
  for a read model that could still drift, and one is wired to a `package.json`
  script. Deleting those would throw away the answer to "how do I repopulate
  this?", so retire one only after its entry in that doc goes too.

### Comments

Don't explain *what* the code does — name things well instead. Only comment to explain *why* something non-obvious is the way it is: a security constraint, a Firestore quirk, a workaround for a specific bug.

## Commands

```bash
pnpm install          # workspace deps (functions has its own — npm ci in functions/)
pnpm app:start        # Expo dev server (apps/mobile)
pnpm check            # lint + typecheck + test + build (CI gate)
pnpm lint             # eslint --max-warnings 0 in packages/shared + functions
pnpm typecheck        # tsc --noEmit in shared, functions, i18n, mobile
pnpm test             # vitest (shared) + jest (mobile) + functions, under emulators
pnpm backfills:list   # registered data migrations (see Backfills)
```

Pre-commit (Husky + lint-staged) currently only formats `*.{json,md,yml,yaml}`; commit-msg runs commitlint. The lint/typecheck/test gate runs via `pnpm check` and in CI, not on commit.

### Dev seed data

`pnpm seed:dev` populates the dev Firestore (`villa-events`) with a named dataset from [scripts/data/seed-fixtures/](scripts/data/seed-fixtures/). Each dataset folder is `<name>/fixtures.mjs`, an optional `images.manifest.mjs`, and an `images/` folder whose files get uploaded to Cloud Storage and wired into the seeded docs. The seeders live under [scripts/seed/](scripts/seed/) — one per domain, sharing [scripts/seed/lib/](scripts/seed/lib/); [scripts/seed/all.mjs](scripts/seed/all.mjs) is the orchestrator.

```bash
DATASET=demo_1 pnpm seed:dev          # seed everything (users → villages → orgs → places → events → news)
DATASET=demo_1 pnpm seed:dev:wipe     # remove just that dataset (reverse order)
```

`DATASET` defaults to `demo_1` (the showcase dataset). Requires `GOOGLE_APPLICATION_CREDENTIALS` (same key as the escudos uploader). See `firebase-admin-dev` skill.

Each domain also runs à la carte (resolves its dependencies by email / deterministic ID), e.g. `pnpm seed:dev:news` or `pnpm seed:dev:events:wipe`. Available: `users`, `villages`, `orgs`, `places`, `events`, `news`.

Images are **generated or pre-downloaded once, never fetched at seed time**; either way the results are committed.

- **`demo_1` is drawn, not photographed** — `pnpm seed:images:generate` ([generate-demo-images.mjs](scripts/seed/generate-demo-images.mjs)) renders every asset as a flat brand-coloured card carrying a glyph for what it depicts. It replaced Lorem Picsum because random photos were *actively misleading*, not merely generic: "Casa Consistorial" was a person in a beanie and "Ayuntamiento de Aranjuez" was a camera — and those images are what the Play Store screenshots are built from. We cannot license real photos of Aranjuez, so the honest alternative is imagery that is obviously illustrative. Output is deterministic (palette from a hash of the filename), so re-running makes no diff.
- **Other datasets still download** — `DATASET=real_villages_1 pnpm seed:images` reads that dataset's `images.manifest.mjs` ([prepare-images.mjs](scripts/seed/prepare-images.mjs)) and resizes with sharp.

Image-capable entities: user/persona photo, village escudo, barrio, place, organization, event `imageURL`, news `images[]`.

To activate real villages via the **actual organizer-request → admin-approval flow** (rather than direct seeding), use the sibling script:

```bash
DATASET=real_villages_1 pnpm seed:villages          # default DATASET
DATASET=real_villages_1 pnpm seed:villages:wipe
```

It assumes `pnpm seed:dev` has been run (so the requester + approver users exist) and `pnpm seed:municipalities` has been run (so the target municipality with the matching `codigoINE` exists). Doc writes replay what the `requestOrganizeVillage` / `respondToOrganizerRequest` Cloud Functions do — `organizerRequests` records the audit trail.

### Mobile app

Mobile code lives in [`apps/mobile/`](apps/mobile/). It is an Expo SDK 56 / Expo Router 56 / NativeWind v4 React Native app that consumes `@cultuvilla/shared` and `@cultuvilla/i18n` from the monorepo.

**Boot**

```bash
# JS-only reload (most changes)
pnpm --filter cultuvilla-mobile exec expo start

# If you have a dev-client installed on device/emulator:
pnpm --filter cultuvilla-mobile exec expo start --dev-client

# Remote device (tunnels Metro through Expo's servers):
pnpm --filter cultuvilla-mobile exec expo start --tunnel
```

**Tests / typecheck**

```bash
pnpm app:test                                  # jest suite for apps/mobile
pnpm app:typecheck                             # tsc --noEmit for apps/mobile
```

**Key conventions**

- **Primitives**: `Screen`, `HStack`, `VStack`, `Text`, `Pressable`, `Button`, `Card`, `Input`, and more live under `apps/mobile/components/primitives/`. Compose them rather than dropping to raw `<View>` + NativeWind where a primitive fits.
- **Image uploads**: use `pickImageAsBlob` (returns a `Blob`) and pass it to `imageService`. Never import from `firebase/storage` directly in mobile screens — route through the service.
- **i18n**: add new strings to `packages/i18n/messages/es.json` (nested JSON), consumed via the thin `useT()` adapter in `apps/mobile/lib/i18n.tsx`. Dotted-path lookup works (the adapter walks the object on `.` splits).
- **EAS Build profiles**: `development` / `preview-dev` / `preview-beta` / `production` (defined in `apps/mobile/eas.json`) map to the `villa-events` / `cultuvilla-beta` / `cultuvilla-prod` Firebase environments via `APP_ENV`. Keep them in sync when Firebase config changes. `production` reads its Firebase values from the **EAS `production` environment** (`eas env:list --environment production`), not from `.env` or GitHub — `app.config.ts` is evaluated on the EAS build server.
- **EAS Submit profiles**: `internal` / `closed` / `production` map to the Play tracks `internal` / `alpha` / `production`. All three submit the **same** `production` build (package `com.cultuvilla.app`, Firebase `cultuvilla-prod`) — so **a store tester is a production user**, on every track. Two reasons, and the second outranks the first: Play's closed-testing requirement is per package name, so a `com.cultuvilla.app.beta` build earns nothing toward it; and a separate package is a separate *install*, with its own FCM token, its own Google Sign-In Android OAuth client and its own App Links verification, so a tester moving to production would be installing a second app rather than updating one. The `.dev` / `.beta` identifiers are **sideload-only and must never reach a Play track** — that is the lever to pull if a beta build should ever point at `cultuvilla-beta` again. `cultuvilla-beta` remains the *backend* staging env (promotion deploys + the conformance/backfill gates), not a client env. Read [docs/decisions/store-tracks-share-prod.md](docs/decisions/store-tracks-share-prod.md); locked by [packages/shared/test/ci/storeRelease.test.ts](packages/shared/test/ci/storeRelease.test.ts).
- **App Check**: the `initMobileAppCheck` seam is wired in the app bootstrap but is a no-op. Do not remove it — it will be activated when the product opts in. Leave it untouched unless explicitly asked.
- **Native rebuilds**: after installing a package that ships an Expo config plugin, or after changing the `plugins` array in `apps/mobile/app.config.ts`, run a clean prebuild. See the `expo-native-rebuild` skill.

### Never start long-lived dev servers

You (Claude) **may** run the emulator-backed test suites yourself — they boot
*ephemeral* Firebase emulators via `scripts/run-tests-with-emulators.mjs` and tear
them down when the run ends, so they don't collide with anything. In worktree mode,
prefer targeted tests/typechecks locally and let the PR's CI run the full gate. In
direct-to-`develop` mode, run the full gate locally before committing:

- `pnpm check` (the full gate), `pnpm test`, `pnpm test:emulators`,
  `pnpm test:integration`, `pnpm test:rules`, `pnpm test:functions`

Still off-limits — these run indefinitely (the user owns that iteration loop) or
bypass CI:

- `pnpm app:start` / `expo start` (Expo/Metro dev server)
- `firebase emulators:start` directly (standalone long-lived emulator session)
- Any deploy script (`pnpm deploy:*`) — use the `firestore-deploy` skill instead

If you need output from a long-lived server you can't start (Metro, a standalone
emulator session), ask the user to run it and paste the relevant lines.

## Development workflow

All non-trivial changes follow the same loop. Tiny edits (typo in a doc, a renamed string) can skip steps 1 and 4, but any code change goes through every step.

**Branch model (three-tier):** `develop` → `beta` → `main`, each mapped to a Firebase
environment (dev `villa-events`, beta `cultuvilla-beta`, prod `cultuvilla-prod`).
Merging into a branch auto-deploys backend + hosting to its env via CI — prod
included, with no manual approval step; `main` is production and **forbids direct
pushes** (merge-from-`beta` only). The `production` GitHub Environment still
restricts which branch may deploy (branch policy), but no longer requires a
reviewer. All daily work targets `develop`. See
[docs/decisions/dev-beta-prod-environments.md](docs/decisions/dev-beta-prod-environments.md).

1. **Classify the mode from the diff — never ask.** See the Autonomy contract below.
   - **Direct** — the diff touches *only* `docs/**`, `*.md`, `CHANGELOG.md`, `.agents/**`, `.claude/**`. Commit and push straight to `develop` in the base checkout. No branch, no PR.
   - **Autonomous (everything else)** — branch from the latest `develop` into a worktree under `.claude/worktrees/<short-name>/` and work there. Never edit the base checkout in this mode. Worktrees isolate dependencies, build outputs, and caches so parallel changes don't fight each other, and they make it easy to abandon work that doesn't pan out.

   **The VSCode checkout must always stay on `develop`** — never run `git checkout`/`git switch` to a feature branch in the open editor workspace. A feature branch always lives in its own worktree, created with `git worktree add` and committed to from there, so the VSCode view never leaves `develop`. (Never commit directly to `beta` or `main` — those advance only by promotion PRs.)
2. **Read any in-flight plan** in [docs/plans/](docs/plans/) and the relevant record in [docs/decisions/](docs/decisions/) for the feature area.
3. **Look at the relevant service** in [packages/shared/src/services/](packages/shared/src/services/) before writing UI code; extend the service if the API you need is missing.
4. **Add or extend tests whenever possible.** Tests are the contract that survives refactors and AI rewrites. Specifically:
   - Pure logic, model builders, validation, and service helpers go in `packages/shared/test/` (vitest).
   - New ESLint rules, type-level contracts, or other "this must keep working" invariants get a test that fails if the invariant breaks (see [packages/shared/test/eslint/rules.test.ts](packages/shared/test/eslint/rules.test.ts) for the pattern).
   - If a change is genuinely untestable today (UI-only, no extractable logic), say so in the PR description and explain why.
5. **Keep documentation in sync.** If you add a new collection or denormalized field, update [packages/shared/src/services/_services-map.md](packages/shared/src/services/_services-map.md) and [docs/architecture/denormalized-read-models.md](docs/architecture/denormalized-read-models.md) in the same change. Note user-facing changes in [CHANGELOG.md](CHANGELOG.md) under `## [Unreleased]`.
6. **Verify according to the selected mode.** In a worktree, run the relevant targeted tests/typechecks, push promptly, and use the PR's GitHub CI result as the authoritative full `pnpm check` gate — do not duplicate the entire gate locally by default. Direct-to-`develop` has no PR gate, so run `pnpm check` locally before committing.
7. **Open a pull request** with `gh pr create` targeting `develop`. A PR is a written record of what changed and why, and lets CI gate the change before it touches `develop` (and, via promotion, beta/prod). The PR description should cover:
   - **What** changed at a level the future reader needs (not a diff restatement).
   - **Why** it was done — the motivating problem or design decision.
   - **Tests** that were added (or an explicit note if none were possible).
   - **Test plan** as a checklist: targeted local checks, full CI gate, manual verification steps.
8. **Land it with `pnpm pr:land`.** It opens the PR, watches CI, applies the rebase and hard-stop rules below, and merges when the bar is met. Run it, act on the exit code, run it again: `0` merged · `10` CI red · `20` review requested changes · `30` **hand to a human** · `40` preflight failed. Steps 7, 9 and 10 are what it automates — don't hand-roll them. **A green PR merges itself** — see the Autonomy contract for what that bar is and what it deliberately excludes.
9. **Before merging, rebase the branch onto the latest `develop`.** `git fetch origin develop && git rebase origin/develop`, resolve any conflicts, run targeted checks for the affected/conflicted areas, then `git push --force-with-lease`. CI must run the full gate and go green again on the rebased commits before the merge. Stale branches cause silent breakage when the merge crosses a refactor that landed on develop while the PR was in review. (Promotion PRs `develop → beta` and `beta → main` follow the same rebase-then-green rule.)
10. **Merge with a merge commit, not squash or rebase.** Use `gh pr merge <n> --merge`. Squashing would collapse the carefully-scoped commits in the PR (e.g. "feature" + "test for feature") into one, which makes `git bisect` and `git blame` worse. Rebase-merging hides the PR boundary entirely. A merge commit preserves both.
11. **If you broke a rule in this file deliberately**, update this file in the same PR.

## Autonomy contract

**The user is a decider, not a merge gate.** A change should cost them two messages: their request, and one decision. The `ship-a-feature` skill owns the procedure — front-load every business and technical question into ONE message with a recommended pick on each, take `go` as "all your picks", then implement and land without check-ins.

- **`ship-a-feature` and `managing-plans-lifecycle` are shared, not local.** Both are symlinks into the `.agents/_shared` submodule ([agent-skills](https://github.com/alvaro-francisco-gil/agent-skills)), consumed by several repos. **Do not edit them to fix something about this repo** — they carry procedure only. Every Cultuvilla-specific value lives here and in `.agents/land.config.json`. Run `git submodule update --init` after cloning, or the skills are empty.
- **Merge bar: CI green. The agent merges to `develop` itself** — the user is not the gate, on an explicit decision (2026-08-22). Say plainly what that costs: no `ai-review` reviewer is wired here yet, so **nothing reads the diff but the test suite**. This is a weaker bar than ordago's, not an equal one. It is bounded rather than unbounded: the hard-stop list below still never self-merges, the vacuous-green guard still refuses to read "no run dispatched" as "tests passed", and `develop` is not a release branch — a bad merge is caught before it reaches `beta`.
- **Restore the review requirement the day the reviewer works here.** Set `requireApprovingReview: true` in `land.config.json` — leaving it false past that point keeps the weaker bar for nothing.
- **Reviews reach this repo by poll, and cannot reach it any other way.** ordago gets an immediate trigger from a `request-review` job that calls homelab's reusable workflow. That is impossible here: **this repo is public and homelab is private**, and a public repo cannot call a private repo's reusable workflow. GitHub resolves the callee when it *creates* the run, before evaluating any job-level `if` — so such a job is not inert-until-enabled, it fails the entire workflow to load and takes every other job down with it. Don't add one back; it was tried on 2026-08-22 and run `32594475090` completed with zero jobs. This repo is already registered in homelab's `personal/agent-review.yml`, so the 15-minute poll backstop is the path. The cost is latency, not capability.
- **"No CI ran" is never "CI passed".** `ci.yml` has no `paths:` filter, so every PR here does dispatch a run — `land.config.json` records that as `ciPaths: ["**"]`. If a path filter is ever added, that value must change with it.
- **Rebase only when the base moved *into* your diff** — path intersection, or a `packages/shared/**` / lockfile / rules move. `pr:land` decides; don't pre-emptively rebase.
- **Hard-stop list — these never self-merge, however green:** `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `scripts/backfill*`, `packages/shared/src/firebase/converters/**`, and **any PR targeting `beta`/`main`**. "Green" answers *did the tests pass*, not *is the blast radius acceptable*.
- **A red lane is not automatically your bug.** Read the log before changing code.

**This repo overrides two `superpowers` skills.** `superpowers:brainstorming`'s one-question-per-message rule and `superpowers:finishing-a-development-branch`'s stop-and-ask merge menu are **superseded by `ship-a-feature`**. Every other superpowers skill still applies.

## Things to flag in PRs (or right here when you find them)

- Logic that bypasses a service.
- New `as any` / `@ts-nocheck` / `// eslint-disable`.
- New `<img>` usage when image optimization could matter.
- Reads in components that should be cached or batched.
- Spanish strings that escaped the i18n message catalog.
- Code changes that ship without tests when tests were possible.
- Work that landed outside a worktree when the diff was **not** Direct-path-only (see Development workflow step 1) — and so might have polluted the `develop` base checkout state.
- A hand-rolled `gh pr merge` instead of `pnpm pr:land` — it skips the vacuous-green, staleness and hard-stop checks.

## Be proactive

Surface these as a one-line suggestion (or an inline diff if the change is under ~10 lines) at the end of your response, when you notice:

- **Repeated manual ops (2+ times)** → script in `scripts/`.
- **Encodable workflow** (deploy recipe, migration ritual, audit playbook) → skill under `.claude/skills/<name>/SKILL.md`.
- **Convention used in 3+ places but undocumented** → addition to this file, or a new sub-directory `AGENTS.md` (e.g. `functions/AGENTS.md`, `packages/shared/AGENTS.md`, `apps/mobile/AGENTS.md`) so agents working there don't load the whole root file.
- **Single source of truth violated** (duplicated enum, status string, threshold, hex colour) → consolidate in the same commit if small, propose a follow-up if not.
- **Docs contradicting code** → fix or delete the doc; don't work around it.
- **Shipped plan still in `docs/plans/ongoing/`** → distil durable rationale into `docs/decisions/<slug>.md`, then delete the plan (code is the source of truth). See the `managing-plans-lifecycle` skill. Don't archive — there is no `docs/archive/`.
- **Service touched without tests** → propose adding the missing coverage.
