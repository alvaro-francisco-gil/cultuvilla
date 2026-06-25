# Event & News: single date, real location, flexible ownership

## Status

- **Updated:** 2026-06-26
- **Stage:** complete
- **Branch:** `worktree-event-single-date-real-location` (worktree at `.claude/worktrees/event-single-date-real-location`)
- **Done:** Tasks 1–19 all landed and committed. All three model changes shipped: single date (drop `endDate`, Madrid-day `isStartDayOver`), real location (`{ coordinates, displayName }`), flexible ownership (`organizerUserIds[]` control+shown / `organizerOrgIds[]` display-only) across events AND news. Rules, indexes, services, the `OrganizerPicker` + location UI, the `completeExpiredEvents` function, and a combined idempotent dev backfill script (`scripts/backfill-event-news-ownership.mjs`) are all in. Whole-branch review findings addressed. `pnpm check` is fully green (typecheck + lint + 246 mobile tests + shared/functions vitest + emulator e2e + build).
- **Next:** push the branch and open the PR to `main`.
- **Blockers:** none.
- **Handoff:** Org members are now display-only — to manage an item, a person must be a named user in `organizerUserIds` (a conscious tradeoff vs. the old implicit org-member control). Names are never denormalized; display resolves live via `LiveOwnerChip`. The dev backfill is idempotent and dev-only — run it once against dev before relying on the new shape (beta/prod handled separately, never by this script).

## Goal

Three model changes shipped in one migration:
1. **Single date** — events drop `endDate`; "ongoing" = the rest of the event's Europe/Madrid calendar day.
2. **Real location** — the event location becomes a required `{ coordinates, displayName }` picked on a map (replaces the text/coords union).
3. **Flexible ownership (events AND news)** — an item is organized by N named users and N organizations. Named **users** get control + are shown; **organizations** are shown only (their members get no implicit control).

## Context

Today events carry `startDate` + nullable `endDate`, a `location` discriminated union (`{ type, coordinates, text }`), and single ownership (`createdBy` + nullable `organizationId`/`organizationName`). News mirrors this (`createdBy` + `authorUserId` + nullable `authorOrgId`).

Organizers found two dates confusing, want a real map location, and want several people/orgs to co-organize an event or news item. The village/municipality model already stores coordinates as `{lat,lng}`; we reuse that and the existing `LocationPicker`. Display names are resolved live via `useOwnerSummary`/`LiveOwnerChip`, so **no names are denormalized**.

## Design

### Ownership semantics (events + news)

```
createdBy: string             // audit, immutable, always controls
organizerUserIds: string[]    // named people → control + shown
organizerOrgIds:  string[]    // orgs → shown only, NO control
```

- **Control** (edit/delete/manage roster) = `createdBy` **OR** `request.auth.uid in organizerUserIds` **OR** village admin **OR** app admin. The `in` operator makes this expressible in Firestore rules — no triggers, no admin-callable, no denormalized controller list.
- **Creator is always in `organizerUserIds`** (rule-enforced at create), so "my events/news" is a single `array-contains` query and the creator always appears.
- **Orgs are display-only.** Listing an org grants its members nothing. (Conscious tradeoff: org members must be added as named users to manage an item — different from today, where any org member could edit org events.)
- `createdBy` and `municipalityId` are immutable on update.
- **Names are never stored.** Display uses `LiveOwnerChip` (`ownerType` `'user'`/`'organization'`), which live-reads `users/{id}.displayName` and `organizations/{id}.name`.

### Single date

- Remove `endDate`. Add `isStartDayOver(start, now)` (true once `now` is a later Europe/Madrid calendar day than `start`) and reuse it in `isEventOngoing` and the `completeExpiredEvents` Cloud Function. One source of truth so the mobile app (device TZ) and the function (UTC) agree.

### Real location

- `LocationDataSchema = { coordinates: LatLng, displayName: string }`. Coordinates stay **nested** so the existing `{lat,lng}→GeoPoint` walker (`firebase/converters/walkers.ts`, which matches objects with *exactly* `lat`+`lng`) keeps working. The text variant and `LocationTypeSchema` are removed.
- Event form: `LocationPicker` (seeded with village coords) + an editable place-name field (seeded with the village name).

