---
Status: Draft
Date: 2026-05-21
Topic: Decouple signup from village; add discovery + join/organizer request flows; restructure mobile nav to three tabs.
---

# Village discovery & onboarding redesign

## Problem

The mobile app inherited a signup flow that implicitly assumes the user already belongs to a village. Today:

- `signUpWithEmail` ([apps/mobile/lib/auth/AuthContext.tsx](../../../apps/mobile/lib/auth/AuthContext.tsx)) only creates a Firebase Auth user. **No `users/{uid}` Firestore doc is ever written**, so `profile` stays `null` for every newly signed-up user.
- There is no path for a user to find a village, ask to join it, or propose becoming the organizer of an inactive municipality.
- The current `(tabs)` layout exposes "Inicio / Pueblos / Perfil", but "Pueblos" lists *your* memberships only — a new user lands on an empty screen with no CTA.

We need to:

1. Let users register without a village.
2. Force the missing profile-doc creation so the rest of the app stops dereferencing `null`.
3. Give them a discovery surface with two outbound actions: **request to join** an active community, or **request to organize** an inactive one.
4. Restructure the bottom nav to three tabs — *Explora*, *{village name | Buscar pueblo}*, *Perfil* — with the middle tab dynamically swapping between the user's active village and the discovery experience.

## Non-goals

