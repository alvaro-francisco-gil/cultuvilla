# Denormalized read models

When and how to copy data from one Firestore document onto another, and how to keep those copies in sync. This is the pattern cultuvilla uses for high-fan-out reads. Read this before adding a new collection or a new feature that lists data from across the app.

## The problem

Firestore reads are cheap individually, but they don't compose. A naïve "list upcoming events across all villages" view that needs to show `villageName` and `villageCoverImage` for each event would either:

1. Do one read per event to fetch the village → N+1, slow, expensive at the limit.
2. Issue a single collection-group query and discover at render time that it doesn't carry the fields the UI needs.
3. Force the client to maintain a parallel `villages` cache.

None of these survive contact with mobile networks and Firestore quotas.

## The pattern

Pick a small set of fields that callers need at list time. Store a **copy** of those fields directly on the read-target documents at write time, and update the copies whenever the source changes — via a Cloud Function trigger, never the client.

For example, a municipality's escudo is the source of truth for a village's
cover image. Every event carries a denormalized copy as
`events/{eid}.villageCoverImage`. The feed query reads top-level events only; it
never has to JOIN to municipalities. (On the municipality/village naming, see
[municipality-vs-village.md](./municipality-vs-village.md): events live in a flat
top-level `events/` collection keyed by a `municipalityId` foreign key, and carry
`village*` display copies.)

```
                   ┌─ source of truth ──────────┐
                   │   municipalities/{id}      │
                   │   .name                    │
                   │   .escudoManualUrl/escudoUrl│
                   │   .coordinates             │
                   └────────────┬───────────────┘
                                │ onDocumentUpdated
                                ▼
                   ┌─ Cloud Function trigger ───┐
                   │ syncVillageDenormalization │
                   └────────────┬───────────────┘
                                │ batch update
                                ▼
                   ┌─ read model ───────────────┐
                   │ events/{eid} (top-level)   │
                   │   .villageName             │
                   │   .villageCoverImage       │
                   │   .villageCoordinates      │
                   └────────────────────────────┘
```

## When to use it

Use a denormalized read model when **all** of the following are true:

1. The read happens on a hot path — a list, a feed, a search result — where the user is waiting.
2. The data crosses a collection boundary, or would require N+1 follow-up reads.
3. The denormalized fields change much less often than they are read. (Cover image: rare. Attendee count: often. Different tradeoffs.)
4. You are willing to accept brief staleness between source write and propagation (typically <2s in practice).

If any of these is false, don't denormalize — query the source instead.

## When **not** to use it

