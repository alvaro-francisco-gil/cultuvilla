---
name: add-firestore-collection
description: Use whenever adding a new Firestore collection — usually a first-class top-level collection scoped by `municipalityId`. Encodes the multi-file checklist (model + service + index re-export + services map + rules + composite index + vitest + rules test) so the change lands complete in one commit instead of trickling in over five.
---

# Add a new Firestore collection

Adding a collection is a multi-file change that's easy to do incompletely. Every step below ships in the **same commit**.

## Decide the path

Cultuvilla uses **first-class top-level collections** scoped by a `municipalityId` field (see AGENTS.md §3 and [docs/superpowers/specs/2026-04-29-open-feed-architecture-design.md](../../../docs/superpowers/specs/2026-04-29-open-feed-architecture-design.md)). Two questions:

1. **Is this entity owned by exactly one parent doc, with no cross-parent queries?** Yes → nest under that parent (e.g. `users/{uid}/notifications/{nid}`, `events/{eid}/registrations/{rid}`, `organizations/{orgId}/members/{uid}`). No → top-level (`events/`, `organizations/`, `persons/`, `news/`, …) with a `municipalityId` field.
2. **Default to top-level.** Only nest when the parent–child ownership is genuine and you never need to read children across parents. Nesting is the exception, not the rule.

## Checklist

### 1. Model

Create `packages/shared/src/models/<entity>.ts`. Export the type, the `Collections.<EntityKey>` path constant if the file maintains one, and any input shapes used at create/update time (`CreateXInput`, `UpdateXInput`). Keep fields strict — no `any`.

If the entity has subdocs (e.g. nested `images`), model the sub-shape as its own interface in the same file unless reused elsewhere.

### 2. Service

Create `packages/shared/src/services/<entity>Service.ts`. Banner-section style matching `eventService.ts` or `personService.ts`. Strict types on every export. No `any` at boundaries. No silent fallbacks.

Standard entry points to define (only those that are actually needed — YAGNI). For top-level collections the doc id alone identifies the entity; the `municipalityId` lives inside the doc and is passed in `create<Entity>Input`:

- `get<Entity>(id): Promise<Entity | null>`
- `get<Entity>sByMunicipality(municipalityId): Promise<Entity[]>`
- `create<Entity>(input: Create<Entity>Input): Promise<Entity>` — `input` includes `municipalityId`
- `update<Entity>(id, patch: Update<Entity>Input): Promise<void>`
- `delete<Entity>(id): Promise<void>`

For nested sub-collections (the exception, not the default — see "Decide the path"), thread the parent id through the signatures the same way `registrationService` does (`createRegistration(eventId, input)`).

Cross-user writes or trust-sensitive updates DO NOT go in the client service — they go in a Cloud Function callable. See the `guardrail-enforcement` skill.

### 3. Index re-export

Add the service to `packages/shared/src/services/index.ts`. Match the style of existing entries (`export * from './<entity>Service';`).

### 4. Services map

Add a row to [`packages/shared/src/services/_services-map.md`](../../../packages/shared/src/services/_services-map.md):

```markdown
| [<entity>Service](<entity>Service.ts) | `<collection>/` (top-level, `municipalityId` field) | <one-sentence summary> | `get<Entity>`, `get<Entity>sByMunicipality`, `create<Entity>`, `update<Entity>`, `delete<Entity>` |
```

The map is the agent index. Skipping this row means future sessions won't find your service.

### 5. Rules

Open [`firestore.rules`](../../../firestore.rules). Add a top-level match block for the new collection. Derive the municipality from the doc's `municipalityId` field, not from the path:

```
match /<collection>/{docId} {
  allow read: if isVillageMember(resource.data.municipalityId);
  allow create: if isVillageMember(request.resource.data.municipalityId);
  allow update: if isOwner(resource.data.createdBy)
                  || isVillageAdmin(resource.data.municipalityId);
  allow delete: if isOwner(resource.data.createdBy)
                  || isVillageAdmin(resource.data.municipalityId);
}
```

