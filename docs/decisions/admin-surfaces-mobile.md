# Two admin tiers on mobile, separated by entry point and defended by route guards

## Context

Cultuvilla has two distinct admin tiers but the mobile app (now the primary UI)
had no admin surface for either. **App admins** are global/cross-village
(`admins/{uid}`, checked via `isAppAdmin(uid)`): activate villages, review
organizer requests, manage the occupation catalog. **Village admins** are scoped
to one municipality (`community.adminUserId` or member `role == 'admin'`):
barrios, cementerios, organizations, invite tokens, censo schema, community
settings. Both needed porting into `apps/mobile/` without the tiers bleeding
together.

## Decision

- **The two tiers are separated by entry point**, not just by permission. App
  admin lives under `app/admin/*`, reached from a Profile-tab "Administración"
  row. Village admin lives under `app/village/[villageId]/admin/*`, reached from
  a gear icon in that village's header. Global concerns and one-village concerns
  never share a screen.
- **Defense-in-depth permission gating, two layers.**
  1. *Render-time*: the entry-point elements (Profile row, header gear) only
     render when the predicate is true — non-admins see no doors.
  2. *Route-layout guards*: each `_layout.tsx` re-checks the predicate on mount
     and `router.replace`s away on failure (to `/` for app admin, to the village
     for village admin) — covers deep-linking past the hidden entry point.
- **A shared `useIsAppAdmin()` hook** wraps the async `isAppAdmin` check with a
  loading state, used by both the render-time gate and the layout guards. The
  village guard combines it with an async `isVillageAdmin(villageId, uid)` so
  `canManage = isAppAdmin || villageAdmin`.
- **Screens are render + service-call only.** All Firestore I/O goes through
  existing `@cultuvilla/shared/services/*`; no new shared logic, no mobile-only
  admin features that don't exist on web.
- The raw municipality registry stays **read-only from the app** (INE-seeded,
  edited via Node scripts); the app only reads it (e.g. the activate-village
  picker). The existing join-request triage screen
  (`village/[villageId]/admin/requests.tsx`, from
  [village-discovery-onboarding](village-discovery-onboarding.md)) is linked from
  the village-admin hub.

## Rejected alternatives

- **A single merged admin area** — would blur the global/per-village boundary the
  product wants kept distinct.
- **Render-time hiding alone** — insufficient against deep links; the layout
  guards are the security backstop.
- **Editing the municipality registry from the app** — stays in Node scripts.

## What this binds

- A new app-admin screen goes under `app/admin/`; a new village-admin screen goes
  under `app/village/[villageId]/admin/` — keep the tiers physically separated.
- Any admin entry point must be gated *both* at render time and behind its route
  guard; do not rely on hiding the UI alone.
- Admin screens call shared services directly; do not add admin-specific business
  logic to the mobile app.

## Revisit when

- Admins need an audit log or in-app notifications for new requests/proposals
  (both noted as future work).
- A mobile-only admin capability with no web equivalent becomes necessary.
