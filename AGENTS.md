# AGENTS.md

North star for anyone (human or AI) modifying this repo. Short, opinionated, load-bearing. When this file disagrees with code, the file wins — fix the code.

## What this project is

Cultuvilla is a mobile-first web app for Spanish village communities. Organizations (ayuntamientos, peñas, asociaciones) publish events; residents and visitors discover them, sign up themselves and family members ("personas"), and village admins manage invites and org approvals.

The product surface and data model are specified in [docs/superpowers/specs/](docs/superpowers/specs/). Specs are the source of truth for *what* to build; this file is the source of truth for *how* to build it.

## Repo health beats every rule below

If a rule here makes the repo worse for a specific change, break the rule and update this file in the same PR. Rules exist to keep the codebase coherent, not to be obeyed mechanically.

## Architecture invariants

### 1. Service-layer ownership

Components, pages, and hooks **must not** import from `firebase/firestore`, `firebase/storage`, `firebase/functions`, or `firebase/auth` directly. All Firebase access goes through a service in [packages/shared/src/services/](packages/shared/src/services/). See [_services-map.md](packages/shared/src/services/_services-map.md) for the catalogue.

- Need `GeoPoint`, `Timestamp`, or the `User` type? Import from `@cultuvilla/shared/firebase` (the shared package re-exports them).
- The **only** exempt file is [apps/web/contexts/AuthContext.tsx](apps/web/contexts/AuthContext.tsx) — it owns the auth boundary (sign-in/out, listeners). Everything else routes through services.

This is enforced by `no-restricted-imports` in [apps/web/eslint.config.mjs](apps/web/eslint.config.mjs). If you find yourself wanting to disable it, add a service instead.

**Why:** Firebase SDK calls scattered through UI code are the #1 source of duplicate reads, missing security checks, and broken offline behaviour. One place per collection. One place to add caching or migrate when needed.

### 2. Shared types, shared models

Anything that crosses workspace boundaries — between web, functions, and any future mobile app — lives in [packages/shared](packages/shared). Domain types live under `src/models/`, organized by entity (event, village, person, etc.). Services consume models, never the reverse.

### 3. Data is nested under `villages/{villageId}/`

Single Firebase project. All village-scoped data is nested under that village's document; cross-village queries use Firestore **collection group** indexes (declared in [firestore.indexes.json](firestore.indexes.json)). When you add a new sub-collection, add the collection-group index in the same change.

### 4. Denormalized read models for high fan-out

When a query would require N reads or live across collection boundaries, write a denormalized read model and keep it in sync via a Cloud Function trigger. See [docs/architecture/denormalized-read-models.md](docs/architecture/denormalized-read-models.md) for the pattern; [functions/src/syncVillageDenormalization.ts](functions/src/syncVillageDenormalization.ts) is the canonical example.

### 5. Strict TypeScript

`strict: true` everywhere. No `any`. No `@ts-nocheck`. If a type is genuinely unknown at the boundary, use `unknown` and narrow. `@typescript-eslint/no-explicit-any` is an error in `apps/web`; the same standard applies in `packages/shared` and `functions` even though those aren't lint-gated yet — fix at the source, never silence with `as any`.

## Conventions

### Forms

Currently controlled inputs with `useState`. No form library yet. New forms should match the existing style until/unless we adopt `react-hook-form + zod` (see CHANGELOG — this is on the table).

### State and data fetching

React Context for cross-tree state (auth, village). No global store. No query cache today — every component fetches its own data via services. If you add a feature where this hurts (revalidation, optimistic updates, dedup), surface it in the PR rather than rolling your own cache.

### Styling

Tailwind 4. Utility classes inline. No CSS modules, no styled-components. `lucide-react` for icons.

### i18n

`next-intl` v4. Default locale is `es`. Messages in [apps/web/i18n/messages/](apps/web/i18n/messages/). User-facing strings go through `useTranslations()`; hardcoded Spanish is allowed only in dev-only surfaces (admin panels, debug pages) where i18n is not a current priority.

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

## When you are working on a change

1. Read the design spec in [docs/superpowers/specs/](docs/superpowers/specs/) if one exists for the feature area.
2. Look at the relevant service in [packages/shared/src/services/](packages/shared/src/services/) before writing UI code; extend the service if the API you need is missing.
3. If you add a new collection or denormalized field, update [packages/shared/src/services/_services-map.md](packages/shared/src/services/_services-map.md) and the denormalization doc in the same change.
4. Run `pnpm check` before pushing. CI runs the same gate.
5. If you broke a rule in this file deliberately, update this file.

## Things to flag in PRs (or right here when you find them)

- Logic that bypasses a service.
- New `as any` / `@ts-nocheck` / `// eslint-disable`.
- New `<img>` usage when image optimization could matter.
- Reads in components that should be cached or batched.
- Spanish strings that escaped the i18n message catalog.