- The query is admin-only or runs once a day.
- The field changes on every read-side event (e.g., live attendee count — use a counter document or `getCountFromServer` instead).
- You're tempted to copy *every* field of the source. That isn't denormalization, it's duplication; you'll fight drift forever.
- The value should stay **current** everywhere, lives on a **readable** source doc, and you never query by it (e.g. a villager's profile photo). Don't copy it — store the id and subscribe to the source. See [live references](./live-references.md) for that pattern and the full copy-vs-reference decision rule.

## The rules

1. **One source of truth.** The original document is authoritative. The copy is disposable; the function rebuilds it from the source on every relevant change.
2. **Copy only what the read needs.** If the feed shows name + cover image, copy those two fields. Not the village description, not the timezone, not the admin list.
3. **Sync runs server-side, never on the client.** Clients write the source; a function propagates. Clients must not write to denormalized fields directly — Firestore rules should reject it.
4. **The trigger lives next to the source.** Name it for what it does: `syncVillageDenormalization`, not `onVillageUpdate`. If villages get archived (delete), the trigger handles that too.
5. **Batch in chunks of 500.** Firestore commits cap at 500 ops. The existing trigger paginates; copy that idiom.
6. **Trigger only on actual changes.** Compare `before` and `after`; bail out early when none of the watched fields changed. This is what keeps the function from re-running itself in a loop, and keeps cost predictable.
7. **Record every denormalized field in the [services map](../../packages/shared/src/services/_services-map.md).** New denormalized fields without a documented trigger are a bug.

## The canonical example

[functions/src/village/syncVillageDenormalization.ts](../../functions/src/village/syncVillageDenormalization.ts) is the example to copy. It demonstrates:

- Watching `municipalities/{municipalityId}` for updates.
- Comparing watched fields (`name`, escudo, `coordinates`) between before/after.
- Early return when nothing relevant changed.
- A top-level query (`events` where `municipalityId == ...`) for fan-out.
- Chunked batched updates (500 per commit).

When adding a new denormalization trigger, mirror its structure.

## Existing read models

### `users/{uid}.displayName` ← `persons/{personId}`

The user document carries a denormalized projection of the linked persona's
name (`buildDisplayName(person)` = givenName + middleNames + firstSurname +
secondSurname). The user menu and several name-rendering surfaces read it
without joining the persons collection.

- **Source of truth:** `persons/{personId}` with the link
  `person.userId == users/{uid}`.
- **Trigger:** [functions/src/users/syncPersonDenormalization.ts](../../functions/src/users/syncPersonDenormalization.ts).
  Fires `onDocumentWritten`, projects the name, short-circuits when unchanged,
  uses `set(merge:true)` so it can populate `users/{uid}.displayName` even
  before the client's onboarding flow has finished creating the user doc.
- **Rules:** `firestore.rules` blocks clients from writing `displayName` on
  `users/{uid}` for both create and update.
- **Backfill:** [scripts/backfill-user-displayname.mjs](../../scripts/backfill-user-displayname.mjs)
  reconciles existing user docs whose persons predate the trigger.
- **Delete behavior:** the trigger leaves `users/{uid}.displayName` intact on
  person delete — the user's name is still a useful last-known value; an
  explicit account flow can clear it later if needed.

### `commentCount` ← `comments/`

Every entity kind (event, organization, festivalPoster, place, barrio, news)
carries a running comment count on its own doc, so cards and detail screens
can show it without a `getCountFromServer` per entity per render.

- **Source of truth:** the generic top-level `comments/` collection, each doc
  carrying `entityKind` + `entityId` (+ `municipalityId` for routing to
  nested parents).
- **Trigger:** [functions/src/interaction/syncEntityInteractionCounts.ts](../../functions/src/interaction/syncEntityInteractionCounts.ts)
  — `syncEntityCommentCount`, an `onDocumentWritten` on `comments/`. Routes by
  `entityKind` to the right parent doc: top-level for `event` /
  `organization` / `festivalPoster` / `news`, nested
  (`municipalities/{municipalityId}/places/{id}` or `.../barrios/{id}`) for
  `place` / `barrio`. The count is incremented/decremented with
  `FieldValue.increment`, not recomputed from a full scan — this is a
  counter, not a projected copy (see "Counters vs. denormalization" below).
- **Rules:** `firestore.rules` excludes `commentCount` from every entity
  doc's client-writable update fields; only the trigger (admin SDK) can
  change it. Create rules require the field present and zeroed.
- **Backfill:** [scripts/backfill-entity-comment-counts.mjs](../../scripts/backfill-entity-comment-counts.mjs)
  reconciles existing entity docs against the actual `comments` data.
- **Delete behavior:** deleting an entity does not need to zero its own
  count (the doc goes away); deleting a `comments` doc via cascade (e.g.
  `deleteNewsPost`) still fires the trigger per deleted doc, so counts on a
  *surviving* parent stay correct. A parent deleted out from under a
  still-in-flight trigger is a no-op (`isNotFound` guard), not a retry loop.

### `readCount` ← incremented directly by a callable (no source collection)

Every entity kind also carries an invisible `readCount`, tracking detail-screen
views. Unlike every other row in this doc, there is no source-of-truth
collection to project from — the mobile app fires a fire-and-forget
`recordEntityView({ entityKind, entityId, municipalityId })` once per detail
screen mount, and the callable increments the field directly. There is no
reactions/likes feature — it was removed in favor of this invisible counter.

- **Write path:** [functions/src/interaction/recordEntityView.ts](../../functions/src/interaction/recordEntityView.ts)
  (`recordEntityView` callable) calls the same `applyToParent` helper
  `syncEntityCommentCount` uses, so both counters route through one
  entity-kind switch.
- **Rules:** `firestore.rules` excludes `readCount` from client-writable
  update fields, same as `commentCount`; only the callable (admin SDK) can
  change it. Create rules require the field present and zeroed.
- **Backfill:** [scripts/backfill-entity-readcount.mjs](../../scripts/backfill-entity-readcount.mjs)
  sets `readCount: 0` on existing entity docs missing the field and drops any
  leftover `reactionCounts` field from the old reactions feature.
- **Not surfaced in the UI today** — it's tracked for future use (e.g.
  ranking, moderation signal), not rendered on any card or detail screen.