### UI building blocks (reuse, don't invent)

- `ChoiceList` (`components/feature/censo/ChoiceList.tsx`, `mode="multi"`) — multi-select org chips.
- `AttendeeSheet` (`components/feature/AttendeeSheet.tsx`) — searchable multi-select for villagers (`{ id: userId, name }`).
- `LiveOwnerChip` + `useOwnerSummary` — render selected/saved organizers by id without denormalizing names.
- `getVillageMembers(municipalityId)` + `users/{uid}.displayName` (via a batched fetch, MembersList pattern) — the villager list for the people picker.

### Region

Not stored — derivable from the item's village. Out of scope.

### Existing data — one combined dev backfill

A single admin script migrates every `events` and `newsPosts` doc: drop `endDate`; convert `location`; `organizerUserIds = [createdBy]`; `organizerOrgIds = <old single org> ? [it] : []`; delete `organizationId`/`organizationName`/`authorUserId`/`authorOrgId`. Idempotent; dev only.

## Out of scope

- Region on the item (derive from village).
- Org members getting implicit control (orgs are display-only).
- Denormalizing organizer names (live chips instead).
- Rich multi-organizer display on feed cards (cards show at most the first organizer; full list on the detail screen).
- News *editing* of organizers (news updates are already rule-restricted; create-form parity only).
- Recurring/multi-day events; registration windows (unchanged).

## Resolved decisions

- End semantics → rest of the Europe/Madrid start-day.
- Location shape → nested `{ coordinates, displayName }`.
- Ownership → `organizerUserIds[]` (control+shown) + `organizerOrgIds[]` (shown only); creator forced into `organizerUserIds`.
- Names → live, not denormalized.
- News → full model/rules/service/backfill parity + create-form picker; editing deferred.
- Migration → one combined dev backfill.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Architecture:** `packages/shared` owns models/schemas/services + the pure `isStartDayOver` helper (reused by the Cloud Function). `firestore.rules` + `firestore.indexes.json` enforce control and back the `array-contains` queries. Mobile gets a reusable `OrganizerPicker` plus the location picker. One admin script migrates dev data.

**Tech Stack:** TypeScript, Zod, Firebase (Firestore client + admin, rules, `@firebase/rules-unit-testing`), Vitest (shared/functions), Jest + RN Testing Library (mobile), Expo/React Native.

## Global Constraints

- Coordinates stored as plain `{ lat, lng }`; the walker turns them into `GeoPoint`. Never add keys to a `{lat,lng}` object (`walkers.ts`).
- `organizerUserIds` / `organizerOrgIds` are arrays of plain strings (so `array-contains` works). Keep them small (a handful) — they live on the document.
- Control predicate is identical everywhere: `createdBy || uid in organizerUserIds || villageAdmin || appAdmin`. Don't reintroduce org-membership control.
- All user-facing strings via the i18n catalog (`packages/i18n/messages/es.json`) + `useT()` (per `i18n-add-string`).
- Follow the repo skills: `add-firestore-collection`/`touch-service` conventions for services, `firestore-deploy` for any deploy, `firebase-admin-dev` for the backfill, `cloud-function-logging` for function logs.
- TDD: failing test → watch fail → minimal impl → watch pass → commit. Run `pnpm --filter @cultuvilla/shared test` after shared changes; `pnpm check` before the final commit.

---

## Phase A — Shared models

### Task 1: `LocationData` → coordinates + displayName

**Files:** Modify `packages/shared/src/models/core/LocationDataModel.ts`; Test `packages/shared/test/models/core/LocationDataModel.test.ts`.

**Produces:** `LocationDataSchema` = `{ coordinates: LatLng, displayName: string }`; `LocationData`; `buildLocationData({ coordinates, displayName })`. Removes `LocationTypeSchema`/`LocationType`.

- [ ] **Step 1 — rewrite the test:**

