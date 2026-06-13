# AGENTS.md

North star for anyone (human or AI) modifying this repo. Short, opinionated, load-bearing. When this file disagrees with code, the file wins — fix the code.

## What this project is

Cultuvilla is a mobile-first web app for Spanish village communities. Organizations (ayuntamientos, peñas, asociaciones) publish events; residents and visitors discover them, sign up themselves and family members ("personas"), and village admins manage invites and org approvals.

Design work lives under [docs/plans/](docs/plans/) by lifecycle stage (`ideas/` → `ready/` → `ongoing/`); durable rationale for shipped work is distilled into [docs/decisions/](docs/decisions/). **The code is the source of truth for *what* exists**; this file is the source of truth for *how* to build. See the `managing-plans-lifecycle` skill for where a given doc belongs. There is no `docs/superpowers/` or `docs/archive/`.

## Repo health beats every rule below

If a rule here makes the repo worse for a specific change, break the rule and update this file in the same PR. Rules exist to keep the codebase coherent, not to be obeyed mechanically.

## Architecture invariants

### 1. Service-layer ownership

Components, pages, and hooks **must not** import from `firebase/firestore`, `firebase/storage`, `firebase/functions`, or `firebase/auth` directly. All Firebase access goes through a service in [packages/shared/src/services/](packages/shared/src/services/). See [_services-map.md](packages/shared/src/services/_services-map.md) for the catalogue.

- Need `GeoPoint`, `Timestamp`, or the `User` type? Import from `@cultuvilla/shared/firebase` (the shared package re-exports them).
- The **only** exempt file is [apps/web/contexts/AuthContext.tsx](apps/web/contexts/AuthContext.tsx) — it owns the auth boundary (sign-in/out, listeners). Everything else routes through services.

This is enforced by `no-restricted-imports` in [apps/web/eslint.config.mjs](apps/web/eslint.config.mjs). If you find yourself wanting to disable it, add a service instead.

> **See also:** the `touch-service` and `guardrail-enforcement` skills for the procedures.

**Why:** Firebase SDK calls scattered through UI code are the #1 source of duplicate reads, missing security checks, and broken offline behaviour. One place per collection. One place to add caching or migrate when needed.

### 2. Shared types, shared models

Anything that crosses workspace boundaries — between web, functions, and any future mobile app — lives in [packages/shared](packages/shared). Domain types live under `src/models/`, organized by entity (event, village, person, etc.). Services consume models, never the reverse.

### 3. First-class top-level collections, scoped by `municipalityId`

Single Firebase project. Domain entities (`events`, `organizations`, `persons`, `occupations`, news, …) live at the **top level** of Firestore and carry a `municipalityId` field that scopes them to a village/municipality. The only nesting we keep is for data that is genuinely owned by a parent doc (e.g. `municipalities/{id}/members/{userId}`, `organizations/{orgId}/members/{userId}`, `events/{eventId}/registrations/{regId}`, `users/{uid}/notifications/{nid}`).

This is the result of the migration recorded in [docs/decisions/open-feed-architecture.md](docs/decisions/open-feed-architecture.md): top-level keeps cross-village/global queries trivial, leaves the door open to multi-village orgs, and removes most of the collection-group indexing burden. Indexes on `municipalityId + <sortField>` (and similar single-collection composite indexes) are declared in [firestore.indexes.json](firestore.indexes.json) and must be added in the same change as a new query shape.

> **See also:** the `add-firestore-collection` skill for the multi-file checklist when adding a new collection.

### 4. Denormalized read models for high fan-out

When a query would require N reads or live across collection boundaries, write a denormalized read model and keep it in sync via a Cloud Function trigger. See [docs/architecture/denormalized-read-models.md](docs/architecture/denormalized-read-models.md) for the pattern; [functions/src/syncVillageDenormalization.ts](functions/src/syncVillageDenormalization.ts) is the canonical example.

> **See also:** the `denormalized-read-model` skill for the step-by-step.

### 5. Strict TypeScript

