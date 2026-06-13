# Event co-organizers — replace single `organizationId` with an organizer set

## Status

- **Stage:** ready (decided, not started)
- **Decided by:** [business-rules.md §7.2](../../business-rules.md), §13
- **Blocker before coding:** pick the **edit-permission architecture** (see
  "Open architecture decision" below). Everything else is mechanical.

## Goal

An event today has a single organizer: `organizationId` + `organizationName` +
`createdBy`. The business rule ([§7.2](../../business-rules.md)) is an organizer
**set**:

- zero-or-more **co-organizer users** (the creator is always one), and
- zero-or-more **co-organizing organizations**;
- valid shapes: self-only, org(s)-name-only, self + org(s); multiple users *and*
  orgs may co-organize;
- co-organizers must belong to the **same village** as the event; any village
  member may add any other member or any org of that village, **with no consent
  step**.

## Proposed shape

```ts
// on EventData — replaces organizationId / organizationName
organizerUserIds: string[]                       // includes createdBy; for `uid in …` rule checks
organizerUsers:   { userId: string; name: string }[]   // denormalized for display
organizerOrgIds:  string[]                       // co-organizing orgs
organizerOrgs:    { orgId: string; name: string }[]    // denormalized for display
createdBy:        string                          // kept (audit + getEventsByCreator)
```

## Open architecture decision (resolve first)

The edit/cancel rule is "**any co-organizer user OR any member of a co-organizing
org OR village admin OR superadmin**." Firestore rules can check
`request.auth.uid in resource.data.organizerUserIds`, `isVillageAdmin(...)`, and
`isAppAdmin()` — but they **cannot iterate `organizerOrgIds` to check membership of
each org**. Two ways to satisfy the rule:

1. **Callable-mediated writes (recommended, idiomatic).** Move event
   create/update/cancel into Cloud Function callables that enforce the full
   predicate with the admin SDK; `firestore.rules` denies direct client writes
   (same pattern as `registerToEvent`, `requestJoinVillage`, news moderation).
   Cost: new callables + service rewrite + rules flip + tests.
2. **Denormalized `editorUserIds: string[]`.** A trigger keeps `editorUserIds` =
   union(organizerUserIds, members of each organizerOrg, village admins); rules
   check `uid in editorUserIds`. Cost: triggers on event writes, on
   `organizations/{orgId}/members/{uid}` writes, and on village-admin changes,
   plus a backfill. More moving parts; counters-style drift risk.

## Blast radius (from a full-repo sweep)

**Model / schema**
- `packages/shared/src/models/event/EventDataModel.ts` — schema, `EventDataInput`,
  `buildEventData` (the three organizer fields).
- `packages/shared/src/models/event/EventFormSchema.ts` — the form does not carry
  organizer fields today; decide whether the picker feeds the form or the service.

**Service**
- `packages/shared/src/services/eventService.ts` — `createEvent` write;
  `getEventsByOrganization` (filters `organizationId ==`), `getEventsByCreator` /
  `getEventCountByCreator` (filter `createdBy ==`). New queries likely want
  `array-contains` on `organizerOrgIds` / `organizerUserIds`.

**Rules & indexes**
- `firestore.rules` — `isValidEventCreate` shape (the three fields), and the
  create/update/delete gates (`isOrgMember(... organizationId)`). This is where
  the architecture decision lands.
- `firestore.indexes.json` — `organizationId + startDate`, `createdBy + createdAt`
  composite indexes → replace with `array-contains` equivalents as needed.

**Cloud Functions** — `registerToEvent`, `waitlistPromotion`, `eventCompletion`,
`notificationTriggers` read events but **do not** use organizer fields for logic
(verified); they only need to keep compiling against the new shape. `isMember` on a
registration is **village** membership, unrelated to organizers — leave as-is.

**Mobile UI**
- `apps/mobile/app/event/new.tsx` — single-org picker (`selectedOrgId`) →
  multi-select orgs + co-organizer users.
- `apps/mobile/app/event/[eventId].tsx` and
  `apps/mobile/components/feature/EventCard.tsx` (+ its test) — display
  `organizationName` → render the organizer set.
- Feed/list mappers passing `organizationName`:
  `app/(tabs)/index.tsx`, `app/village/[villageId]/index.tsx`,
  `app/me/registrations.tsx`.

**Tests / seeds** — `EventDataModel.test.ts`, `eventConverter.test.ts`,
`shapeRules.test.ts`, `EventCard.test.tsx`, `registerToEvent.test.ts`,
`waitlistPromotion.test.ts`, `eventService.profileStats.test.ts`,
`scripts/seed-dev-fixtures.mjs`.

**Migration** — existing event docs need a one-off backfill:
`organizerUserIds = [createdBy]`, `organizerUsers = [{ userId: createdBy, name }]`,
`organizerOrgIds = [organizationId]`, `organizerOrgs = [{ organizationId,
organizationName }]`; then drop the old fields.

## Out of scope / interactions

- Interacts with **OQ-1** (org-member ⇒ village-member) in
  [business-rules.md §11](../../business-rules.md) — not a hard blocker, but settle
  it before finalizing the "member of a co-org may edit" rule.
- Does not change registration, capacity, waitlist, or attendee-privacy rules.