```ts
import { describe, it, expect } from 'vitest';
import { LocationDataSchema, buildLocationData } from '../../../src/models/core/LocationDataModel';

describe('LocationDataSchema', () => {
  it('accepts coordinates + displayName', () => {
    expect(LocationDataSchema.parse({ coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza Mayor' }))
      .toEqual({ coordinates: { lat: 40.4, lng: -3.7 }, displayName: 'Plaza Mayor' });
  });
  it('rejects a missing displayName', () => {
    expect(() => LocationDataSchema.parse({ coordinates: { lat: 1, lng: 2 } })).toThrow();
  });
  it('rejects malformed coordinates', () => {
    expect(() => LocationDataSchema.parse({ coordinates: { lat: 'x', lng: -3.7 }, displayName: 'y' })).toThrow();
  });
});

describe('buildLocationData', () => {
  it('passes coordinates and displayName through', () => {
    expect(buildLocationData({ coordinates: { lat: 1, lng: 2 }, displayName: 'Sede' }))
      .toEqual({ coordinates: { lat: 1, lng: 2 }, displayName: 'Sede' });
  });
});
```

- [ ] **Step 2 — run, confirm FAIL:** `pnpm --filter @cultuvilla/shared test LocationDataModel`
- [ ] **Step 3 — rewrite the model** (whole file):

```ts
import { z } from 'zod';

export const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });
export type LatLng = z.infer<typeof LatLngSchema>;

export const LocationDataSchema = z.object({
  coordinates: LatLngSchema,
  displayName: z.string(),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

export interface LocationDataInput {
  coordinates: LatLng;
  displayName: string;
}

export function buildLocationData(input: LocationDataInput): LocationData {
  return { coordinates: input.coordinates, displayName: input.displayName };
}
```

- [ ] **Step 4 — run, confirm PASS** (other files break; fixed in their tasks + Task 19).
- [ ] **Step 5 — commit:** `git commit -am "refactor(shared): location is coordinates + displayName"`

---

### Task 2: Event model — single date + ownership arrays

**Files:** Modify `packages/shared/src/models/event/EventDataModel.ts`; Test `packages/shared/test/models/event/EventDataModel.test.ts`.

**Produces:** `EventData`/`EventDataInput`/`buildEventData` without `endDate`/`organizationId`/`organizationName`, with `organizerUserIds: string[]` + `organizerOrgIds: string[]`. `isStartDayOver(start, now): boolean` (exported). `isEventOngoing(Pick<EventData,'status'|'startDate'>, now)`.

- [ ] **Step 1 — update the test:** import `isStartDayOver`; remove `endDate` from every fixture; change `location` fixtures to `{ coordinates: { lat: 1, lng: 2 }, displayName: 'Plaza' }`; replace `organizationId/organizationName` in fixtures with `organizerUserIds: ['u']`, `organizerOrgIds: []`. Replace the `isEventOngoing` block and add `isStartDayOver`:

```ts
describe('isEventOngoing', () => {
  const now = new Date('2026-06-15T21:00:00Z'); // 23:00 Madrid, still the 15th
  it('true: published, started earlier same Madrid day', () => {
    expect(isEventOngoing({ status: 'published', startDate: new Date('2026-06-15T16:00:00Z') }, now)).toBe(true);
  });
  it('false: before start', () => {
    expect(isEventOngoing({ status: 'published', startDate: new Date('2026-06-15T22:00:00Z') }, now)).toBe(false);
  });
  it('false: Madrid start-day is over', () => {
    expect(isEventOngoing({ status: 'published', startDate: new Date('2026-06-14T16:00:00Z') }, now)).toBe(false);
  });
  it('false: not published', () => {
    expect(isEventOngoing({ status: 'cancelled', startDate: new Date('2026-06-15T16:00:00Z') }, now)).toBe(false);
  });
});

describe('isStartDayOver', () => {
  it('false later same Madrid day', () => {
    expect(isStartDayOver(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T21:00:00Z'))).toBe(false);
  });
  it('true next Madrid day', () => {
    expect(isStartDayOver(new Date('2026-06-15T08:00:00Z'), new Date('2026-06-15T23:30:00Z'))).toBe(true);
  });
});
```