`strict: true` everywhere. No `any`. No `@ts-nocheck`. If a type is genuinely unknown at the boundary, use `unknown` and narrow. `@typescript-eslint/no-explicit-any` is an error in `apps/web`; the same standard applies in `packages/shared` and `functions` even though those aren't lint-gated yet — fix at the source, never silence with `as any`.

## Conventions

### Forms

Currently controlled inputs with `useState`. No form library yet. New forms should match the existing style until/unless we adopt `react-hook-form + zod` (see CHANGELOG — this is on the table).

### State and data fetching

React Context for cross-tree state (auth, village). No global store. No query cache today — every component fetches its own data via services. If you add a feature where this hurts (revalidation, optimistic updates, dedup), surface it in the PR rather than rolling your own cache.

### Styling

Tailwind v4 with a JS-based `tailwind.config.ts` (`apps/web/tailwind.config.ts`).
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

**Web primitives** live under [apps/web/components/primitives/]
(apps/web/components/primitives/) — `Screen`, `HStack`, `VStack`, `Text`,
`Pressable`, `Button`, `Card`, `Input`. New screens compose primitives;
inline `<div>` + Tailwind is fine where a primitive doesn't fit, but reach
for the primitive first. The same component names and prop API exist under
[apps/mobile/components/primitives/](apps/mobile/components/primitives/)
for the React Native app — any prop-level change must land in both.

Icons: `lucide-react` (web) / `lucide-react-native` (mobile). Pass
`iconSizes.sm | md | lg` for size — no ad-hoc `size={18}`.

### i18n

Messages live in [@cultuvilla/i18n](packages/i18n/) and are consumed by web
via next-intl (see `apps/web/i18n/request.ts`) and by the mobile app via
the thin `useT()` adapter in `apps/mobile/lib/i18n.tsx`. User-facing strings go
through `useTranslations()` (web) or `useT()` (mobile); hardcoded Spanish is
allowed only in dev-only surfaces (admin panels, debug pages) where i18n is
not a current priority — mobile has no admin surfaces in v1, so this
carve-out is web-only for now.

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

Header ≤ 100 chars. Direct-to-main is fine (see `feedback_push_main` in user memory) — keep commits small and self-contained.

### Delete > deprecate

If something is unused, delete it. Don't leave dead code, "removed: …" comments, or shim re-exports. Git keeps history; the codebase should reflect the present.

### No retrocompat shims unless asked

When changing the shape of data already in Firestore, surface the migration explicitly:

- Note the affected docs and field(s) in the commit body and the PR description.
- Add a backfill script under `scripts/` when the change can't be expressed as a Cloud Function trigger.
- Don't leave dual-read code, shim re-exports, or `// removed: …` comments. Pairs with the `### Delete > deprecate` rule above.

Only add a compatibility layer when the user explicitly asks for one (e.g. when an in-flight client release would break without it).

### Comments

Don't explain *what* the code does — name things well instead. Only comment to explain *why* something non-obvious is the way it is: a security constraint, a Firestore quirk, a workaround for a specific bug.

## Commands

```bash
pnpm install          # workspace deps (functions has its own — npm ci in functions/)
pnpm web:dev          # Next.js dev server
pnpm check            # lint + typecheck + test + build (CI gate)
pnpm lint             # eslint --max-warnings 0 in apps/web
pnpm typecheck        # tsc --noEmit in shared, web, functions
pnpm test             # vitest in packages/shared
```

Pre-commit (Husky + lint-staged) runs `eslint --max-warnings 0 --fix` on changed `apps/web` TypeScript files; commit-msg runs commitlint.

### Dev seed data

`pnpm seed:dev` populates the dev Firestore (`villa-events`) with a named dataset from [scripts/data/seed-fixtures/](scripts/data/seed-fixtures/). Each dataset folder is `<name>/fixtures.mjs` plus an `images/` folder whose files get uploaded to Cloud Storage and wired into the seeded docs.

