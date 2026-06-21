# Dev data conformance guard + autonomous backfill

**Date:** 2026-06-21
**Status:** implemented

## Problem

The village screen (`apps/mobile/app/(tabs)/village.tsx`) crashes on load. Reads route
through the strict Firestore converter — [`makeConverter.fromFirestore`](../../../packages/shared/src/firebase/converters/makeConverter.ts)
calls `schema.parse(normalized)` and **throws** on mismatch, so a doc missing a
newly-added field crashes the whole screen.

The user guessed "people limit" (`maxAttendees`), but running the conformance check
built here **falsified** that — all dev event docs conform. The actual drift the check
surfaced:

- `municipalities/*/members` → `trustedNewsAuthor: expected boolean, received undefined`
  (1 doc). `VillageMemberDataSchema.trustedNewsAuthor` (`z.boolean()`, builder default
  `false`) was added after some dev member docs existed. The village screen calls
  `getVillageMembers`; the converter throws on this doc; the screen dies. **This is the
  reported bug.**
- `users/*/notifications` → `eventId: expected string, received undefined` (4 docs).
  `NotificationDataSchema.eventId` is `z.string().nullable()` — the key must be present
  (`null` when no event); the builder always writes it. These docs predate that.

Both schemas are correct. The **dev data is stale** — fields were added without
backfilling dev. The conformance check is the durable guard; the backfills are the
one-off fixes.

## Goals

1. A repeatable way to detect dev docs that no longer conform to their current zod
   schema, so a forgotten backfill is caught instead of surfacing as a screen crash.
2. Unblock the village screen now by backfilling the actual gaps the check finds.
3. Encode the expectation in `AGENTS.md` that dev is backfilled when a feature adds a
   field — and that agents may do this autonomously, no confirmation needed.

Non-goals (YAGNI): auto-fix from the checker; hermetic fixture vitest (chosen against —
it can't catch docs already drifted in live dev); any beta/prod conformance run.

## Design

### 1. `scripts/check-dev-conformance.mjs` — read-only conformance check

Reuses the established admin-SDK script pattern (`scripts/backfill-municipality-namelower.mjs`):
- `PROJECT_ID = 'villa-events'`; refuse to run if `admin.app().options.projectId` differs.
- Require `GOOGLE_APPLICATION_CREDENTIALS` (see `firebase-admin-dev` skill).

**Schema-by-path registry.** The check walks a hand-authored path tree that mirrors
[`packages/shared/src/firebase/refs/admin.ts`](../../../packages/shared/src/firebase/refs/admin.ts).
Path context is required because subcollection ids collide — `municipalities/*/members`
(VillageMember) and `organizations/*/members` (OrgMember) share the id `members` but use
different schemas, so a `collectionGroup('members')` query would mix them. The registry
is a tree of `{ collectionId, schema, sub?: [...] }`:

```
events            EventDataSchema          → registrations RegistrationDataSchema
municipalities    MunicipalityDataSchema   → barrios  BarrioDataSchema
                                           → places   PlaceDataSchema
                                           → members  VillageMemberDataSchema
                                           → joinRequests JoinRequestDataSchema
                                           → inviteTokens  InviteTokenDataSchema
organizations     OrganizationDataSchema   → members  OrgMemberDataSchema
organizerRequests OrganizerRequestDataSchema
persons           PersonDataSchema
users             UserDataSchema
notifications     NotificationDataSchema
occupations       OccupationDataSchema
occupationProposals OccupationProposalDataSchema
admins            AdminDataSchema
news*             NewsPost/Comment/Reaction/Report schemas (mirror refs/admin.ts exactly)
```

The implementation plan resolves the exact, complete set of paths against `refs/admin.ts`
at build time — the list above is indicative, not authoritative.

**Validation, not throwing.** For each path: fetch docs, run the exported
[`normalize`](../../../packages/shared/src/firebase/converters/walkers.ts) walker
(Timestamp→Date, GeoPoint→{lat,lng}), then `schema.safeParse(...)`. `safeParse` collects
issues instead of throwing on the first one — `fromFirestore` would abort the whole run.

**Output + exit code.** Per collection: total docs, nonconforming count. Per bad doc:
its id and each zod issue formatted `path: message` (e.g. `maxAttendees: Required`).
Exit non-zero when any doc fails, so the script is CI-wireable.

**Registry drift guard.** At root, call `db.listCollections()` and warn (not fail) when a
live root collection isn't in the registry — flags "added a collection, forgot to
register it for conformance". Subcollection drift is out of scope (would require a live
per-parent walk); accepted limitation, documented in the script header.

Municipalities are ~6k INE reference docs, almost all with no community and no
subcollections (those exist only for activated villages). The walk gates descent on the
parent's `communityActive` to avoid ~30k empty subcollection round-trips; a parent that
fails its own parse is descended into anyway, so drift below a drifted parent is never
hidden.

### 2. One-off backfill scripts (per actual gap)

Same guard pattern as `backfill-municipality-namelower.mjs`. Idempotent — only patch docs
missing the field, set the model builder's default. The gaps found:

- `scripts/backfill-village-member-trustednewsauthor.mjs` — sets `trustedNewsAuthor: false`
  on village-member docs missing it. Scopes via the ancestor path to
  `municipalities/*/members` so `organizations/*/members` (OrgMember, a different schema
  sharing the `members` collection-group id) is never touched.
- `scripts/backfill-notification-eventid.mjs` — sets `eventId: null` on notification docs
  missing it (`notifications` is unambiguous as a collection group).

### 3. `AGENTS.md` convention

New subsection adjacent to `### No retrocompat shims unless asked`: when a feature adds or
changes a model field, dev Firestore must be backfilled in the same change. Agents may run
the backfill against dev (`villa-events`) **autonomously, without asking for confirmation** —
dev is safe to mutate. `scripts/check-dev-conformance.mjs` verifies the result. Beta/prod
remain off-limits (CI / explicit user instruction only).

## Testing / verification

- `pnpm check:dev-conformance` before backfill → reported 5 nonconforming docs
  (1 member `trustedNewsAuthor`, 4 notification `eventId`), exited non-zero. This is the
  regression evidence — the "test on the data".
- Ran both backfill scripts (patched 1 member, 4 notifications).
- Re-ran the conformance check → `PASS`, exit zero.
- The fix lives at the data layer; the converter the village screen uses now parses every
  member doc, so `getVillageMembers` no longer throws.

## Files

- `scripts/check-dev-conformance.mjs` (new)
- `scripts/backfill-village-member-trustednewsauthor.mjs` (new)
- `scripts/backfill-notification-eventid.mjs` (new)
- `AGENTS.md` — `### Backfill dev when a schema field is added`
- `package.json` — `check:dev-conformance` alias (not in the `pnpm check` CI gate; needs
  dev credentials)