- [ ] **Step 2 — run, confirm FAIL:** `pnpm --filter @cultuvilla/shared test EventDataModel`
- [ ] **Step 3 — edit the model:**
  - In `EventDataSchema`: remove `endDate`, `organizationId`, `organizationName`; add `organizerUserIds: z.array(z.string())`, `organizerOrgIds: z.array(z.string())`.
  - In `EventDataInput`: same swap (`organizerUserIds: string[]; organizerOrgIds: string[];`).
  - In `buildEventData`: remove the dropped fields; add `organizerUserIds: input.organizerUserIds`, `organizerOrgIds: input.organizerOrgIds`.
  - Add the helpers + rewrite `isEventOngoing`:

```ts
const EVENT_TZ = 'Europe/Madrid';
function madridDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
/** True once `now` is a later Europe/Madrid calendar day than `start`. */
export function isStartDayOver(start: Date, now: Date): boolean {
  return madridDayKey(now) > madridDayKey(start);
}
export function isEventOngoing(event: Pick<EventData, 'status' | 'startDate'>, now: Date): boolean {
  if (event.status !== 'published') return false;
  if (event.startDate > now) return false;
  return !isStartDayOver(event.startDate, now);
}
```

- [ ] **Step 4 — run, confirm PASS.**
- [ ] **Step 5 — commit:** `git commit -am "feat(shared): event single date + organizer arrays"`

---

### Task 3: News model — ownership arrays

**Files:** Modify `packages/shared/src/models/news/NewsPostDataModel.ts`; Test (create/extend) `packages/shared/test/models/news/NewsPostDataModel.test.ts` (match the existing news test location if different).

**Produces:** `NewsPostData` without `authorUserId`/`authorOrgId`, with `organizerUserIds: string[]` + `organizerOrgIds: string[]`; `createdBy` kept.

- [ ] **Step 1 — test:** parse a valid post with `organizerUserIds: ['u']`, `organizerOrgIds: []`, `createdBy: 'u'`; assert it round-trips and that `authorUserId`/`authorOrgId` are not in the parsed shape. Run → FAIL.
- [ ] **Step 2 — edit the model:** remove `authorUserId`, `authorOrgId`; add `organizerUserIds: z.array(z.string())`, `organizerOrgIds: z.array(z.string())`; keep `createdBy`. Update any `NewsPostDataInput`/builder accordingly.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "feat(shared): news organizer arrays"`

---

### Task 4: Event form schema — single date + locationName

**Files:** Modify `packages/shared/src/models/event/EventFormSchema.ts`; Test `packages/shared/test/models/EventFormSchema.test.ts`.

**Produces:** `EventFormSchema` without `endDate`; `locationText` replaced by `locationName: string` (required, trimmed).

- [ ] **Step 1 — test:** drop `endDate`/`locationText` cases; add a required-`locationName` failure case + a happy path with `locationName: 'Plaza'`. Run → FAIL.
- [ ] **Step 2 — edit:** delete `optionalDate` + `endDate`; replace `locationText` with:

```ts
  locationName: z.string().transform((s) => s.trim()).refine((s) => s.length > 0, 'El nombre del lugar es obligatorio'),
```
(remove now-unused helpers).
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "refactor(shared): event form schema single date + locationName"`

---

## Phase B — Rules + indexes

### Task 5: Firestore rules — events

**Files:** Modify `firestore.rules`; Test `packages/shared/test/e2e/` (extend the existing event rules e2e, e.g. `eventOrglessRules.test.ts` / `shapeRules.test.ts`).

- [ ] **Step 1 — write/extend rules e2e tests** (use `@firebase/rules-unit-testing`, the existing harness) asserting:
  - create allowed when village member AND `createdBy == uid` AND `uid in organizerUserIds`; denied if `uid` not in `organizerUserIds`.
  - update allowed for a user in `organizerUserIds`; denied for a random village member not in it; allowed for village admin.
  - update denied when it changes `createdBy` or `municipalityId`.
  - a member of an org listed in `organizerOrgIds` (but not in `organizerUserIds`) is **denied** update (orgs are display-only).
  Run → FAIL.
- [ ] **Step 2 — edit `firestore.rules`:**
  - In `isValidEventCreate`: replace the `organizationId`/`organizationName` key+type checks with `d.organizerUserIds is list && d.organizerOrgIds is list`; update the `hasOnly`/`hasAll` key lists (remove `organizationId`,`organizationName`; add `organizerUserIds`,`organizerOrgIds`).
  - Create rule:

```
allow create: if isAuthenticated()
  && isValidEventCreate(request.resource.data)
  && request.resource.data.municipalityId is string
  && request.resource.data.createdBy == request.auth.uid
  && isVillageMember(request.resource.data.municipalityId)
  && (request.auth.uid in request.resource.data.organizerUserIds);
```
  - Update/delete rule:

```
allow update: if (
     isOwner(resource.data.createdBy)
  || (request.auth.uid in resource.data.organizerUserIds)
  || isVillageAdmin(resource.data.municipalityId)
  || isAppAdmin()
) && request.resource.data.createdBy == resource.data.createdBy
  && request.resource.data.municipalityId == resource.data.municipalityId;
allow delete: if isOwner(resource.data.createdBy)
  || (request.auth.uid in resource.data.organizerUserIds)
  || isVillageAdmin(resource.data.municipalityId)
  || isAppAdmin();
```
  - `isEventOrganizer(eventId)` helper: replace the org-membership branch with `(request.auth.uid in get(/databases/$(database)/documents/events/$(eventId)).data.organizerUserIds)`; keep village-admin + app-admin branches.
- [ ] **Step 3 — run rules tests, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "feat(rules): event control via organizerUserIds"`

---

### Task 6: Firestore rules — news

**Files:** Modify `firestore.rules` (news section ~398–425); Test the news rules e2e (mirror Task 5).

- [ ] **Step 1 — tests** mirroring Task 5 for `newsPosts`: create requires `createdBy == uid` AND `uid in organizerUserIds` AND village member (keep the existing status/`trustedNewsAuthor` constraints); update forbids changing `createdBy`/`municipalityId`/`organizerUserIds` for non-organizers; keep delete denied. Run → FAIL.
- [ ] **Step 2 — edit rules:** swap the `authorUserId`/`authorOrgId` validation for `organizerUserIds`/`organizerOrgIds`; require `uid in organizerUserIds` at create; update the immutable-fields list (replace `authorUserId`,`authorOrgId` with the new arrays where appropriate). Preserve moderation logic.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "feat(rules): news control via organizerUserIds"`

---

### Task 7: Composite indexes

**Files:** Modify `firestore.indexes.json`.

- [ ] **Step 1 — replace the `createdBy + createdAt` event index** and add the array-contains indexes:
  - events: `organizerUserIds` (ARRAY_CONTAINS) + `createdAt` DESC
  - events: `organizerOrgIds` (ARRAY_CONTAINS) + `startDate` ASC
  - newsPosts: `organizerUserIds` (ARRAY_CONTAINS) + `createdAt` DESC (and `+ publishedAt`/`status` mirrors of any existing news index that referenced `createdBy`)
  Remove any now-dead `organizationId`/`createdBy` event indexes.
- [ ] **Step 2 — sanity:** rely on Task 8/9 emulator query tests to confirm the indexes satisfy the queries.
- [ ] **Step 3 — commit:** `git commit -am "chore(indexes): array-contains organizer indexes"`

---

## Phase C — Services

### Task 8: `eventService` — organizer queries + writes

**Files:** Modify `packages/shared/src/services/eventService.ts`; Test `packages/shared/test/firebase/converters/eventConverter.test.ts` + any service test.

**Produces:** `createEvent`/`updateEvent` using the new fields (no `endDate`/org); `getEventsByOrganizer(userId)` (array-contains `organizerUserIds`, order `createdAt desc`); `getEventsByOrganization(orgId)` (array-contains `organizerOrgIds`, order `startDate asc`); `getEventCountByOrganizer(userId)`.