Adjust the predicates for the actual access model. Use the existing helper functions (`isVillageMember`, `isVillageAdmin`, `isOwner`, `isAppAdmin`) — don't redefine identity checks inline. They already take a `municipalityId` argument.

If the write is cross-user or trust-sensitive (only the village admin can grant a role, only the organizer can finalize an event, etc.), tighten the rule to `allow write: if false` for the affected fields and route the write through a Cloud Function — see `guardrail-enforcement`.

### 6. Composite index

Open [`firestore.indexes.json`](../../../firestore.indexes.json). Add a composite index for the standard `(municipalityId, <sortField>)` filter+sort shape that the by-municipality query uses:

```json
{
  "collectionGroup": "<collection>",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "municipalityId", "order": "ASCENDING" },
    { "fieldPath": "<sortField>", "order": "DESCENDING" }
  ]
}
```

Use `queryScope: "COLLECTION_GROUP"` only when you genuinely need to query across nested parents (rare, since most collections are top-level). The cost of an unused index is negligible; the cost of a runtime "this query requires an index" error in front of a user is high.

### 7. Vitest

Create `packages/shared/test/services/<entity>Service.test.ts`. Cover at minimum:

- `create<Entity>` writes the expected shape (mocked Firestore or fakes — match existing tests in `packages/shared/test/services/`).
- `update<Entity>` rejects an invalid patch (e.g. missing required field) by throwing, NOT silently swallowing.
- `get<Entity>` returns `null` (not undefined) for a missing doc.

Run: `pnpm shared:test` — should pass.

### 8. Rules test

Create `packages/shared/test/e2e/<entity>Rules.test.ts` (the convention in this repo — rules tests live in `e2e/`, e.g. `villageRules.test.ts`). Cover at minimum:

- An authenticated village member CAN create a doc.
- An authenticated NON-member CANNOT create a doc.
- A doc owner CAN update; a non-owner non-admin CANNOT.

Run: `pnpm test:rules` — should pass.

### 9. Deploy notes in the PR description

If the rules or indexes file changed, the PR description must note that a deploy is needed and to which env (default dev — use the `firestore-deploy` skill). Indexes build asynchronously after deploy.

## Required outputs

- [ ] Model in `packages/shared/src/models/<entity>.ts` with strict types.
- [ ] Service in `packages/shared/src/services/<entity>Service.ts`, exported from `index.ts`.
- [ ] Row added to `_services-map.md` in the same commit.
- [ ] Rules block in `firestore.rules` using existing helper predicates.
- [ ] Composite index entry in `firestore.indexes.json` for `(municipalityId, sortField)` (or the equivalent shape your queries use).
- [ ] Service vitest + rules e2e test.
- [ ] PR description notes the deploy needed.

## Don't

- **Don't ship the service without updating `_services-map.md`.** Stale map = blind future sessions.
- **Don't put a cross-user write in the service.** Wrong layer. Use a callable. See `guardrail-enforcement`.
- **Don't nest under a parent doc when top-level works.** Top-level + `municipalityId` is the default; only nest when the parent–child ownership is genuine and you'll never need to query children across parents.
- **Don't redefine identity check predicates in the rules block.** Use the existing helpers.
- **Don't ship rules + indexes without flagging the deploy** — they don't auto-propagate from the merge.

## When this skill applies

- A user asks to "add a <thing> collection", "model <entity>", or "track <thing> per village".
- A feature spec mentions a new entity that doesn't have a service today.
- A code review flags a query that can't be expressed against existing collections.

## Companion skills

- `touch-service` — once the service file exists, every change to it follows that procedure.
- `firestore-deploy` — for actually pushing the rules + indexes to dev.
- `guardrail-enforcement` — for any write that needs to live in a Cloud Function rather than the client service.
- `denormalized-read-model` — if the new collection holds copies of fields owned elsewhere.
