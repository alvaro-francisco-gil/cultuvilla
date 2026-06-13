# Profile screen refactor — implementation plan

**Topic:** Replace the minimal mobile profile tab with a richer, ordago-inspired profile that surfaces the user's "self persona", stats, the personas they manage, and the organizations they belong to.

**Source app for inspiration:** `~/githubs/ordago-apps` (`apps/ordago-app/screens/profile/ProfileScreen.js`, `components/profile/ProfileView.js`). Not a 1:1 port — we adopt the header+stats+sections shape, not the friend/medal/ELO content.

## Status

- **Updated:** 2026-06-13
- **Stage:** components + layout shipped; two data queries + persona-form extraction outstanding
- **Branch:** `main`
- **Done:** `ProfileHeader`/`ProfileStatsRow`/`PersonaScroll`/`PersonaCard`/`ProfileSectionHeader`/`OrgList` components; `profile.tsx` wired to them; `getEventCountByCreator` + `getOrgMembershipsByUserInMunicipality`; i18n keys (`profile.stats`/`actions`/`bio`)
- **Next:** add `getRegistrationsByPersonIds` (chunked collection-group query) for the participation stat and wire it into `profile.tsx`; add an all-municipality `getOrgMembershipsByUser`; extract the person edit form into `PersonForm.tsx`
- **Blockers:** confirm the composite indexes the participation collection-group query needs exist in `firestore.indexes.json` before shipping it
- **Handoff:** the stats row currently renders a partial set (participation count is missing); the new collection-group reads need matching rules **and** indexes, not just the query.

## Goals

1. Show the user's own persona as the primary profile (large avatar, nickname, name, persona-derived subtitle, biography).
2. Show three stats: events created, event participations, personas managed.
3. Horizontal scrollable list of personas the user manages, with an "add persona" CTA at the tail.
4. List organizations the user belongs to, with role badge. Hidden when empty.
5. Keep existing entry points: change photo, sign-out, app-admin entry.

## Non-goals

- Friends, medals, ELO/ranking, recent matches (ordago-only domain).
- Editing arbitrary persona fields inline; we navigate to a dedicated screen.
- Showing other users' profiles (read-only mode for someone else's persona is a future concern).

## Information architecture

`apps/mobile/app/(tabs)/profile.tsx` top-to-bottom:

1. **Header card** — self persona avatar + `@nickname` + full name. Below: a single subtitle line composed from `birthday.year · birthPlace.municipalityId-resolved-name · first occupation label`. Pieces gracefully omitted when null.
2. **Inline stats row** — `Eventos creados | Participaciones | Personas`, equal thirds with thin dividers (mirrors ordago's `statsRowBelow`).
3. **Action row** — `Editar perfil` (→ persona edit for self), `Compartir perfil` (`Share.share`).
4. **Bio block** — `biography` text, or muted "Añade una biografía" CTA when empty.
5. **Personas a tu cargo** — section header + horizontal `FlatList` of `PersonaCard`s + trailing `AddPersonaCard`. Excludes the self-persona from the list (it's the header).
6. **Organizaciones** — section header + vertical list of `OrgRow`s. Hidden if zero memberships.
7. **Mis pueblos** — keep existing entry point as a row that navigates to `/me/villages`.
8. **Footer** — admin entry (if `isAppAdmin`), sign-out (ghost button).

## Components

New folder: `apps/mobile/components/feature/profile/`.

| Component | Responsibility |
|---|---|
| `ProfileHeader.tsx` | Avatar + name block + subtitle. Pure presentational. |
| `ProfileStatsRow.tsx` | Three-cell stats with dividers. Reusable. |
| `PersonaScroll.tsx` | Horizontal `FlatList<PersonaCard>` with trailing `AddPersonaCard`. |
| `PersonaCard.tsx` | ~110px square card: photo or initial, nickname, short name. |
| `OrgList.tsx` + `OrgRow.tsx` | Vertical list of org memberships with role badge. |
| `ProfileSectionHeader.tsx` | Title + optional right-side action label. |

Existing primitives reused: `Avatar`, `Card`, `HStack`, `VStack`, `Text`, `Button`, `Pressable`, `Screen`.

### Persona form extraction

The "complete-profile" onboarding screen at `apps/mobile/app/(onboarding)/complete-profile.tsx` already contains a working persona form. Extract its inner form into `apps/mobile/components/feature/PersonForm.tsx` (controlled props for initial values + onSubmit) so both onboarding and the new persona route consume the same form. Onboarding becomes a thin wrapper that creates a new self-persona; the new route consumes it in either create or edit mode.

### New route: `apps/mobile/app/person/[personId].tsx`

- `personId === 'new'` → create mode (uses `createPerson({ createdBy: user.uid })`).
- Otherwise → edit mode (loads via `getPerson`, calls `updatePerson`).
- Edit access UI-gated by `createdBy === user.uid`. Firestore rules already enforce server-side (verify in audit step).
- After save, `router.back()` and the profile screen refreshes via `useFocusEffect`.

## Backend additions

### `packages/shared/src/services/eventService.ts`

```ts
export async function getEventsByCreator(userId: string): Promise<(EventData & { id: string })[]>
export async function getEventCountByCreator(userId: string): Promise<number>
```

Uses `where('createdBy', '==', userId)` + `orderBy('createdAt', 'desc')`. For the count, use `getCountFromServer` (cheaper than fetching docs).

### `packages/shared/src/services/registrationService.ts`

```ts
export async function getRegistrationsByPersonIds(personIds: string[]): Promise<RegistrationData[]>
export async function getParticipationCountForPersonIds(personIds: string[]): Promise<number>
```

Uses `collectionGroup('registrations')` with `where('personId', 'in', personIds)`. The 10-item `in` limit is handled by chunking. Returns deduped by `eventId` for the participation count (one event participated in once = 1, regardless of how many of your personas attended).

### `packages/shared/src/services/orgMemberService.ts`

Existing `OrgMemberData` already keys on `userId` (the doc id within `members/{userId}`). To support reverse lookup via a collection-group query, add `userId` as a **stored field** on the member document (currently only the doc id). Migration is trivial — the existing `addOrgMember` is updated to write the field; no historical backfill needed yet (memberships are sparse in dev).

```ts
export async function getOrgMembershipsByUser(userId: string): Promise<{ orgId: string; role?: string }[]>
```

Uses `collectionGroup('members')` with `where('userId', '==', uid)`. Returns the parent path's `orgId`.

### Firestore indexes (`firestore.indexes.json`)

Add three composite indexes:

1. Collection `events`, fields `createdBy ASC, createdAt DESC`.
2. Collection group `registrations`, fields `personId ASC, createdAt DESC`.
3. Collection group `members`, fields `userId ASC`. (Single field, but collection-group requires explicit index.)

### Firestore rules (`firestore.rules`)

Read access required:

- `events`: already publicly readable per the open-feed work — no change.
- `registrations` (collection group): currently scoped per-event. Need to allow `list` from a collection-group query filtered by the requester's personIds. Since the requester must already be the creator of those personas, we add a rule allowing list when `request.query.where.personId in (personas owned by request.auth.uid)`. Concretely: allow list if the requester is authenticated AND filtering by `personId == <a person they created>`. We'll verify via the `guardrail-audit` skill.
- `orgMembers` (collection group): allow list when filtering by `userId == request.auth.uid`. Standard self-read pattern.

## Mobile data hook

`apps/mobile/lib/profile/useProfileStats.ts`:

```ts
export function useProfileStats(userId: string, personaIds: string[]): {
  eventsCreated: number | null
  participations: number | null
  personasCount: number
  loading: boolean
  error: Error | null
}
```

Fans out the three queries in parallel, returns `null` for each cell while loading. UI shows `—` for `null`.

## Data flow

```
ProfileScreen
  useAuth() → user.uid
  useFocusEffect(load):
    getPersonByUserId(uid)              → selfPerson
    getPersonsByCreator(uid)            → allPersonas
    useProfileStats(uid, allPersonas.map(p=>p.id))
    getOrgMembershipsByUser(uid)
    for each membership: getOrganization(orgId)
```

Each fetch is independent; failures isolate to their section. Header reveals as soon as `selfPerson` resolves; stats and lists show skeleton shimmer until ready.

## Styling

Reuse existing NativeWind classes from the design system. The header avatar matches the village-card avatar size convention (~88px). Cards in the horizontal scroll: `w-28 rounded-2xl border border-subtle bg-surface`.

## i18n

All new strings go into `packages/i18n/` under the namespace `profile.*` (extending the existing one). Per the `i18n-add-string` skill: web admin surfaces are NOT involved here, so all strings live in the catalog.

New keys (Spanish first):

- `profile.subtitle.year`, `profile.subtitle.born`, `profile.subtitle.occupation` — formatters for the header subtitle line.
- `profile.stats.eventsCreated`, `profile.stats.participations`, `profile.stats.personas`
- `profile.actions.edit`, `profile.actions.share`
- `profile.bio.empty`, `profile.bio.cta`
- `profile.personas.title`, `profile.personas.empty`, `profile.personas.add`
- `profile.orgs.title`, `profile.orgs.roleAdmin`, `profile.orgs.roleMember`
- `profile.villages.cta`

## Tests

### `packages/shared` (vitest)

- `getEventsByCreator` / `getEventCountByCreator` — mocked Firestore.
- `getRegistrationsByPersonIds` — chunking behavior when `personIds.length > 10`, deduping by eventId.
- `getOrgMembershipsByUser` — collection-group query construction.

### `apps/mobile`

- Component test: `ProfileHeader` renders subtitle correctly when (a) all fields present, (b) only birthday, (c) only occupation, (d) none.
- Component test: `PersonaScroll` renders cards and the trailing add button.
- Integration test for `/person/[personId]` create flow mirroring `complete-profile.test.tsx`.
- Snapshot-free; assertions on text and accessibility labels.

### Firestore rules (`packages/shared/test/e2e/`)

- Existing test: ensure adding new rules doesn't regress the open-feed reads.
- New test: collection-group queries for the requester's own personas/memberships succeed; cross-user collection-group reads fail.

## Out of scope (future)

- Other-user profile view (read-only).
- Persona linking/merging (claiming a deceased relative).
- Stats trend over time.
- Background sync / cached read model — current queries are fine at expected volumes.

## Risks

- Collection-group rules can be subtle; the audit step is mandatory.
- The `in` operator on `getRegistrationsByPersonIds` caps at 10 — fine for the foreseeable future but documented in the service comment.
- `members.userId` field is new — old member docs won't appear in the reverse query until we backfill. Acceptable for dev; flag for prod cutover.

## Status snapshot

Drafted 2026-05-24 by the brainstorming flow. Promoted on user approval; implementation plan to follow via `superpowers:writing-plans`.