- [ ] **Step 1 — update fixtures/tests:** drop `endDate`; `location: { coordinates: {lat,lng}, displayName }`; `organizerUserIds`/`organizerOrgIds` instead of org fields. Run → FAIL.
- [ ] **Step 2 — edit the service:**
  - `createEvent`: remove `endDate`, `organizationId`, `organizationName`; set `organizerUserIds: input.organizerUserIds`, `organizerOrgIds: input.organizerOrgIds`.
  - `updateEvent`: delete the `endDate` Timestamp block.
  - Rename `getEventsByCreator` → `getEventsByOrganizer`, query `where('organizerUserIds','array-contains', userId), orderBy('createdAt','desc')`.
  - Rename `getEventCountByCreator` → `getEventCountByOrganizer`, query `where('organizerUserIds','array-contains', userId)`.
  - `getEventsByOrganization`: `where('organizerOrgIds','array-contains', organizationId), orderBy('startDate','asc')`.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — update call sites** of the renamed functions (grep `getEventsByCreator`/`getEventCountByCreator` across `apps/mobile`): the profile "managed events" / counts screens. Adjust imports + names.
- [ ] **Step 5 — commit:** `git commit -am "refactor(shared): eventService organizer queries"`

---

### Task 9: `newsService` — organizer queries + writes

**Files:** Modify `packages/shared/src/services/newsService.ts`; Test the news service test.

- [ ] Mirror Task 8 for news: `createNewsPost` takes `organizerUserIds`/`organizerOrgIds`; rename creator queries to `...ByOrganizer` using `array-contains organizerUserIds`. Update call sites (grep). TDD cycle + commit `refactor(shared): newsService organizer queries`.

---

### Task 10: `useEventOrganizer` hook — simplify

**Files:** Modify `apps/mobile/lib/events/useEventOrganizer.ts`; Test `apps/mobile/lib/events/__tests__/useEventOrganizer.test.tsx`.

**Produces:** `canOrganize = isAppAdmin || uid in event.organizerUserIds || isVillageAdmin(municipalityId)`. No org-membership check.

- [ ] **Step 1 — update the test:** accept `event: { organizerUserIds: string[]; municipalityId: string }`; assert a user in `organizerUserIds` can organize; a non-listed non-admin cannot; village admin can. Run → FAIL.
- [ ] **Step 2 — edit:** drop the `isOrgMember` import/branch; compute `isOrganizer = !!user && !!event && event.organizerUserIds.includes(user.uid)`; keep the async `isVillageAdmin` check + `isAppAdmin`. Return `canOrganize: isAppAdmin || isOrganizer || villageAdmin`.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "refactor(mobile): event organizer = named users + village admin"`

---

## Phase D — Cloud Functions

### Task 11: `completeExpiredEvents` — Madrid end-of-day

**Files:** Modify `functions/src/events/eventCompletion.ts`; Test (create) `functions/src/__tests__/events/eventCompletion.test.ts`.

- [ ] **Step 1 — test** importing `isStartDayOver` from `@cultuvilla/shared/models/event/EventDataModel`: same-day → false, next-day → true. Run; confirm it passes (locks the import path). If the import path doesn't resolve in functions, match the path other functions use for `@cultuvilla/shared/...`.
- [ ] **Step 2 — edit the function:** import `isStartDayOver`; in the loop replace `const compareDate = data.endDate ?? data.startDate; if (compareDate < now)` with `if (isStartDayOver(data.startDate.toDate?.() ?? data.startDate, now))`. Verify whether `eventsCollection(db)` is converter-wrapped (Date) or raw (Timestamp) and pass a `Date` accordingly.
- [ ] **Step 3 — run functions tests, confirm green.**
- [ ] **Step 4 — commit:** `git commit -am "feat(functions): complete events after Madrid start-day"`

---

### Task 12: Functions reading old ownership

**Files:** Modify `functions/src/events/addWalkInRegistration.ts` (and any other function gating on `organizationId`); Tests under `functions/src/__tests__/...`.

- [ ] **Step 1 — update tests** for `addWalkInRegistration` (and `registerToEvent`/roster handlers if they read ownership) to fixtures with `organizerUserIds`/`organizerOrgIds`; assert a user in `organizerUserIds` (or village admin/app admin) may add a walk-in, an org member (not listed) may not. Run → FAIL.
- [ ] **Step 2 — edit:** replace `eventData.organizationId`/`isOrgMember` authorization with `eventData.organizerUserIds.includes(callerUid) || isVillageAdmin(...) || isAppAdmin(...)` (use the existing admin-side membership helpers). Log via `logger.info(msg, { handler, ... })` per `cloud-function-logging`.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "refactor(functions): roster access via organizerUserIds"`

