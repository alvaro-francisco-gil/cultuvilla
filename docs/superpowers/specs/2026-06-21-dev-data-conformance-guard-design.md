# Dev data conformance guard + autonomous backfill

**Date:** 2026-06-21
**Status:** approved, pre-implementation

## Problem

The village screen refactor (working tree, `apps/mobile/app/(tabs)/village.tsx`) now
loads published events via `getEventsByMunicipality`. Reads route through the strict
Firestore converter — [`makeConverter.fromFirestore`](../../../packages/shared/src/firebase/converters/makeConverter.ts)
calls `schema.parse(normalized)` and **throws** on mismatch.

`EventDataSchema.maxAttendees` (a required, nullable "people limit") was introduced
2026-05-29 (commit `b097204`, schema-first refactor). Event docs in dev Firestore
created before that lack the field. The converter throws `maxAttendees: Required`, and
the throw blocks the entire village screen from loading.

The schema is correct. The **dev data is stale** — the field was added without
backfilling existing dev docs. This is a recurring class of bug: add a required field
to a model, forget to backfill dev, and any screen that reads that collection breaks.

## Goals

1. A repeatable way to detect dev docs that no longer conform to their current zod
   schema, so a forgotten backfill is caught instead of surfacing as a screen crash.
2. Unblock the village screen now by backfilling the existing `maxAttendees` gap.
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

### 2. `scripts/backfill-event-maxattendees.mjs` — one-off backfill

Same guard pattern. Idempotent: batches `update(ref, { maxAttendees: null })` only for
event docs where `maxAttendees === undefined`. Logs already-correct vs patched counts.
Run once against dev to unblock the village screen.

### 3. `AGENTS.md` convention

New subsection adjacent to `### No retrocompat shims unless asked`: when a feature adds or
changes a model field, dev Firestore must be backfilled in the same change. Agents may run
the backfill against dev (`villa-events`) **autonomously, without asking for confirmation** —
dev is safe to mutate. `scripts/check-dev-conformance.mjs` verifies the result. Beta/prod
remain off-limits (CI / explicit user instruction only).

## Testing / verification

- `node scripts/check-dev-conformance.mjs` before backfill → reports the `maxAttendees`
  drift, exits non-zero (this is the regression evidence — the "test on the data").
- Run `scripts/backfill-event-maxattendees.mjs`.
- Re-run the conformance check → exits zero.
- Re-walk the repro: village screen loads events without the `maxAttendees: Required` throw.

## Files

- `scripts/check-dev-conformance.mjs` (new)
- `scripts/backfill-event-maxattendees.mjs` (new)
- `AGENTS.md` (new subsection)
- possibly `package.json` scripts (`check:dev-conformance`) — decided in the plan