```bash
DATASET=real_user_data_1 pnpm seed:dev          # seed
DATASET=real_user_data_1 pnpm seed:dev:wipe     # remove just that dataset
```

`DATASET` defaults to `random_data_1` (legacy throwaway data). Requires `GOOGLE_APPLICATION_CREDENTIALS` (same key as the escudos uploader). See `firebase-admin-dev` skill.

To activate real villages via the **actual organizer-request → admin-approval flow** (rather than direct seeding), use the sibling script:

```bash
DATASET=real_villages_1 pnpm seed:villages          # default DATASET
DATASET=real_villages_1 pnpm seed:villages:wipe
```

It assumes `pnpm seed:dev` has been run (so the requester + approver users exist) and `pnpm seed:municipalities` has been run (so the target municipality with the matching `codigoINE` exists). Doc writes replay what the `requestOrganizeVillage` / `respondToOrganizerRequest` Cloud Functions do — `organizerRequests` records the audit trail.

### Mobile app

Mobile code lives in [`apps/mobile/`](apps/mobile/). It is an Expo SDK 54 / Expo Router v4 / NativeWind v4 React Native app that consumes `@cultuvilla/shared` and `@cultuvilla/i18n` from the monorepo.

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

- **Primitives**: the same prop API as the web primitives (`Screen`, `HStack`, `VStack`, `Text`, `Pressable`, `Button`, `Card`, `Input`) is mirrored under `apps/mobile/components/primitives/`. Any change to the shared prop contract (new prop, renamed prop, removed prop) must land in both apps' primitives folders in the same commit.
- **Image uploads**: use `pickImageAsBlob` (returns a `Blob`) and pass it to `imageService`. Never import from `firebase/storage` directly in mobile screens — route through the service.
- **i18n**: add new strings to `packages/i18n/messages/es.json` (nested JSON). Both apps consume the same catalog: `apps/web` via next-intl, `apps/mobile` via the thin `useT()` adapter in `apps/mobile/lib/i18n.tsx`. Dotted-path lookup works in both (next-intl handles nested keys natively; the mobile adapter walks the object on `.` splits).
- **EAS Build profiles**: `dev`, `beta`, `prod` (defined in `apps/mobile/eas.json`) map to the same Firebase environments as the web app's env split. Keep them in sync when Firebase config changes.
- **App Check**: the `initMobileAppCheck` seam is wired in the app bootstrap but is a no-op. Do not remove it — it will be activated when the product opts in. Leave it untouched unless explicitly asked.
- **Native rebuilds**: after installing a package that ships an Expo config plugin, or after changing the `plugins` array in `apps/mobile/app.config.ts`, run a clean prebuild. See the `expo-native-rebuild` skill.

### Never start dev servers

You (Claude) do not start long-running processes — the user owns the iteration loop. Don't run:

- `pnpm web:dev` (Next.js dev server)
- `pnpm test:integration`, `pnpm test:rules`, `pnpm test:functions`, or `pnpm test:emulators` (they boot Firebase emulators that the user wants to keep alive)
- `firebase emulators:start` directly
- Any deploy script (`pnpm deploy:*`) — use the `firestore-deploy` skill instead

If you need output from a long-running service to verify a change, ask the user to run it and paste the relevant lines.

## Development workflow

All non-trivial changes follow the same loop. Tiny edits (typo in a doc, a renamed string) can skip steps 1 and 4, but any code change goes through every step.

1. **Work in a git worktree, not on main.** Branch from the latest `main` into a worktree under `.claude/worktrees/<short-name>/`. Never edit files in the main checkout. Worktrees isolate dependencies, build outputs, and `.next/` caches so parallel changes don't fight each other, and they make it easy to abandon work that doesn't pan out.
2. **Read any in-flight plan** in [docs/plans/](docs/plans/) and the relevant record in [docs/decisions/](docs/decisions/) for the feature area.
3. **Look at the relevant service** in [packages/shared/src/services/](packages/shared/src/services/) before writing UI code; extend the service if the API you need is missing.
4. **Add or extend tests whenever possible.** Tests are the contract that survives refactors and AI rewrites. Specifically:
   - Pure logic, model builders, validation, and service helpers go in `packages/shared/test/` (vitest).
   - New ESLint rules, type-level contracts, or other "this must keep working" invariants get a test that fails if the invariant breaks (see [packages/shared/test/eslint/rules.test.ts](packages/shared/test/eslint/rules.test.ts) for the pattern).
   - If a change is genuinely untestable today (UI-only, no extractable logic), say so in the PR description and explain why.