---

## Phase E — Mobile UI

### Task 13: `OrganizerPicker` component

**Files:** Create `apps/mobile/components/feature/OrganizerPicker.tsx`; Test `apps/mobile/components/feature/__tests__/OrganizerPicker.test.tsx`.

**Produces:** a controlled component:
```ts
function OrganizerPicker(props: {
  municipalityId: string;
  selectedUserIds: string[];
  selectedOrgIds: string[];
  lockedUserId?: string;            // creator — shown, cannot be removed
  onChangeUsers: (ids: string[]) => void;
  onChangeOrgs: (ids: string[]) => void;
}): JSX.Element
```

- [ ] **Step 1 — test:** mock `getVillageMembers` + user profiles + `getOrganizationsByMunicipality`. Assert it renders the locked creator chip; toggling an org via `ChoiceList` calls `onChangeOrgs`; selecting a villager via the `AttendeeSheet` flow calls `onChangeUsers`; the locked user cannot be deselected. Run → FAIL.
- [ ] **Step 2 — implement:** load villagers (`getVillageMembers` → batch `getUserProfile` for `displayName`, MembersList pattern) into `AttendeeOption[]`; load the creator's orgs (`getOrganizationsByMunicipality` + `getOrgMembershipsByUserInMunicipality`) into `ChoiceList` options (`mode="multi"`). Render selected users + orgs as `LiveOwnerChip`s. Enforce `lockedUserId` stays in `selectedUserIds`.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "feat(mobile): OrganizerPicker (multi user + org)"`

---

### Task 14: Event creation form

**Files:** Modify `apps/mobile/app/event/new.tsx`; Test `apps/mobile/app/event/__tests__/new.test.tsx`.

- [ ] **Step 1 — update the test:** `getMunicipality` mock returns `coordinates: { lat: 1, lng: 2 }`; assert `queryByTestId('endDate')` is null, `getByLabelText('event.locationName')` exists, and the organizer step renders. Run → FAIL.
- [ ] **Step 2 — edit the form:**
  - Remove `endDate` state + `DateField`.
  - Replace `locationText` with `coords`/`locationName`/`mapZoom` state; seed from the municipality (`setCoords(mun.coordinates)`, `setLocationName(mun.name)`); render `LocationPicker` + a `locationName` `Input` in the "when" step (require both in `validate`).
  - Replace single-org state with `organizerUserIds`/`organizerOrgIds` state seeded to `[user.uid]` / `[]`; render `<OrganizerPicker municipalityId locked creator … />` in the "details" step (remove the single-org buttons).
  - `submit`: `createEvent({ …, location: buildLocationData({ coordinates: coords!, displayName: locationName.trim() }), organizerUserIds, organizerOrgIds, createdBy: user.uid, … })`; drop `endDate`/`organizationId`/`organizationName`.
- [ ] **Step 3 — run, confirm PASS.**
- [ ] **Step 4 — commit:** `git commit -am "feat(mobile): event form — location, single date, organizers"`

---

### Task 15: Event detail — location + organizers

**Files:** Modify `apps/mobile/app/event/[eventId].tsx`.

- [ ] **Step 1 — render:** under the date, add the location row (label + open-in-maps via `Linking`, mirroring `VillageHomeBody.openDirections`) and an organizers section: `event.organizerOrgIds.map(id => <LiveOwnerChip ownerType="organization" ownerId={id} />)` and `event.organizerUserIds.map(id => <LiveOwnerChip ownerType="user" ownerId={id} />)`. Replace the old single `organizationName`/`LiveAvatar` block.
- [ ] **Step 2 — type-check / run mobile tests** for the screen; `pnpm check`.
- [ ] **Step 3 — commit:** `git commit -am "feat(mobile): event detail shows location + organizers"`

---

### Task 16: News creation form

**Files:** Modify `apps/mobile/app/news/new.tsx`.

