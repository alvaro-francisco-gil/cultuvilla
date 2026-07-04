# Rich organizer-request cards + viewable user profiles

**Status:** idea (design approved 2026-07-04)

## Problem

When the app super admin opens the Solicitudes → Recibidas (inbox) tab, incoming
**organizer requests** (a user asking to become a village's organizer) render as a
bare card that shows the requester's raw Firebase `userId` string, no photo, and
no way to inspect who is asking or which village they want. The admin has to
approve/reject blind.

We want the organizer-request card to:

1. Show the **requester's name and photo**.
2. Be **clickable → navigate to that user's profile**.
3. **Reference the target village**, clickable → navigate to the village profile.

Achieving (2) requires something that does not exist yet: a screen to view
*another* user's profile.

## Background: data model facts that shape this

- **`organizerRequests/{id}`** stores only `userId` + `municipalityId` (plus
  `requestedAt`, `description`, `motivation`, review fields). No requester name,
  photo, or village name is denormalized.
  ([OrganizerRequestDataModel.ts](../../../packages/shared/src/models/municipality/OrganizerRequestDataModel.ts))
- The **user doc is a thin account record** (`displayName`, `email`, `telephone`,
  `activeMunicipalityId`, `personId`, `createdAt`). Name/photo/biography — the
  "profile of record" — live on the linked **person** doc (`user.personId →
  persons/{personId}`). A user's photo cannot be shown from the user doc; you
  resolve the linked person.
  ([UserDataModel.ts](../../../packages/shared/src/models/user/UserDataModel.ts),
  [PersonDataModel.ts](../../../packages/shared/src/models/person/PersonDataModel.ts))
- A **village *is* a municipality**; `villageId` (route param) == `municipalityId`.
  Route `/village/[villageId]` already exists.
- **No user-profile route exists.** Only `/person/[personId]` (census personas)
  and `/village/[villageId]`. The self profile is `(tabs)/profile.tsx`, which only
  renders the current user.
- Firestore reads are mostly world-readable (`persons`, `municipalities`, members,
  `organizations`, `events`, `users` are all `allow read: if true`), so an
  other-user profile can load its core sections. Two exceptions handled below.

## Design

Two parts.

### Part A — Organizer-request inbox card

File: [apps/mobile/app/solicitudes/index.tsx](../../../apps/mobile/app/solicitudes/index.tsx).
The organizer rows are rendered inline in `renderInbox()` (super-admin-only,
`isSuperAdmin && organizerRows.length > 0`). Today the card shows the raw
`row.userId` and has no navigation.

Changes:

- **Resolve the requester** for each row via `getPersonByUserId(row.userId)` into a
  `requesterByUid` map, mirroring the existing client-side `municipalityNames`
  resolution. Yields display name + `photoURL` (both come from the person).
- **Card content:**
  - `Avatar` (person `photoURL`, initials fallback) + requester display name.
  - Line "quiere organizar **{villageName}**" (village name already resolved via
    the existing `municipalityNames` map).
  - Village name rendered as a tappable chip/link.
  - Optional `row.motivation` block (unchanged).
  - Approve / Reject buttons (unchanged handlers → `respondToOrganizerRequest`).
- **Navigation:**
  - Card body `Pressable` → `/user/[uid]` with `row.userId`.
  - Village chip → `/village/[municipalityId]`, stopping propagation so it doesn't
    also trigger the card's user navigation.
  - Approve/Reject buttons keep their own handlers (must not bubble to the card).

### Part B — Shared profile view + read-only `/user/[uid]` route

**Approach (chosen for long-term maintainability): extract, don't duplicate.**
The presentational body and data loader of `(tabs)/profile.tsx` are extracted into
shared units that both the self tab and the new route consume.

- **`useProfileData(uid, activeMunicipalityId)` hook** — the data-loading logic
  currently inlined in `ProfileScreen.load()`: person-of-record, personas, managed
  events, created news, villages, and orgs. Parameterized by uid so it works for
  any user.
- **`ProfileView` presentational component** — the entire scroll body (header,
  stats row, edit/share actions, biography, personas scroll, managed events, news,
  grupos/peñas sections, villages scroll). Takes a `variant: 'self' | 'other'`.

Variant behavior:

| Affordance | `self` | `other` |
|---|---|---|
| Edit / Share buttons | shown | hidden |
| Avatar upload (`onChangePhoto`) | enabled | avatar not pressable |
| "Add persona" button | shown | hidden |
| Village tap | switch active village (`setActiveMunicipality`) | navigate to `/village/[id]` |
| Header | `AppHeader` "Perfil" | back-enabled `AppHeader` titled with the person's name — visually distinct so it's clear you're viewing someone else |

- `(tabs)/profile.tsx` → renders `ProfileView variant="self"` (self-only handlers
  wired in).
- New route **`apps/mobile/app/user/[uid].tsx`** → renders `ProfileView
  variant="other"` for the target uid, using the target user's
  `activeMunicipalityId` (from their user doc) for the orgs section.

**Parity requirement:** villages and created-news sections must render on other
people's profiles too (not hidden). Two reads currently blocked cross-user need
work:

1. **Villages** — `getUserMemberships(uid)` is a `collectionGroup('members')` query
   gated by `allow list: if isAuthenticated() && resource.data.userId ==
   request.auth.uid` ([firestore.rules](../../../firestore.rules) ~L717). Relax to
   **`allow list: if isAuthenticated()`**. Individual member docs are already
   `allow read: if true`, so this only enables enumerating memberships by userId.
   This is a deliberate security-posture change (any signed-in user can list any
   user's village memberships), approved for full profile parity. **Add a rules
   test** covering the new allowance.
2. **Created news** — `getNewsPostsByOrganizer(uid)` queries
   `where('organizerUserIds','array-contains',uid)` with no status filter; the news
   read rule requires `status == 'approved' || isVillageMember || isOwner`, so the
   all-statuses query fails for other users. Add
   **`getApprovedNewsPostsByOrganizer(uid)`** (`array-contains` + `where('status',
   '==', 'approved')`), add the matching composite index to
   [firestore.indexes.json](../../../firestore.indexes.json), and have the `other`
   variant use it. Self variant keeps the all-statuses query (with its existing
   try/catch).

## Testing

- **vitest (`packages/shared`)** for the new `getApprovedNewsPostsByOrganizer`
  query builder (mirrors existing news-service tests).
- **rules test** (`@firebase/rules-unit-testing` under `packages/shared/test/e2e/`)
  for the relaxed members collection-group list rule: an authenticated user can now
  list another user's memberships; unauthenticated still denied.
- UI wiring (card navigation, ProfileView variant toggles) is RN-only; note in the
  PR which parts are covered vs. manually verified.

## Out of scope

- Denormalizing requester name/photo/village name onto `organizerRequests` (we
  resolve client-side, consistent with the existing municipality-name resolution).
- Edit/share affordances on other-user profiles.
- A public/self-visibility privacy model for profiles (everything shown is already
  world-readable except the village-membership enumeration relaxed above).

## Follow-ups to flag

- If client-side per-row `getPersonByUserId` resolution in the inbox becomes a
  read-count problem, consider denormalizing requester summary onto the request
  doc via a Cloud Function trigger.