5. **Keep documentation in sync.** If you add a new collection or denormalized field, update [packages/shared/src/services/_services-map.md](packages/shared/src/services/_services-map.md) and [docs/architecture/denormalized-read-models.md](docs/architecture/denormalized-read-models.md) in the same change. Note user-facing changes in [CHANGELOG.md](CHANGELOG.md) under `## [Unreleased]`.
6. **Run `pnpm check` before pushing.** CI runs the same gate; failing locally is faster than failing in Actions.
7. **Open a pull request** with `gh pr create`, even though direct-to-main is technically allowed. A PR is a written record of what changed and why, and lets CI gate the change before it touches `main`. The PR description should cover:
   - **What** changed at a level the future reader needs (not a diff restatement).
   - **Why** it was done — the motivating problem or design decision.
   - **Tests** that were added (or an explicit note if none were possible).
   - **Test plan** as a checklist: local check, CI, manual verification steps.
8. **Wait for the user to confirm the merge.** Once the PR is open and CI is green, summarize the result and stop. Do **not** merge autonomously, even if every check passes — the human is the merge gate.
9. **Before merging, rebase the branch onto the latest `main`.** `git fetch origin main && git rebase origin/main`, resolve any conflicts, re-run `pnpm check`, then `git push --force-with-lease`. CI must go green again on the rebased commits before the merge. Stale branches cause silent breakage when the merge crosses a refactor that landed on main while the PR was in review.
10. **Merge with a merge commit, not squash or rebase.** Use `gh pr merge <n> --merge`. Squashing would collapse the carefully-scoped commits in the PR (e.g. "feature" + "test for feature") into one, which makes `git bisect` and `git blame` worse. Rebase-merging hides the PR boundary entirely. A merge commit preserves both.
11. **If you broke a rule in this file deliberately**, update this file in the same PR.

## Things to flag in PRs (or right here when you find them)

- Logic that bypasses a service.
- New `as any` / `@ts-nocheck` / `// eslint-disable`.
- New `<img>` usage when image optimization could matter.
- Reads in components that should be cached or batched.
- Spanish strings that escaped the i18n message catalog.
- Code changes that ship without tests when tests were possible.
- Work that landed outside a worktree (and so might have polluted main's checkout state).

## Be proactive

You're expected to propose improvements, not just execute tasks. End your response with a one-line suggestion (or an inline diff if the change is under ~10 lines) when you notice:

- **Repeated manual ops (2+ times)** → script in `scripts/`.
- **Encodable workflow** (deploy recipe, migration ritual, audit playbook) → skill under `.claude/skills/<name>/SKILL.md`.
- **Convention used in 3+ places but undocumented** → addition to this file, or a new sub-directory `AGENTS.md` (e.g. `functions/AGENTS.md`, `packages/shared/AGENTS.md`, `apps/web/AGENTS.md`) so agents working there don't load the whole root file.
- **Single source of truth violated** (duplicated enum, status string, threshold, hex colour) → consolidate in the same commit if small, propose a follow-up if not.
- **Docs contradicting code** → fix or delete the doc; don't work around it.
- **Shipped plan still in `docs/plans/ongoing/`** → distil durable rationale into `docs/decisions/<slug>.md`, then delete the plan (code is the source of truth). See the `managing-plans-lifecycle` skill. Don't archive — there is no `docs/archive/`.
- **Service touched without tests** → propose adding the missing coverage.

Soft proposals are the default — the user accepts or declines. Don't pre-implement large refactors uninvited; surface, then wait.