- [ ] **Step 1 — add `OrganizerPicker`** (orgs + users, locked creator) to the news form; `createNewsPost({ …, organizerUserIds, organizerOrgIds })` instead of `authorUserId`/`authorOrgId`. Keep category/images/moderation.
- [ ] **Step 2 — run mobile tests** (add a light render test if none); `pnpm check`.
- [ ] **Step 3 — commit:** `git commit -am "feat(mobile): news form organizers"`

---

### Task 17: i18n strings

**Files:** Modify `packages/i18n/messages/es.json`.

- [ ] Add under `event`: `locationName`, `locationPin`, `organizersLabel`, `addOrganizerUser`, `addOrganizerOrg`; mirror needed keys under `news`. Remove `event.endDate`/`event.location`/org-singular keys if unreferenced (grep first). Commit `i18n(es): organizer + location strings`.

---

## Phase F — Migration

### Task 18: Combined dev backfill (events + news)

**Files:** Create `scripts/backfill-event-news-ownership.ts` (match `scripts/` runner + `firebase-admin-dev`).

- [ ] **Step 1 — idempotent script.** For each `events` doc and each `newsPosts` doc:
  - delete `endDate` (events) via `FieldValue.delete()`;
  - rebuild `location` (events): GeoPoint coords → `{ coordinates: {lat,lng}, displayName: oldText || municipalityName }`; text-only → `{ coordinates: <municipalityCoordinates>, displayName: oldText || municipalityName }`; if no coords available, log to a "needs-attention" list and skip the location field;
  - `organizerUserIds = [createdBy]`; `organizerOrgIds = <organizationId|authorOrgId> ? [it] : []`;
  - delete `organizationId`,`organizationName`,`authorUserId`,`authorOrgId` via `FieldValue.delete()`;
  - skip docs already migrated (have `organizerUserIds` array and no `endDate`).
  Log migrated/skipped/needs-attention counts (script logging conventions).
- [ ] **Step 2 — dry-run (read-only count) against dev, then run.** Record counts. Never beta/prod.
- [ ] **Step 3 — commit:** `git commit -am "chore(scripts): backfill events+news to new model"`

---

## Phase G — Green sweep

### Task 19: Fix stragglers + full check

- [ ] **Step 1 — grep every straggler:**

```bash
grep -rn "endDate\|organizationId\|organizationName\|authorUserId\|authorOrgId\|getEventsByCreator\|getEventCountByCreator\|getNewsPostsByCreator" packages apps functions --include=*.ts --include=*.tsx | grep -v node_modules
grep -rn "type: 'text'\|type: 'coordinates'\|locationText" packages apps functions --include=*.ts --include=*.tsx | grep -v node_modules
```

- [ ] **Step 2 — fix each hit:** rewrite `location` literals to `{ coordinates, displayName }`; drop `endDate`; replace old ownership fields with `organizerUserIds`/`organizerOrgIds`; rename query call sites. Touch e2e rules fixtures (`shapeRules`, `eventOrglessRules`), `eventStatusAndCheckin`, `ManagedEventsScroll.test`, OG render, registration/waitlist/denormalization function tests.
- [ ] **Step 3 — run the full suite:** `pnpm check`. Iterate to green.
- [ ] **Step 4 — commit:** `git commit -am "test: migrate fixtures to single-date + location + organizer model"`

---

## Self-review

- **Spec coverage:** single date (T2,T4,T8,T11,T19), real location (T1,T4,T8,T14,T15,T18,T19), ownership events (T2,T5,T7,T8,T10,T12,T13,T14,T15,T18), ownership news (T3,T6,T7,T9,T16,T18), one migration (T18), region excluded by design. ✓
- **Type consistency:** `organizerUserIds`/`organizerOrgIds: string[]`, `buildLocationData({coordinates,displayName})`, `isStartDayOver(start,now)`, control predicate identical in rules/hook/functions. ✓
- **Verification points flagged inline:** functions import path + Timestamp→Date (T11), `array-contains` indexes must exist before queries run (T7 before T8/T9), rules `in` operator on arrays (T5/T6), backfill needs coords fallback (T18).
- **Phasing:** A→B→C→D→E→F→G; checkpoint between phases. UI (E) depends on services (C) + component (T13). Migration (F) after models/services land.