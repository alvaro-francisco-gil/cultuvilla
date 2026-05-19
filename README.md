# Cultuvilla

Mobile-first web app for Spanish village communities to organize and participate in local events. Orgs (ayuntamientos, peñas, asociaciones) publish events; residents and visitors discover them, sign themselves up, and can also sign up family members via proxy profiles.

## User types

Cultuvilla has **six user types**. They compose — an org member is also a village member is also an authenticated user.

| # | Role | What defines them |
|---|------|-------------------|
| 1 | **Anonymous visitor** | Unauthenticated. Browses public event listings; sees attendee counts only, never names. |
| 2 | **Authenticated user** | Signed in. Can browse events globally and **request to join any event in any village**, regardless of village membership. Manages own profile and personas. |
| 3 | **Village member** | Joined a village via invite link. Sees full attendee lists for that village's events, can request org creation. |
| 4 | **Org member** | Belongs to an `ayuntamiento`, `peña`, or `asociación` within a village. Creates, edits, and cancels that org's events. |
| 5 | **Village admin** | One per village. Generates invite links, approves/rejects org requests, manages village info, can cancel any event in the village. |
| 6 | **Superadmin** (app-wide) | Global. Creates villages, manages all villages and users. Owns the `/admin/*` pages (municipalities, barrios, cemeteries, occupations, proposals). |

### "Persona" — distinct concept

A **persona** in this codebase is **not** a user type. It is a *proxy profile* (up to 50 per user) for someone who won't use the app themselves — typically an elderly relative. Personas carry their own name, birthday, bio, and photo. They exist so one logged-in user can register multiple family members to an event in a single flow. Owner-only read/write.

When code says `personaId`, it means "which family member is this registration for," not "what kind of user."

## Stack

- **Web app**: Next.js (App Router) in `apps/web`
- **Shared package**: `@cultuvilla/shared` (types, schemas, helpers) in `packages/shared`
- **Backend**: Firebase (Firestore, Auth, Storage) + Cloud Functions in `functions/`
- **Data model**: Single Firebase project, data nested under `villages/{villageId}/`, collection group indexes for cross-village queries
- **i18n**: Spanish default via `next-intl`
- **Package manager**: pnpm workspaces

## Commands

Run `pnpm help` for the full list. Most-used:

```bash
pnpm web:dev          # Next.js dev server with hot reload
pnpm check            # lint + typecheck + test + build (full CI gate)
pnpm shared:test      # vitest in packages/shared
pnpm typecheck        # all workspaces
```

## Design docs

Source of truth for requirements lives in [docs/superpowers/specs/](docs/superpowers/specs/):

- [2026-04-05-cultuvilla-design.md](docs/superpowers/specs/2026-04-05-cultuvilla-design.md) — core platform design
- [2026-04-25-village-censo-design.md](docs/superpowers/specs/2026-04-25-village-censo-design.md) — village census
- [2026-04-29-open-feed-architecture-design.md](docs/superpowers/specs/2026-04-29-open-feed-architecture-design.md) — open feed architecture
- [2026-05-02-family-tree-exploration.md](docs/superpowers/specs/2026-05-02-family-tree-exploration.md) — family tree exploration