### `memberCount` ← `organizations/{orgId}/members/` and `residentCount` ← `persons/`

Membership-size counters that back **ordering** on the village hub: peñas /
agrupaciones sort by member count, barrios by resident count (both descending,
name as tie-break). They are the reason these are denormalized triggers rather
than the `getCountFromServer` aggregate the "Counters vs. denormalization"
section below would otherwise prescribe — the hub renders *every* org and barrio
in the village, so the old approach fired one count-aggregate query per entity
(an N+1 on a hot path) **and** the counts arrived in a separate async map after
the list order was already fixed, so they couldn't drive ordering at all. Moving
the count onto the list doc removes the fan-out and lets the hub sort in memory
with no extra reads and no visible reshuffle.

- **Source of truth is membership, not a count doc.** `syncOrgMemberCount`
  ([functions/src/organizations/syncOrgMemberCount.ts](../../functions/src/organizations/syncOrgMemberCount.ts))
  watches `organizations/{orgId}/members/{userId}` and applies ±1 on
  create/delete (role changes are a no-op). `syncBarrioResidentCount`
  ([functions/src/village/syncBarrioResidentCount.ts](../../functions/src/village/syncBarrioResidentCount.ts))
  watches `persons/{personId}` and diffs the `municipalityLinks` barrio set,
  applying ±1 to each barrio a person gains or loses (whole-village links with
  `barrioId: null` count toward no barrio). Both use the field-path
  `.update(field, increment)` overload (no converter) and swallow `NOT_FOUND`
  so a parent deleted mid-cascade doesn't retry forever.
- **Rules:** `firestore.rules` forbids clients writing `memberCount` /
  `residentCount` on update and requires them zeroed at create — function-owned,
  same as the comment/read counters.
- **Backfill:** [scripts/backfill-org-member-count.mjs](../../scripts/backfill-org-member-count.mjs)
  and [scripts/backfill-barrio-resident-count.mjs](../../scripts/backfill-barrio-resident-count.mjs)
  recompute the true count from the source and write it; they double as repair
  tools if a trigger ever drifts.

## Adding a new denormalized field — checklist

1. Add the field to the **read-model document's** data model in `packages/shared/src/models/`.
2. Set it on document creation (in the relevant service's `create*` function) so new documents are correct from day one.
3. Add a trigger in `functions/src/` that watches the **source** document and propagates the field on update.
4. Add a row to the "Denormalized fields" table in [_services-map.md](../../packages/shared/src/services/_services-map.md).
5. Tighten Firestore security rules so clients cannot write the denormalized field directly.
6. Decide what happens on source delete: cascade? null out? leave a tombstone? Implement that in the trigger.
7. If the read model is large and existing documents need backfilling, write a one-shot script under `scripts/` and run it once.

## Counters vs. denormalization

If the field you want to copy is a **count** (attendees, comments, likes), don't write a denormalization trigger — write a counter. Use Firestore aggregation queries (`getCountFromServer`) for low-traffic counts, or maintain a dedicated counter document for high-traffic ones (incremented in a transaction or by a function on the write trigger). Counters and denormalization look similar but the staleness profile is different.

## Failure modes

- **Drift.** The trigger silently fails on one event in a 500-doc batch, and that one event renders with a stale village name forever. Mitigation: every trigger should log structured info (`functions.logger.info({ event, count })`); set up alerting; reseed via a script if drift is detected.
- **Infinite loops.** A trigger writes to a doc that triggers itself. Mitigation: rule (6) — bail on no-op updates; also, never let the trigger touch the source document.
- **Cascading writes.** A new field added without thought turns one write into hundreds. Mitigation: rule (3) — copy only what the read needs.
- **Forgotten triggers.** A new service writes denormalized fields on create, but no trigger updates them. Mitigation: services-map row + trigger live in the same PR.

## Future work

This pattern works at our current scale. If we ever need to denormalize across thousands of villages with frequent source-side updates, we should revisit:
- Switching to event-sourced read models (write all changes to an `events` log, build read models from there).
- Using Cloud Tasks to throttle very wide fan-outs.
- Moving high-churn fields back to a JOIN-style two-read flow and caching on the client.

We are nowhere near needing any of that today.