- No changes to the family-member `persons` model.
- No auto-approval or "open-membership" village mode (admin always approves).
- No web admin UI changes — village admins manage requests on mobile for now.
- The existing invite-token flow stays as-is (it's the "skip the queue" path admins can share).

## Architecture

### Data model additions

**`municipalities/{mid}/joinRequests/{userId}`** — one doc per user per village, keyed by uid so duplicates are structurally impossible.

```ts
interface JoinRequestData {
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;   // uid of the admin who acted
}
```

**`organizerRequests/{requestId}`** — top-level, because the target municipality may not yet have an active community.

```ts
interface OrganizerRequestData {
  userId: string;
  municipalityId: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  motivation: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;   // uid of the app admin who acted
}
```

Both follow the model-then-service convention from [add-firestore-collection].

### Service layer (`packages/shared/src/services/`)

Two new services:

- `joinRequestService.ts` — reads (`getJoinRequest`, `getJoinRequestsForVillage`, `getMyJoinRequests`) + thin callable wrappers for the create/respond actions.
- `organizerRequestService.ts` — reads (`getOrganizerRequest`, `getPendingOrganizerRequests`, `getMyOrganizerRequests`) + thin callable wrappers.

All writes go through Cloud Functions (see below). The services map ([packages/shared/src/services/_services-map.md](../../../packages/shared/src/services/_services-map.md)) gets two new rows.

### Cloud Functions (`functions/src/`)

Four new callables, all using the `logger.info(msg, { handler, ... })` pattern from [cloud-function-logging]:

| Callable | Auth gate | What it writes |
|---|---|---|
| `requestJoinVillage({ municipalityId, message? })` | Authenticated user, not already a member, no pending/approved request for that village. Rejects if `communityActive=false`. | `municipalities/{mid}/joinRequests/{uid}` with status `pending`. |
| `respondToJoinRequest({ municipalityId, userId, decision })` | Caller is village admin (`community.adminUserId == caller` OR `members/{caller}.role == 'admin'`). | Updates the joinRequest. On `approved`, transactionally adds `members/{userId}` with `role: 'user'`. Sends notification to the requester. |
| `requestOrganizeVillage({ municipalityId, motivation? })` | Authenticated user; rejects if `communityActive=true` or user already has a pending organizer request for that municipality. | `organizerRequests/{newId}` with status `pending`. |
| `respondToOrganizerRequest({ requestId, decision })` | Caller `isAppAdmin`. | Updates the organizerRequest. On `approved`, transactionally calls the existing `activateCommunity` flow with `adminUserId = request.userId` and inserts `members/{userId}` with `role: 'admin'`. Sends notification. |

Each callable runs guardrails per [guardrail-enforcement] — predicates Firestore rules can't express (e.g., "not already a member AND no prior pending request") live in the function; predicates rules *can* express stay in rules as defense-in-depth.

### Firestore rules

New rule blocks:

- `municipalities/{mid}/joinRequests/{uid}`:
  - `read`: `uid == request.auth.uid` OR caller is village admin of `mid`.
  - `write`: deny client writes — only the Cloud Functions service account creates/updates these.
- `organizerRequests/{requestId}`:
  - `read`: `resource.data.userId == request.auth.uid` OR caller is `isAppAdmin`.
  - `write`: deny client writes — Cloud Functions only.

A unit test under `packages/shared/test/e2e/` (using `@firebase/rules-unit-testing`) verifies the rules per repo convention.

### Indexes

`firestore.indexes.json`:
- Collection group `joinRequests` indexed by `(userId, status)` so a user can list their own pending requests across villages.
- Collection `organizerRequests` indexed by `(userId, status)` and `(status, requestedAt)`.

### Denormalization

None new — all the per-request reads are point reads or small-cardinality list reads. No read-model changes.

## Mobile UX

### Routes

```
apps/mobile/app/
├── (auth)/
│   ├── login.tsx
│   └── signup.tsx
├── (onboarding)/
│   ├── _layout.tsx           ← new: guarded by "user but no profile doc"
│   └── complete-profile.tsx  ← new
├── (tabs)/
│   ├── _layout.tsx           ← rewritten: 3 tabs, dynamic middle
│   ├── explora.tsx           ← renamed from index.tsx
│   ├── village.tsx           ← new: dynamic active-village OR discovery
│   └── profile.tsx
├── discover/
│   ├── request-join/[municipalityId].tsx     ← new
│   └── request-organizer/[municipalityId].tsx ← new
├── village/
│   └── [villageId]/
│       └── admin/requests.tsx ← new: village admin reviews join requests
└── event/...                  ← unchanged
```

### Auth-state routing (`apps/mobile/app/_layout.tsx`)

The root `AuthGate` already gates on `loading`. We add a second gate downstream:

1. `!user` → render `Stack` (login/signup screens are accessible).
2. `user && profileChecked && !profile` → `<Redirect href="/(onboarding)/complete-profile" />`.
3. Otherwise → render `(tabs)`.

`(onboarding)/complete-profile.tsx` collects `displayName`, `birthday`, optional `telephone`, then calls `createUserProfile` and navigates to `/`.

### Three-tab layout (`(tabs)/_layout.tsx`)

Icons from `@expo/vector-icons` (Ionicons), already bundled with Expo SDK 54 — no new dep.

```tsx
<Tabs screenOptions={{ headerShown: false }}>
  <Tabs.Screen
    name="explora"
    options={{
      title: t('tabs.explora'),
      tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
    }}
  />
  <Tabs.Screen
    name="village"
    options={{
      title: activeVillageName ?? t('tabs.findVillage'),
      tabBarIcon: ({ color, size }) => (
        <Ionicons
          name={activeVillageName ? 'home-outline' : 'search-outline'}
          size={size}
          color={color}
        />
      ),
    }}
  />
  <Tabs.Screen
    name="profile"
    options={{
      title: t('tabs.profile'),
      tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
    }}
  />
</Tabs>
```

`activeVillageName` resolves from `profile.activeMunicipalityId` → cached `getMunicipality(id).name`. While loading, the label falls back to a neutral `t('tabs.village')`.

### `(tabs)/village.tsx` — the dynamic middle tab

State machine inside one route:

- **No memberships, no active id** → render `<VillageDiscoveryScreen />`:
  - Search box + list of `getActiveCommunities()`.
  - Each row shows status: `member`, `pending join`, `available`, `inactive`.
  - "¿No ves tu pueblo?" CTA opens municipality search (`getMunicipalities` filtered client-side; we lazy-paginate if perf demands it later — 8k items is borderline but acceptable for v1).
  - Tapping an active municipality → push `discover/request-join/[municipalityId]`.
  - Tapping an inactive one → push `discover/request-organizer/[municipalityId]`.

- **Has memberships, no active id** → effect sets `activeMunicipalityId` to the first membership, then re-renders.

- **Has active id** → render `<VillageHomeScreen villageId={activeMunicipalityId} />`:
  - Header shows the village name with a chevron — tap opens a switcher sheet listing all the user's villages + "Buscar otro pueblo" at the bottom (re-enters discovery without dropping the active village).
  - Body: village events, members count, organizations, etc. (Stub for now if not yet built — out of scope for this spec.)

### `(tabs)/explora.tsx`

The current `index.tsx` content (cross-village upcoming-events feed) moves here. No behavior changes.

### Village admin: requests panel

`village/[villageId]/admin/requests.tsx`:
- Gated by `isVillageAdmin(villageId, user.uid)`.
- Lists `getJoinRequestsForVillage(villageId, 'pending')`.
- Each row has approve/reject buttons that call the `respondToJoinRequest` callable.
- Entry point: a "Solicitudes pendientes" badge in the village home header for admins.

## i18n

Per [i18n-add-string], all new strings land in `packages/i18n/`:

- `tabs.explora`, `tabs.findVillage`, `tabs.village`, `tabs.profile`
- `onboarding.completeProfile.*`
- `discover.search.placeholder`, `discover.empty`, `discover.notSeeing`, `discover.requestJoin`, `discover.requestOrganizer`
- `requests.join.*`, `requests.organizer.*`, `requests.status.pending|approved|rejected`
- `villageSwitcher.title`, `villageSwitcher.findAnother`

No hardcoded Spanish in the mobile app (the dev-only-web-admin carve-out doesn't apply here).

## Testing strategy

- **Vitest (`packages/shared`)**: service-layer tests for `joinRequestService` and `organizerRequestService` mapping logic.
- **Vitest emulator (`functions/`)**: each callable gets a happy-path test + at least one rejection-path test (already a member, already pending, wrong auth, community inactive, etc.).
- **Rules tests (`packages/shared/test/e2e/`)**: a non-admin can't read others' joinRequests; a village admin can; client writes to either collection are denied.
- **Mobile**: smoke test in `apps/mobile/test/` for the routing-state machine in `(tabs)/_layout.tsx` (active village set vs. not set vs. loading).

## Migration considerations

- **Existing users without a profile doc**: the new `(onboarding)/complete-profile` redirect catches them on next app open. No batch backfill needed.
- **Existing invite-token flow**: untouched; still bypasses join requests.
- **Existing memberships**: unchanged; if a user already has memberships, `activeMunicipalityId` is auto-set to the first one on first launch under the new code.

## Open questions intentionally deferred

- **Membership privacy**: should requesters see *which* admin approved them? Spec says yes (`reviewedBy`); UI hides it for now, surface later if needed.
- **Auto-approval mode** for villages that want frictionless join — deferred to a per-village `community.joinPolicy` field in a future iteration.
- **Discovery for users who *are* already in a village but want to find another one** — covered today via the switcher's "Buscar otro pueblo", but if usage grows we may promote discovery back to a dedicated tab.
