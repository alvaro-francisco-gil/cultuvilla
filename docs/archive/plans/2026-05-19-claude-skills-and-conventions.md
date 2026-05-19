# Claude skills + AGENTS.md conventions — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the agent-facing procedural skills from `ordago-apps` to cultuvilla (adapted), add four cultuvilla-specific skills, stub three forward-looking skills for the planned mobile app, and make five targeted additions to `AGENTS.md`.

**Architecture:** Each skill is one `SKILL.md` file under `.claude/skills/<name>/` with YAML frontmatter (`name`, `description`) and a Markdown procedure body. Cross-references between skills use plain skill names; cross-references to repo files use repo-relative Markdown links. AGENTS.md additions are inserted at specified anchors without rewriting surrounding content.

**Tech Stack:** Markdown only — no build step, no tests for the skill files themselves. Validation is "every path the skill mentions resolves" and "every command the skill prescribes is a real script in `package.json`."

**Source spec:** [docs/superpowers/specs/2026-05-19-claude-skills-and-conventions-design.md](../specs/2026-05-19-claude-skills-and-conventions-design.md)

**Working directory:** This is a docs-only change. Implement directly on `main` with one commit per task — the `feedback_push_main` user-memory permits direct-to-main, and there's no test or build risk to isolate. Worktrees are unnecessary here.

---

## Implementation order rationale

1. **AGENTS.md additions** first — they introduce the cross-references the skills will be linked from. Doing this first means each later skill commit can be linked from AGENTS.md without a follow-up edit.
2. **New cultuvilla-specific skills** next — they encode patterns that live only in cultuvilla, no template exists elsewhere.
3. **Adapted ordago skills** — heaviest content, but each one is a port with bounded substitutions.
4. **Forward-stubs** — smallest, lowest-risk, last.

---

## Task 1: AGENTS.md additions (5 targeted edits)

**Files:**
- Modify: `AGENTS.md`

These five insertions land in one commit. Each is a precise edit at an anchor in the existing file.

- [ ] **Step 1.1: Read the current AGENTS.md to confirm anchors**

Run: `head -160 AGENTS.md`
Expected: see headings `## Conventions`, `### Cloud Functions logging`, `## Commands`, `## Development workflow`, `## Things to flag in PRs (or right here when you find them)`. These are the anchors used below.

- [ ] **Step 1.2: Insert "Never start dev servers" rule after `## Commands`**

Find the existing block ending with `Pre-commit (Husky + lint-staged) runs ...`. Immediately after that paragraph, add a new H3 section:

```markdown
### Never start dev servers

You (Claude) do not start long-running processes — the user owns the iteration loop. Don't run:

- `pnpm web:dev` (Next.js dev server)
- `pnpm test:integration`, `pnpm test:rules`, `pnpm test:functions`, or `pnpm test:emulators` (they boot Firebase emulators that the user wants to keep alive)
- `firebase emulators:start` directly
- Any deploy script (`pnpm deploy:*`) — use the `firestore-deploy` skill instead

If you need output from a long-running service to verify a change, ask the user to run it and paste the relevant lines.
```

- [ ] **Step 1.3: Insert "No retrocompat shims" rule under `## Conventions` after `### Delete > deprecate`**

Find the existing `### Delete > deprecate` block. Immediately after its body (before the next H3), add:

```markdown
### No retrocompat shims unless asked

When changing the shape of data already in Firestore, surface the migration explicitly:

- Note the affected docs and field(s) in the commit body and the PR description.
- Add a backfill script under `scripts/` when the change can't be expressed as a Cloud Function trigger.
- Don't leave dual-read code, shim re-exports, or `// removed: …` comments. Pairs with the `### Delete > deprecate` rule above.

Only add a compatibility layer when the user explicitly asks for one (e.g. when an in-flight client release would break without it).
```

- [ ] **Step 1.4: Insert "Be proactive" section after `## Things to flag in PRs (or right here when you find them)`**

The existing section ends with the bullet `Work that landed outside a worktree (and so might have polluted main's checkout state).`. After that bullet, append a new H2 section at the end of the file:

```markdown
## Be proactive

You're expected to propose improvements, not just execute tasks. End your response with a one-line suggestion (or an inline diff if the change is under ~10 lines) when you notice:

- **Repeated manual ops (2+ times)** → script in `scripts/`.
- **Encodable workflow** (deploy recipe, migration ritual, audit playbook) → skill under `.claude/skills/<name>/SKILL.md`.
- **Convention used in 3+ places but undocumented** → addition to this file, or a new sub-directory `AGENTS.md` (e.g. `functions/AGENTS.md`, `packages/shared/AGENTS.md`, `apps/web/AGENTS.md`) so agents working there don't load the whole root file.
- **Single source of truth violated** (duplicated enum, status string, threshold, hex colour) → consolidate in the same commit if small, propose a follow-up if not.
- **Docs contradicting code** → fix or delete the doc; don't work around it.
- **Shipped plan in `docs/superpowers/plans/`** → move to `docs/plans/` (canonical) or `docs/archive/plans/` (done). See the `manage-plan-docs` skill.
- **Service touched without tests** → propose adding the missing coverage.

Soft proposals are the default — the user accepts or declines. Don't pre-implement large refactors uninvited; surface, then wait.
```

- [ ] **Step 1.5: Add skill cross-references under existing Architecture invariants**

Under `### 1. Service-layer ownership`, after the existing paragraph, add a single line:

```markdown

> **See also:** the `touch-service` and `guardrail-enforcement` skills for the procedures.
```

Under `### 3. Data is nested under `villages/{villageId}/``, after the existing paragraph, add:

```markdown

> **See also:** the `add-firestore-collection` skill for the multi-file checklist when adding a new sub-collection.
```

Under `### 4. Denormalized read models for high fan-out`, after the existing paragraph, add:

```markdown

> **See also:** the `denormalized-read-model` skill for the step-by-step.
```

Under `### Cloud Functions logging`, immediately after the code block, add:

```markdown

> **See also:** the `cloud-function-logging` skill for the rationale and severity guidance.
```

- [ ] **Step 1.6: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): add proactive-suggestions, dev-server prohibition, and skill cross-links

- Section: "Never start dev servers" — explicit no-go list (web:dev,
  emulators, deploy scripts).
- Section: "No retrocompat shims unless asked" — pairs with delete-not-deprecate.
- Section: "Be proactive" — one-line suggestions for repeated ops,
  encodable workflows, undocumented conventions.
- Cross-links from architecture invariants to the new .claude/skills/.
EOF
)"
```

---

## Task 2: New skill — `cloud-function-logging`

**Files:**
- Create: `.claude/skills/cloud-function-logging/SKILL.md`

- [ ] **Step 2.1: Verify the enforcement test path**

Run: `ls functions/src/__tests__/helpers/no-console.test.ts`
Expected: file exists.

- [ ] **Step 2.2: Write the skill**

Create `.claude/skills/cloud-function-logging/SKILL.md`:

````markdown
---
name: cloud-function-logging
description: Use whenever adding or modifying log statements in `functions/src/**` — encodes the `console.* -> logger.info(msg, { handler, ...fields })` rule from AGENTS.md, the `handler` convention, severity levels, and why the no-console test fails the build when this rule is violated.
---

# Cloud Function logging

Cloud Functions write to Cloud Logging. **Never use `console.*` in `functions/src/`** — `console.log("foo " + bar)` produces an unstructured `textPayload` that Cloud Logging filters and dashboards can't query. Use the v2 logger from `firebase-functions/v2` with a structured second argument.

## The shape

```ts
import { logger } from 'firebase-functions/v2';

logger.info('Migrated persons', {
  handler: 'onOccupationProposalApproved',
  proposalId,
  pendingOccupation: name,
  migratedCount: snap.size,
});
```

The second argument becomes searchable `jsonPayload` fields in Cloud Logging. Cluster-wide filters work off these — `jsonPayload.handler="onOccupationProposalApproved"` is how you find every invocation in the log explorer.

## Required field: `handler`

Every log call inside a Cloud Function MUST include `handler` in the structured second arg, set to the function name. Without it, filters in the log explorer can't isolate one Cloud Function from another.

Helper handlers that aren't exported as their own Cloud Function still set `handler` to the **caller** they were invoked from (or the most-specific scope an operator would search for). When in doubt, set `handler` to the file's exported function name.

## Severity levels

- **`logger.info`** — the function did something noteworthy that succeeded. Default.
- **`logger.warn`** — recoverable anomaly. The function continued but skipped or worked around something. Example: "registration was already cancelled, skipped notification fan-out."
- **`logger.error`** — the function bailed out unsuccessfully. Use this only when the caller will see an error or the operation did not complete. Don't `logger.error` and then continue — that signal becomes meaningless.
- **`logger.debug`** — verbose detail for development. Off by default in production.

## Enforcement

`functions/src/__tests__/helpers/no-console.test.ts` greps for `console.*` calls under `functions/src/` (excluding `__tests__/`). Any match fails the test. If you add a `console.log` for one-shot debugging and `pnpm test:functions` fails with "console call found", that's the test telling you to swap it for `logger.*` before committing.

The test does NOT scrub log calls for the `handler` field — the convention is enforced by reviewer + this skill, not by the test runner.

## Common mistakes

- **String concatenation in the message.** `logger.info('user ' + uid + ' joined')` defeats the point — `uid` should be a field, not part of the message. Write `logger.info('User joined village', { handler, uid, villageId })`.
- **`JSON.stringify` in the message.** Same issue — dump the object as a field, not as a string.
- **Missing `handler`.** The log lands in Cloud Logging but you can't filter by function. Always include it.
- **Logging an error object directly as the message.** `logger.error(err)` works but loses context. Prefer `logger.error('createEvent failed', { handler, err: err.message, stack: err.stack, eventId })`.
- **Logging PII at `info` or above.** Phone numbers, emails, full names: log the IDs, not the values. If you need the value for debugging, use `logger.debug` and ensure the function isn't in production at the time.

## When this skill applies

- Adding a new Cloud Function under `functions/src/`.
- Modifying log statements in an existing Cloud Function.
- A `pnpm test:functions` failure mentioning `no-console.test.ts`.
- Reviewing logs in Cloud Logging and finding that filters don't pick up what you expected.

## Don't

- Don't disable the no-console test to ship a debug log. If you genuinely need temporary observability, use `logger.debug` and remove it before merging.
- Don't add a separate logging wrapper "for convenience." The v2 logger is the convention; wrappers diverge and obscure the field structure.
````

- [ ] **Step 2.3: Commit**

```bash
git add .claude/skills/cloud-function-logging/SKILL.md
git commit -m "docs(skills): add cloud-function-logging skill"
```

---

## Task 3: New skill — `add-firestore-collection`

**Files:**
- Create: `.claude/skills/add-firestore-collection/SKILL.md`

- [ ] **Step 3.1: Verify the referenced paths exist**

Run: `ls packages/shared/src/models packages/shared/src/services/_services-map.md firestore.rules firestore.indexes.json`
Expected: all four resolve.

- [ ] **Step 3.2: Write the skill**

Create `.claude/skills/add-firestore-collection/SKILL.md`:

````markdown
---
name: add-firestore-collection
description: Use whenever adding a new Firestore (sub-)collection — usually under `villages/{villageId}/`. Encodes the multi-file checklist (model + service + index re-export + services map + rules + collection-group index + vitest + rules test) so the change lands complete in one commit instead of trickling in over five.
---

# Add a new Firestore collection

Adding a collection is a multi-file change that's easy to do incompletely. Every step below ships in the **same commit**.

## Decide the path

Cultuvilla nests village-scoped data under `villages/{villageId}/...`. Two questions:

1. **Is this village-scoped?** Yes → `villages/{villageId}/<collection>/{docId}`. No → top-level (`users/`, `municipalities/`, `occupations/`). The default is village-scoped; only deviate when the entity is genuinely cross-village reference data.
2. **Will it ever be queried cross-village?** Yes → collection group index in step 6. No → still safe to add the index, but not required.

## Checklist

### 1. Model

Create `packages/shared/src/models/<entity>.ts`. Export the type, the `Collections.<EntityKey>` path constant if the file maintains one, and any input shapes used at create/update time (`CreateXInput`, `UpdateXInput`). Keep fields strict — no `any`.

If the entity has subdocs (e.g. nested `images`), model the sub-shape as its own interface in the same file unless reused elsewhere.

### 2. Service

Create `packages/shared/src/services/<entity>Service.ts`. Banner-section style matching `eventService.ts` or `personService.ts`. Strict types on every export. No `any` at boundaries. No silent fallbacks.

Standard entry points to define (only those that are actually needed — YAGNI):

- `get<Entity>(villageId, id): Promise<Entity | null>`
- `get<Entity>sByVillage(villageId): Promise<Entity[]>`
- `create<Entity>(villageId, input: Create<Entity>Input): Promise<Entity>`
- `update<Entity>(villageId, id, patch: Update<Entity>Input): Promise<void>`
- `delete<Entity>(villageId, id): Promise<void>`

Cross-user writes or trust-sensitive updates DO NOT go in the client service — they go in a Cloud Function callable. See the `guardrail-enforcement` skill.

### 3. Index re-export

Add the service to `packages/shared/src/services/index.ts`. Match the style of existing entries (`export * from './<entity>Service';`).

### 4. Services map

Add a row to [`packages/shared/src/services/_services-map.md`](../../../packages/shared/src/services/_services-map.md):

```markdown
| [<entity>Service](<entity>Service.ts) | `villages/{vid}/<collection>/` | <one-sentence summary> | `get<Entity>`, `get<Entity>sByVillage`, `create<Entity>`, `update<Entity>`, `delete<Entity>` |
```

The map is the agent index. Skipping this row means future sessions won't find your service.

### 5. Rules

Open [`firestore.rules`](../../../firestore.rules). Find the existing `match /villages/{villageId} { ... }` block and add a nested match for the new sub-collection:

```
match /<collection>/{docId} {
  allow read: if isVillageMember(villageId);
  allow create: if isVillageMember(villageId);
  allow update: if isOwner(resource.data.createdBy) || isVillageAdmin(villageId);
  allow delete: if isOwner(resource.data.createdBy) || isVillageAdmin(villageId);
}
```

Adjust the predicates for the actual access model. Use the existing helper functions (`isVillageMember`, `isVillageAdmin`, `isOwner`, `isAppAdmin`) — don't redefine identity checks inline.

If the write is cross-user or trust-sensitive (only the village admin can grant a role, only the organizer can finalize an event, etc.), tighten the rule to `allow write: if false` for the affected fields and route the write through a Cloud Function — see `guardrail-enforcement`.

### 6. Collection-group index

Open [`firestore.indexes.json`](../../../firestore.indexes.json). Add an entry under `indexes` for any collection-group query you've added (or plan to add) on this collection:

```json
{
  "collectionGroup": "<collection>",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "<filterField>", "order": "ASCENDING" },
    { "fieldPath": "<sortField>", "order": "ASCENDING" }
  ]
}
```

Even if no collection-group query exists today, AGENTS.md §3 says: when you add a sub-collection, add the index in the same change. The cost of an unused index is negligible; the cost of a runtime "this query requires an index" error in front of a user is high.

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
- [ ] Index entry in `firestore.indexes.json` even if not queried cross-village today.
- [ ] Service vitest + rules e2e test.
- [ ] PR description notes the deploy needed.

## Don't

- **Don't ship the service without updating `_services-map.md`.** Stale map = blind future sessions.
- **Don't put a cross-user write in the service.** Wrong layer. Use a callable. See `guardrail-enforcement`.
- **Don't add a top-level collection when village-scoped works.** Top-level paths bloat the rules file and the security surface.
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
````

- [ ] **Step 3.3: Commit**

```bash
git add .claude/skills/add-firestore-collection/SKILL.md
git commit -m "docs(skills): add add-firestore-collection skill"
```

---

## Task 4: New skill — `denormalized-read-model`

**Files:**
- Create: `.claude/skills/denormalized-read-model/SKILL.md`

- [ ] **Step 4.1: Verify referenced paths exist**

Run: `ls docs/architecture/denormalized-read-models.md functions/src/syncVillageDenormalization.ts functions/src/onOccupationProposalApproved.ts`
Expected: all three resolve.

- [ ] **Step 4.2: Write the skill**

Create `.claude/skills/denormalized-read-model/SKILL.md`:

````markdown
---
name: denormalized-read-model
description: Use whenever adding a new denormalized field on a Firestore read model, or extending an existing one — codifies the source-of-truth/trigger/read-model/backfill pattern documented in docs/architecture/denormalized-read-models.md and exemplified by functions/src/syncVillageDenormalization.ts.
---

# Add or extend a denormalized read model

Cultuvilla uses denormalized read models to keep high-fan-out reads flat — instead of issuing N+1 queries to fetch `villageName` for every event in a feed, we copy that field onto the event document at write time and propagate updates via a Cloud Function trigger. See [docs/architecture/denormalized-read-models.md](../../../docs/architecture/denormalized-read-models.md) for the full rationale.

This skill walks you through adding a new denormalized field or read model. Six steps, all in one commit (plus an out-of-band backfill).

## Decide whether to denormalize

Use a denormalized read model when **all** of these are true:

1. The read happens on a hot path — list, feed, search result.
2. The data crosses a collection boundary or would require N+1 follow-up reads.
3. The denormalized fields change much **less often** than they are read.
4. You accept brief staleness between source write and propagation (typically <2s).

If any of those fails, fetch live. Denormalization adds a write-amplification cost and a trigger to keep alive.

## Step 1 — Identify the source-of-truth doc and the read targets

Write it down. "When `villages/{vid}.images[0]` changes, every `villages/{vid}/events/{eid}.villageCoverImage` should update."

Source-of-truth doc: the canonical owner. Only one place can mutate it.

Read-target docs: where the denormalized copy lives. Often N docs for one source — the trigger fans out.

## Step 2 — Add the denormalized fields to the read-target model

In `packages/shared/src/models/<read-target>.ts`, add the new fields with a comment marking them as denormalized:

```ts
interface Event {
  // … source fields …

  // ─── Denormalized from villages/{vid} — kept in sync by
  //     functions/src/syncVillageDenormalization.ts.
  villageName: string;
  villageCoverImage: string | null;
  villageCoordinates: GeoPoint | null;
}
```

The comment is the only acceptable "explain what the code does" comment in this repo, because the *why* is non-obvious: a field that looks redundant is intentional. Identify the trigger file by name.

## Step 3 — Write the trigger

In `functions/src/sync<Source>Denormalization.ts` (one file per source-of-truth collection), add or extend the `onDocumentUpdated` handler.

Pattern (mirrors `syncVillageDenormalization.ts`):

```ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from './firebaseAdmin';

export const sync<Source>Denormalization = onDocumentUpdated(
  '<source>/{docId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const denormalizedFieldsChanged =
      before.<fieldA> !== after.<fieldA> ||
      before.<fieldB> !== after.<fieldB>;
    if (!denormalizedFieldsChanged) return;

    const targets = await db
      .collection('<read-target-path-pattern>')
      .where('<sourceIdField>', '==', event.params.docId)
      .get();

    if (targets.empty) return;

    const batch = db.batch();
    for (const doc of targets.docs) {
      batch.update(doc.ref, {
        <fieldA>: after.<fieldA>,
        <fieldB>: after.<fieldB>,
      });
    }
    await batch.commit();

    logger.info('Denormalized fields propagated', {
      handler: 'sync<Source>Denormalization',
      sourceId: event.params.docId,
      targetCount: targets.size,
    });
  }
);
```

Notes:
- **Always early-return** when the denormalized fields are unchanged. Otherwise every unrelated update on the source triggers a fan-out write.
- **Use `batch.commit()`** when fanning out to multiple docs. Firestore caps batches at 500 writes; if you can exceed that, chunk explicitly. See `syncVillageDenormalization.ts` for the chunking pattern.
- **`handler` field in every log call.** See the `cloud-function-logging` skill.

Export the trigger from `functions/src/index.ts`.

## Step 4 — Tighten rules

Open [`firestore.rules`](../../../firestore.rules) and ensure clients cannot write the denormalized fields directly. The standard pattern:

```
allow update: if isVillageMember(villageId) &&
  !request.resource.data.diff(resource.data).affectedKeys()
    .hasAny(['villageName', 'villageCoverImage', 'villageCoordinates']);
```

This makes the trigger the only writer of the denormalized fields. If a client tries to set `villageName` on an event, the rule rejects the entire update.

## Step 5 — Backfill existing docs

Existing docs in Firestore were created before the field existed; they need a one-time backfill. Create `scripts/backfill-<source>-denorm.mjs`:

```js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'villa-events';
initializeApp({ projectId });
const db = getFirestore();

const sources = await db.collection('<source>').get();
for (const source of sources.docs) {
  const data = source.data();
  const targets = await db
    .collection('<read-target>')
    .where('<sourceIdField>', '==', source.id)
    .get();

  if (targets.empty) continue;

  let batch = db.batch();
  let count = 0;
  for (const target of targets.docs) {
    batch.update(target.ref, {
      <fieldA>: data.<fieldA>,
      <fieldB>: data.<fieldB>,
    });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 400 !== 0) await batch.commit();
  console.log(`${source.id}: backfilled ${targets.size} targets`);
}
```

Run against dev first: `GOOGLE_CLOUD_PROJECT=villa-events node scripts/backfill-<source>-denorm.mjs`. Verify in the Firestore console that a sample doc now has the new fields. Repeat for beta/prod with explicit confirmation from the user.

## Step 6 — Integration test

Create `packages/shared/test/integration/<source>Denorm.test.ts`. The test:

1. Boots the Firestore + Functions emulators (the harness in `scripts/run-tests-with-emulators.mjs` handles this).
2. Creates a source doc and N target docs that should be kept in sync.
3. Mutates the source.
4. Polls the targets (up to a 2s budget) until the denormalized fields match the new source values.
5. Asserts every target was updated.

Run: `pnpm test:integration` — should pass.

## Step 7 — Document

Add a row to the **Denormalized fields** table in [`packages/shared/src/services/_services-map.md`](../../../packages/shared/src/services/_services-map.md):

```markdown
| `<fieldA>`, `<fieldB>` | `<read-target-collection>` | `<source-collection>` | [functions/src/sync<Source>Denormalization.ts](../../../../functions/src/sync<Source>Denormalization.ts) |
```

Add a paragraph to [`docs/architecture/denormalized-read-models.md`](../../../docs/architecture/denormalized-read-models.md) under "Existing read models" describing the new one and why it exists.

## Required outputs

- [ ] Model updated with denormalized fields + comment naming the trigger file.
- [ ] Trigger written, exported from `functions/src/index.ts`, with `handler` field on every log call.
- [ ] Early-return on unchanged source fields.
- [ ] Rules updated to forbid client writes to the denormalized fields.
- [ ] Backfill script created and run against dev (with sample-doc verification).
- [ ] Integration test that mutates source → asserts target updates.
- [ ] `_services-map.md` and `docs/architecture/denormalized-read-models.md` updated.

## Don't

- **Don't skip the early-return on unchanged fields.** Every unrelated source update will fan out a no-op batch — wasted writes and noise in logs.
- **Don't denormalize a field that changes more often than it's read.** Use a live read or a small cache instead.
- **Don't write the denormalized field from a client service.** The trigger is the only writer; the rule enforces this.
- **Don't ship without a backfill plan.** Existing docs become inconsistent the moment the trigger goes live.

## When this skill applies

- The user asks to "show <field-from-other-collection>" on a list or feed.
- A query plan ends up needing N+1 reads.
- A new collection joins fields owned elsewhere (in which case run this alongside `add-firestore-collection`).

## Companion skills

- `add-firestore-collection` — if the read target itself is new.
- `cloud-function-logging` — for the structured-log convention used in the trigger.
- `firestore-deploy` — to push the rules + functions to dev.
````

- [ ] **Step 4.3: Commit**

```bash
git add .claude/skills/denormalized-read-model/SKILL.md
git commit -m "docs(skills): add denormalized-read-model skill"
```

---

## Task 5: New skill — `i18n-add-string`

**Files:**
- Create: `.claude/skills/i18n-add-string/SKILL.md`

- [ ] **Step 5.1: Verify the i18n paths exist**

Run: `ls apps/web/i18n/messages/ apps/web/i18n/config.ts apps/web/i18n/request.ts`
Expected: all three resolve. Note the default locale file name (likely `es.json`).

- [ ] **Step 5.2: Write the skill**

Create `.claude/skills/i18n-add-string/SKILL.md`:

````markdown
---
name: i18n-add-string
description: Use whenever adding or changing a user-facing string in the Next.js web app. Encodes the next-intl conventions, the message-catalogue layout, the namespace-by-feature rule, and the "hardcoded Spanish allowed only in dev-only admin surfaces" carve-out from AGENTS.md.
---

# Add a user-facing string

Cultuvilla's web app uses `next-intl` v4. The default locale is `es`. All user-facing strings live in `apps/web/i18n/messages/<locale>.json` and are rendered via `useTranslations()`.

## When this applies

- Adding a new label, button text, error message, placeholder, or notification copy in a component the end-user sees.
- Replacing an English string left in source code with the localised version.

Carve-out: hardcoded Spanish is **allowed** in dev-only surfaces — admin panels, debug pages, internal tools where i18n is not a current priority. If in doubt, ask "would a non-admin user see this?" — yes → i18n; no → fine as-is.

## Procedure

### 1. Pick a namespace

Namespaces group strings by **feature area**, not by component. `events`, `personas`, `villageOnboarding`, `auth`, `feed`. A component re-using strings from multiple namespaces is normal — `useTranslations('events')` and `useTranslations('common')` in the same file is fine.

Open [`apps/web/i18n/messages/es.json`](../../../apps/web/i18n/messages/es.json) (the default locale). Look for an existing namespace that fits. If none does, add a new top-level key.

### 2. Add the key

Choose a stable, descriptive key. Avoid copy-as-key (`"Save"` as the key) because copy changes more often than meaning.

```json
{
  "events": {
    "createButton": "Crear evento",
    "fullNotice": "Este evento está completo. Puedes apuntarte a la lista de espera.",
    "registrationConfirmed": "Te has apuntado correctamente."
  }
}
```

If the string is parameterised, use next-intl ICU syntax:

```json
{
  "events": {
    "attendeeCount": "{count, plural, =0 {Sin asistentes} one {1 asistente} other {# asistentes}}"
  }
}
```

### 3. Render the string

In the component:

```tsx
import { useTranslations } from 'next-intl';

export function CreateEventButton() {
  const t = useTranslations('events');
  return <button>{t('createButton')}</button>;
}
```

For parameterised strings:

```tsx
const t = useTranslations('events');
<p>{t('attendeeCount', { count: registrations.length })}</p>
```

For server components, use `getTranslations` from `next-intl/server`:

```tsx
import { getTranslations } from 'next-intl/server';

export default async function EventPage() {
  const t = await getTranslations('events');
  return <h1>{t('title')}</h1>;
}
```

### 4. Decide on other locales

Cultuvilla's MVP ships in Spanish only. If a non-`es` locale file exists in `apps/web/i18n/messages/` and is wired up, add the key to that file too with `TODO: translate` as the value — it's better than a missing-key runtime error. Otherwise leave the other-locale work for a future translation pass.

## What NOT to do

- **Don't hardcode Spanish in a user-facing component.** It bypasses the catalogue and makes future translation a grep-and-replace nightmare.
- **Don't use the English copy as the key.** When the Spanish text changes, the key changes too, and every translation breaks.
- **Don't `as any` your way around a missing-namespace type error.** Add the key to the catalogue.
- **Don't add the same string under two namespaces.** Pick one and reuse.
- **Don't use string concatenation in a translated message.** `${t('hello')} ${name}` works but breaks word order in languages with different grammar — use ICU placeholders instead.

## When the string is dev-only

Admin pages, debug panels, internal-only routes — hardcoded Spanish (or English, whatever's easiest to read while building) is fine. If the page is gated behind `isAppAdmin`, that's the signal: not user-facing.

If the dev-only flag may change (e.g. an admin tool that later becomes user-facing), still namespace it and use `useTranslations()` — it's cheaper than retrofitting later.

## When this skill applies

- The user asks to "add a button labelled X" / "show an error when Y" / "rename Z in the UI".
- A grep finds Spanish strings outside `apps/web/i18n/messages/` in user-facing source.
- A new component is shipping with a hardcoded string.

## Companion skills

- None — this is self-contained.
````

- [ ] **Step 5.3: Commit**

```bash
git add .claude/skills/i18n-add-string/SKILL.md
git commit -m "docs(skills): add i18n-add-string skill"
```

---

## Task 6: Adapted skill — `firestore-deploy`

**Files:**
- Create: `.claude/skills/firestore-deploy/SKILL.md`

- [ ] **Step 6.1: Verify the cultuvilla deploy scripts**

Run: `grep -E '"deploy:' package.json`
Expected: lines for `deploy:rules:dev|beta|prod`, `deploy:indexes:dev|beta|prod`, `deploy:firestore:dev|beta|prod`, `deploy:functions:dev|beta|prod`, `deploy:all:dev|beta|prod`.

- [ ] **Step 6.2: Write the skill**

Create `.claude/skills/firestore-deploy/SKILL.md`:

````markdown
---
name: firestore-deploy
description: Safely deploy Firestore rules, indexes, or Cloud Functions to the cultuvilla development Firebase project. Use when the user asks to deploy any of these. Refuses beta/prod deploys (CI handles those, or the user must insist explicitly) and refuses the `deploy:all:*` umbrella scripts by default.
---

# Firestore deploy (development only by default)

Cultuvilla has three Firebase projects:

| Profile | Project ID | Script alias |
|---|---|---|
| dev | `villa-events` | `pnpm deploy:*:dev` |
| beta | `cultuvilla-beta` | `pnpm deploy:*:beta` |
| prod | `cultuvilla-prod` | `pnpm deploy:*:prod` |

This skill targets `:dev` only. Beta and prod deploys either come from CI on merge, or require explicit user insistence (see below).

## Hard refusals

Refuse and explain unless the user explicitly insists in this conversation:

- Any deploy to beta or prod: `pnpm deploy:rules:beta`, `pnpm deploy:firestore:prod`, `pnpm deploy:functions:beta`, etc.
- Any `deploy:all:*` script (`deploy:all:dev`, `deploy:all:beta`, `deploy:all:prod`) — they deploy rules + indexes + functions + storage simultaneously; one bad commit lands everywhere at once. Prefer the narrowest script.
- Raw `firebase deploy --project <id>` bypassing the alias system.

If the user insists, repeat back what will be deployed and to which env, then require an explicit yes before running.

## Procedure

1. **Confirm active alias** — run `firebase use` (no args).

   ```bash
   firebase use
   ```

   If it prints `beta` or `prod`, stop and ask the user to confirm dev; only proceed once `firebase use dev` is active.

2. **Show the diff** of the file(s) being deployed so unrelated changes don't ship silently:

   | Intent | Diff command |
   |---|---|
   | Rules | `git diff -- firestore.rules` |
   | Indexes | `git diff -- firestore.indexes.json` |
   | Storage rules | `git diff -- storage.rules` |
   | Functions | `git status functions/ && git diff -- functions/` |

   If unrelated changes are staged in those files, surface them — don't deploy silently.

3. **Run the narrowest pnpm script:**

   | Intent | Command |
   |---|---|
   | Firestore rules only | `pnpm deploy:rules:dev` |
   | Firestore indexes only | `pnpm deploy:indexes:dev` |
   | Both rules + indexes | `pnpm deploy:firestore:dev` |
   | Cloud Functions | `pnpm deploy:functions:dev` |

   Prefer rules-only or indexes-only over the combined `deploy:firestore:dev` when only one file changed.

4. **Post-deploy notes** to surface to the user:

   - **Indexes build asynchronously.** Readiness shows in the Firebase Console under Firestore → Indexes. Queries depending on a building index fail until ready.
   - **Rules propagate within ~60s.**
   - **Functions cold-start on the first invocation after deploy** — expect a slower-than-usual first call.

## Out of scope

- Rolling back a deploy. Direct the user to Firebase Console history; don't attempt automated rollback.
- Storage rules-only deploys via a dedicated script — `pnpm deploy:rules:*` covers rules and storage together in cultuvilla. If storage-only is needed, fall back to `firebase deploy --only storage --project dev` after the diff check, and flag it to the user.
- App/web deploys — Vercel handles `apps/web/`, not Firebase CLI.

## Companion skills

- `add-firestore-collection` — when the deploy is part of landing a new collection (rules + indexes change in the same commit).
- `denormalized-read-model` — when a denorm trigger is part of the deploy.
- `guardrail-enforcement` — when a callable is part of the functions deploy.
````

- [ ] **Step 6.3: Commit**

```bash
git add .claude/skills/firestore-deploy/SKILL.md
git commit -m "docs(skills): add firestore-deploy skill"
```

---

## Task 7: Adapted skill — `touch-service`

**Files:**
- Create: `.claude/skills/touch-service/SKILL.md`

- [ ] **Step 7.1: Confirm the services dir + map**

Run: `ls packages/shared/src/services/_services-map.md packages/shared/src/models packages/shared/test/services`
Expected: all three resolve.

- [ ] **Step 7.2: Write the skill**

Create `.claude/skills/touch-service/SKILL.md`:

````markdown
---
name: touch-service
description: Procedure for adding, changing, or removing exports in `packages/shared/src/services/`. Use whenever a task involves modifying a service, adding a new query/mutation, or moving logic between services and Cloud Functions. Encodes the agent-first conventions that aren't visible from grep alone.
---

# Touch a service

The service layer is the single owner of Firestore access in client code. Treat it as the data contract for the rest of the app. See [AGENTS.md §1 Service-layer ownership](../../../AGENTS.md) for the rule.

## Pre-change

1. **Grep all call sites** of the function before changing it. Service exports usually have many callers across pages, hooks, and other services. The file you're editing is one of N.

   ```bash
   git grep -n 'serviceFunctionName(' apps/ packages/
   ```

2. **Read the services map** at [`packages/shared/src/services/_services-map.md`](../../../packages/shared/src/services/_services-map.md). Cross-file interactions, placement decisions, and denormalization edges live there — not in grep. If the domain you're touching is empty in the map or stale, fix it as part of your change.

3. **Models first.** Input/return shapes come from `packages/shared/src/models/`. If a model needs a field, change it there — don't widen the service signature with an inline shape.

## Where the code goes

4. **Stay in domain.** Events → `eventService.ts`; persons → `personService.ts`; village membership → `villageMemberService.ts`; etc. Cross-domain code = call across services, not merge them.

5. **Backend boundaries.** Writes that exceed Firestore rules belong in Cloud Functions, not the client service:
   - Cross-user writes (modifying another user's doc).
   - Denormalized aggregates (counters, fan-outs).
   - Trust-sensitive state (role grants, organizer-only flips, approval lifecycle).
   - Atomic multi-doc updates spanning security boundaries.

   See the `guardrail-enforcement` skill for the callable pattern.

6. **Don't create a new service file** unless the domain is genuinely new. Add to an existing one with a new banner section if needed. See [`add-firestore-collection`](../add-firestore-collection/SKILL.md) when the change introduces a whole new collection.

## Conventions inside the service

7. **Banner sections** match the existing style. Look at `eventService.ts` for the pattern: `// =====...` rule, then `// SECTION NAME`. Group exports by domain inside the file.

8. **Strict types on every export.** Explicit input + return. No `any` at boundaries. Use `unknown` if you truly don't know, then narrow.

9. **No silent fallbacks.** Return `null` / `[]` intentionally, or throw. Don't paper over Firestore failures with empty defaults — the bug becomes invisible.

10. **Listeners (`subscribeXxx`)** return their unsubscribe function. The caller owns lifecycle. Don't accumulate listeners in module-level state.

11. **Caching.** If the data is covered by a cache (e.g. an event-feed cache), invalidate on writes. Don't leave stale entries behind.

12. **Firebase imports live in services only.** The modular SDK (`firebase/firestore`, `firebase/storage`, `firebase/functions`, `firebase/auth`) must not appear in pages/hooks/components/utils outside `apps/web/contexts/AuthContext.tsx`. Enforced by `no-restricted-imports` in `apps/web/eslint.config.mjs`. If you need data outside services, expose it via a service function.

13. **Guardrails inside the function.** Validate state and refuse invalid calls. UI hiding a button is an optimisation, not a boundary — the service is the consistency boundary, and the trust boundary is the server. See `guardrail-enforcement`.

## Comments — agent-first

Default: **no JSDoc**. Names and types should carry intent. Add a one-line comment only when something is non-obvious to an agent reading the function:

- **Side effects** beyond the return value (writes other docs, calls a callable, invalidates cache).
- **Preconditions** not enforced by types (`throws if event is past`, `requires authenticated caller`).
- **Choose-between hints** when similar exports exist (`use this for X; use getXByVillage for Y`).
- **Deprecation** (`use X instead`).

Never write `Purpose / What it does / Used in / Returns` ceremony — it goes stale, burns tokens, and grep is more reliable.

## Required outputs of the change

14. **Vitest** in `packages/shared/test/services/<service>.test.ts`. New exports → new tests; changed behaviour → updated tests. Match the existing test style.

15. **Firestore indexes** — a new query likely needs `firestore.indexes.json` updated. Flag the deploy (use the `firestore-deploy` skill).

16. **Services map** — if a new cross-service interaction appears, update [`_services-map.md`](../../../packages/shared/src/services/_services-map.md). Don't update for trivial additions; do update when changing entry-points or denormalization edges.

## Avoid

- Renaming exports without grepping every caller — TypeScript catches some, dynamic Firestore key usage hides the rest.
- Reaching into Firestore from a page/component/hook to "skip the service" — AGENTS.md violation; the lint rule will flag it.
- Smuggling business logic into `utils/` to avoid touching a service. Utils are pure helpers.
- Adding retrocompat shims when changing data shape. Call out the migration in the PR (see AGENTS.md "No retrocompat shims unless asked").

## When this skill applies

- A task says "add a query for X", "change <serviceFn>'s return shape", "move logic from <service> to <other>".
- A code review flags a service-layer issue.
- A new feature plan touches `packages/shared/src/services/`.

## Companion skills

- `add-firestore-collection` — when the change introduces a new collection that the service owns.
- `guardrail-enforcement` — when the write should be in a Cloud Function callable.
- `firestore-deploy` — when the change touches `firestore.indexes.json`.
````

- [ ] **Step 7.3: Commit**

```bash
git add .claude/skills/touch-service/SKILL.md
git commit -m "docs(skills): add touch-service skill"
```

---

## Task 8: Adapted skill — `guardrail-enforcement`

**Files:**
- Create: `.claude/skills/guardrail-enforcement/SKILL.md`

- [ ] **Step 8.1: Confirm onOccupationProposalApproved exists (used as canonical example)**

Run: `ls functions/src/onOccupationProposalApproved.ts functions/src/acceptInvite.ts`
Expected: both files exist.

- [ ] **Step 8.2: Write the skill**

Create `.claude/skills/guardrail-enforcement/SKILL.md`:

````markdown
---
name: guardrail-enforcement
description: Procedure for choosing where a business-rule guardrail (identity/membership, state transition, eligibility, capacity, role check) lives in cultuvilla. Use when adding or modifying any check that gates a write — in `packages/shared/src/services/`, `firestore.rules`, or `functions/src/`. Picks the right layer for the threat model and codifies the admin-callable pattern for predicates Firestore rules can't express.
---

# Guardrail enforcement layers

Every business-rule guardrail must be enforced beyond the UI. The UI may (and usually should) replicate the check for UX, but it must never be the only line of defense. The right home depends on the threat — who can bypass each layer.

## Three layers

1. **UI (UX layer)** — disabled buttons, hidden controls, friendly errors. Cosmetic; trivially bypassed.
2. **Shared service (`packages/shared/src/services/*.ts`) — consistency layer.** Catches drift between clients (web vs. future mobile, old vs. new builds), surfaces consistent errors, and protects future UI refactors from accidentally dropping a gate. **This code runs in the browser** — it does NOT defend against a hostile actor calling Firestore or callables directly. Treat it as a consistency boundary, not a trust boundary.
3. **Server (Firestore rules + admin-backed Cloud Functions) — trust boundary.** The only layer a hostile client cannot bypass.

## Decision tree — which layer for which guardrail

| Guardrail type | Home |
|---|---|
| Trust-sensitive state (role grants, organization approval, occupation proposal approval) | **Cloud Function callable (admin SDK)** |
| Cross-user writes (writing to another user's doc or persona) | **Cloud Function callable** |
| Identity/membership requiring cross-doc reads (e.g. "uid is admin of village X and X owns event Y") | **Cloud Function callable** |
| Atomic multi-doc updates spanning security boundaries | **Cloud Function callable** |
| Doc ownership ("only the creator can update") | **Firestore rule** |
| Field-shape invariants on a single doc (required fields, allowed status transitions, denormalized fields locked) | **Firestore rule** |
| Status guards / eligibility for an action already protected by one of the above (capacity, deadline, role) | **Shared service** (consistency + UX errors) |
| Pure UX gates (hide a button, friendly text) | **UI only** |

If a check could fit two layers, prefer the higher one — rules over service, callable over rules — for any rule whose violation would let a malicious caller affect another user's data, scoring, role, or trust state.

## Admin-callable recipe (strengthening the trust layer)

When the predicate doesn't fit in a Firestore rule (cross-doc read, multi-step transaction, cross-user write), the pattern is:

**1. Lock down direct client writes** in `firestore.rules`. Either deny entirely:

```
allow update: if false;
```

…or restrict the diff to known-safe fields:

```
allow update: if isAuthenticated() &&
  request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['safeField']);
```

**2. Add the callable** in `functions/src/<name>.ts`:

```ts
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db } from './firebaseAdmin';

export const doSensitiveThing = onCall(async (request) => {
  // Auth — never trust a uid from `request.data`; derive from the platform.
  const authenticatedUid = request.auth?.uid;
  if (!authenticatedUid) {
    throw new HttpsError('unauthenticated', 'User not authenticated');
  }

  const { villageId, eventId } = request.data ?? {};
  if (!villageId || !eventId) {
    throw new HttpsError('invalid-argument', 'villageId and eventId are required');
  }

  await db.runTransaction(async (tx) => {
    const eventRef = db.doc(`villages/${villageId}/events/${eventId}`);
    const snap = await tx.get(eventRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Event not found');
    }
    const event = snap.data()!;

    // Derive identity from the doc — DON'T trust client claims of who they are.
    if (event.createdBy !== authenticatedUid) {
      throw new HttpsError('permission-denied', 'You are not the organizer of this event');
    }

    // State-machine + eligibility predicates.
    if (event.status !== 'open') {
      throw new HttpsError('failed-precondition', 'Event is not open');
    }

    // Admin write bypasses rules.
    tx.update(eventRef, { /* … */ });
  });

  logger.info('Sensitive thing applied', {
    handler: 'doSensitiveThing',
    villageId,
    eventId,
    actorUid: authenticatedUid,
  });
});
```

Notes:
- **Always derive identity from `request.auth.uid`.** Never trust a uid passed in `request.data`.
- **Use `runTransaction`** when the predicate depends on a read of the same doc you're writing.
- **Log with `handler` set to the callable name** (see the `cloud-function-logging` skill).
- **Don't catch and swallow** the `HttpsError` — let it propagate to the client so the service layer can render a friendly error.

**3. Update the shared service** to call the function instead of writing Firestore directly:

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function doSensitiveThing(villageId: string, eventId: string): Promise<void> {
  const fn = httpsCallable(getFunctions(), 'doSensitiveThing');
  await fn({ villageId, eventId });
}
```

Keep the same export signature so callers don't change.

**4. Mirror the predicate in the shared service** as a layer-2 consistency check — fail fast with a friendly error before hitting the network. The callable remains the source of truth.

```ts
if (event.status !== 'open') {
  throw new Error('Event is not open');
}
```

## Existing patterns in cultuvilla

- **[`functions/src/acceptInvite.ts`](../../../functions/src/acceptInvite.ts)** — derives uid from `request.auth`, validates token, atomically writes village-member doc.
- **[`functions/src/onOccupationProposalApproved.ts`](../../../functions/src/onOccupationProposalApproved.ts)** — trigger that fan-outs an approved occupation onto persons; admin-only collection.
- **[`functions/src/syncVillageDenormalization.ts`](../../../functions/src/syncVillageDenormalization.ts)** — trigger; not a callable but enforces that denormalized fields are written only by the trigger (rules forbid client writes).

When tightening a write, locate the rules block for the collection and either lock it or narrow the safe diff. Then point the shared service at the callable.

## Don't

- **Don't trust client-supplied identity params.** If a callable receives a `targetUserId` / `responderId` / `organizerUserId`, derive them from `request.auth.uid` and the doc — comparing the param to itself is not enforcement.
- **Don't call shared-service-only enforcement "server-side".** `packages/shared/src/services/*.ts` runs in the user's browser. Treating it as the trust boundary gives a false sense of security.
- **Don't add a Cloud Function for convenience** when Firestore rules already enforce the predicate. Cold starts, cost, harder tests — only reach for a callable when rules cannot express the rule.
- **Don't drop the UI gate** when adding a server check. UX still matters; the UI keeps the friendly path.

## When this skill applies

- Adding/modifying a function that mutates Firestore in any service file.
- Editing `firestore.rules` to allow/deny a new write pattern.
- Adding/modifying a callable or trigger under `functions/src/`.
- Auditing an existing flow for trust gaps where the UI gate may be the only defense.

## Companion skills

- `guardrail-audit` — to sweep a feature area or PR for missing guardrails.
- `touch-service` — to update the shared-service layer-2 mirror.
- `firestore-deploy` — to push the rules and functions.
- `cloud-function-logging` — for the structured-log convention inside the callable.
````

- [ ] **Step 8.3: Commit**

```bash
git add .claude/skills/guardrail-enforcement/SKILL.md
git commit -m "docs(skills): add guardrail-enforcement skill"
```

---

## Task 9: Adapted skill — `guardrail-audit`

**Files:**
- Create: `.claude/skills/guardrail-audit/SKILL.md`

- [ ] **Step 9.1: Write the skill**

Create `.claude/skills/guardrail-audit/SKILL.md`:

````markdown
---
name: guardrail-audit
description: Procedure for auditing existing code (a service, feature area, or PR) in cultuvilla for missing business-rule guardrails. Use when a user asks to "audit X for guardrail coverage", "scan Y for missing checks", "check that Z has server-side validation", or when reviewing a PR that adds writes to a sensitive collection. Produces a findings table classifying each gate as GAP / RULE-BACKED / DEAD; gaps are fixed via the `guardrail-enforcement` skill.
---

# Guardrail audit

A guardrail is any check that gates a write — identity/membership, state transition, eligibility, capacity, role. The audit's job is to find places where a guardrail exists in the UI but is **not** re-validated where it must be: in the shared service (consistency), in Firestore rules, or in a Cloud Function callable (the trust boundary).

The companion skill `guardrail-enforcement` answers "where should a guardrail live?" — invoke it when fixing each finding. This skill answers "what's missing here?".

## When to invoke

- A user asks: "audit eventService", "scan event-creation for missing checks", "make sure org approval is enforced server-side."
- Reviewing a PR that adds writes to a sensitive collection (`villages/`, `events/`, `persons/`, `orgMembers/`, `organizations/`, `inviteTokens/`).
- Sweeping a feature area before shipping.

## Procedure

Three passes. Pass 1 collects candidates; Pass 2 verifies enforcement; Pass 3 triages and writes the findings table. Each pass is delegatable to a focused agent.

### Pass 1 — collect UI candidates

Grep across `apps/web/**` for patterns that typically indicate a UI-only gate:

- `disabled=` / `disabled:` on action buttons whose predicate is non-trivial.
- Variable/function names: `canEdit`, `canStart`, `canFinish`, `canApprove`, `canDelete`, `canInvite`, `canRegister`, `isOwner`, `isCreator`, `isAdmin`, `isOrganizer`, `isMember`.
- Status guards in handlers: `if (event.status !== 'open') return`, `if (registration.status === 'cancelled')`.
- Capacity / deadline guards: `event.capacity`, `event.deadline`, "already full" / "registration closed" comparisons before mutations.
- Early-returns of the form `toast(...); return;` / `setError(...); return;` immediately preceding a service call.

Each UI-only gate is a **candidate** — a rule the UI clearly cares about but that may or may not be enforced beyond the UI.

### Pass 2 — verify server/service enforcement

For each candidate from Pass 1, locate the service function it calls (under `packages/shared/src/services/`) and verify the same predicate runs there. Then check Firestore rules at [`firestore.rules`](../../../firestore.rules) and Cloud Function callables / triggers under `functions/src/`.

Three things to confirm:

1. **Cross-user writes** — the function takes a `userId` / `targetUid` / `personaId` parameter and writes to a doc keyed by it. Is the parameter constrained against `request.auth.uid` somewhere — by the rule, by a callable check, or by a server-side derivation?
2. **Trust-sensitive state** — role grants, organization approval, organizer-only event finalization, occupation proposal approval. Is the write behind a Cloud Function callable that runs under admin SDK?
3. **State transitions** — status flows, eligibility predicates, capacity. Are the predicates re-checked in the service function before the write, not just in the UI?

Also audit:

- All callables and triggers under `functions/src/` — each is an independent ingress and must enforce or delegate.
- Model-level invariants in `packages/shared/src/models/` that may already encode some checks (good — but they must be invoked from the service).
- **Read-only / subscription / cache-first functions are excluded by default.** Skip them unless a specific concern motivates including them.

### Pass 3 — triage and write the findings table

Classify each candidate into one of three buckets:

| Bucket | Definition | Typical action |
|---|---|---|
| **GAP** | The rule does not constrain enough; the function takes a target ID and the rule trusts it without checking against `request.auth.uid` or membership. Genuine security hole. | Fix per `guardrail-enforcement` skill — usually a callable + rule tightening. |
| **RULE-BACKED** | The rule rejects illegitimate writes; the function may produce cryptic errors but the security boundary holds. | Optional layer-2 mirror in the service for friendly errors. |
| **DEAD/SILENT-FAIL** | The function writes to a backend-only collection or otherwise can't succeed from a client. | Code-health cleanup, not security. Note and move on. |
| **TO VERIFY** | Need a rule cross-check before classifying. | Resolve before closing the audit. |

Output the findings as a table:

```markdown
| Rule | UI gate | Server / service enforcement | Status |
|---|---|---|---|
| Event creation requires village membership | `CreateEventForm.tsx:42` | `eventService.createEvent` — re-checks; rule also asserts | ✅ RULE-BACKED |
| Persona delete by creator only | `PersonaCard.tsx:88` | `personService.deletePerson` — trusts caller, rule allows any auth user | ❌ GAP |
```

Each row includes: the rule in plain language, where the UI enforces it, where the server *should* enforce it, and the bucket.

For GAP findings, also note severity (HIGH/MED/LOW):
- **HIGH** — cross-user data corruption, role escalation, financial implications.
- **MED** — same-user denial of service, stale-state writes.
- **LOW** — UX-only gaps where the rule blocks the write anyway.

## Common GAP patterns (red flags)

These shapes recur — flag them on sight:

- **Service function takes a `userId` / `personaId` / `targetUid` parameter and writes a doc keyed by it, with no `request.auth.uid`-derived check.** The parameter is trusted; a malicious client lies. → GAP, fix by deriving the value from `request.auth.uid` server-side.
- **Firestore update rule has an OR-branch that accepts "anyone" for non-load-bearing field changes** (e.g. allows updates as long as `createdAt` doesn't change). The OR branch dominates and lets generic mutations through. → GAP, tighten or replace the loose branch.
- **Rule allows admin OR an `isSafeUpdate` shape-only diff helper that doesn't check identity** of who's being added/removed/modified. → GAP — the helper must check actor identity.
- **Cloud Function callable trusts a uid from `request.data` instead of `request.auth.uid`.** → GAP, derive auth from the platform.
- **Denormalized field is writable from the client** (no diff lock in rules). → GAP, lock the field; trigger is the only writer.

## Output checklist

Before closing the audit:

- [ ] Passes 1 and 2 covered every mutating export in scope (read-only / subscription / cache-first excluded by default).
- [ ] Findings table written, severity assigned to each GAP.
- [ ] Each GAP has a fix-layer recommendation per the `guardrail-enforcement` skill (callable / rule / service).
- [ ] Open questions — anything that needs threat-model input from the user — listed at the bottom.
- [ ] If the audit is a follow-up to a prior one, link the prior audit.

## Out of scope

- Performance optimisations of the new checks (most are O(1) lookups).
- Refactoring UI predicates into shared helpers (nice-to-have; not required for correctness).
- Content moderation, abuse policy, or rate limiting — different mitigation pattern; call out separately if surfaced during the audit.

## Companion skills

- `guardrail-enforcement` — to fix each finding.
- `touch-service` — when the fix lands in the service layer.
- `firestore-deploy` — when the fix updates rules.
````

- [ ] **Step 9.2: Commit**

```bash
git add .claude/skills/guardrail-audit/SKILL.md
git commit -m "docs(skills): add guardrail-audit skill"
```

---

## Task 10: Adapted skill — `fix-bug`

**Files:**
- Create: `.claude/skills/fix-bug/SKILL.md`

- [ ] **Step 10.1: Write the skill**

Create `.claude/skills/fix-bug/SKILL.md`:

````markdown
---
name: fix-bug
description: Procedure for fixing a reported bug in cultuvilla. Forces RED/GREEN — write the failing test first in the right harness (vitest for `packages/shared`, vitest emulator harness for `functions/`, `@firebase/rules-unit-testing` under `packages/shared/test/e2e/` for rules), then fix, then commit. Routes to `touch-service`, `guardrail-enforcement`, `firestore-deploy`, and `cloud-function-logging` for layer-specific work.
---

# Fix a bug

Red/green. The regression test is written **before** the fix and committed in the same commit — that's the proof.

## 1. Reproduce

Pin down: entry point (page / service / callable / trigger), inputs (IDs, account state), expected vs. actual, environment (dev / beta / prod — default dev). If you can't reproduce, don't code: ask the user, or check Cloud Logging (works-in-dev / fails-in-beta is almost always config or data drift, not code).

## 2. RED — write the failing test first

Pick the layer. The harness is already set up; use the existing one — don't introduce a new runner.

**Default to the smallest scope that can express the bug.** Vitest in `packages/shared/test/services/` runs in seconds; the emulator-backed harnesses take 30–90s to boot.

| Bug surface | Test home | Library | Command |
|---|---|---|---|
| Service / model / utils (pure logic) | `packages/shared/test/services/<name>.test.ts` or `models/<name>.test.ts` | vitest | `pnpm shared:test` (whole suite) — for a single file see existing scripts in `packages/shared/package.json` |
| Service ↔ Firestore (integration) | `packages/shared/test/integration/<name>.test.ts` | vitest + emulator harness | `pnpm test:integration` |
| Firestore rule | `packages/shared/test/e2e/<name>Rules.test.ts` | `@firebase/rules-unit-testing` | `pnpm test:rules` |
| Cloud Function (callable / trigger) | `functions/src/__tests__/<area>/<name>.test.ts` | vitest + emulator | `pnpm test:functions` |
| Web component / page / hook | _(deferred — no jest/RTL config yet)_ | — | document the manual repro in the commit body |

Naming: match the existing files in each directory. `describe` block names the bug (e.g. `'rejects organization update by non-admin (#issue)'`). Avoid generic `describe` blocks for regression tests — make them findable by symptom.

**Run the test, see it fail.** A test that passes before the fix is the wrong test.

## 3. Fix at the right layer

Match cause to layer; route to the companion skill — don't re-derive its rules:

| Cause | Companion skill |
|---|---|
| Service shape / missing filter / silent fallback | `touch-service` |
| Cross-user write or trust-sensitive state succeeds when it shouldn't | `guardrail-enforcement` (run `guardrail-audit` first if the gap looks feature-wide) |
| Firestore rule rejects valid write / accepts invalid one / missing index | `firestore-deploy` |
| `console.log` in a function fails CI / unstructured Cloud Logging | `cloud-function-logging` |

AGENTS.md non-negotiables that bug fixes commonly violate:

- **No silent fallbacks.** Don't catch-and-default the failure away — surface it.
- **Services are the only Firebase ingress in the client.** Don't reach Firestore from a page/hook/component to "skip the bug".
- **Models first.** If the shape is wrong, fix `packages/shared/src/models/` — don't widen a service signature inline.
- **No retrocompat shims** unless asked. If existing data is now invalid, call out the migration in the commit body.

## 4. GREEN — test passes, repro is gone

- New test passes (`pnpm shared:test` / `pnpm test:integration` / `pnpm test:rules` / `pnpm test:functions`).
- Re-walk the Step 1 repro in the actual app (the user runs `pnpm web:dev` — you do not — see AGENTS.md).
- For backend changes deployed to dev (rules / indexes / functions), confirm in Cloud Logging.

## 5. Web-only visual bugs (until web test config lands)

There's no jest/RTL config in `apps/web/` yet. If the bug is purely in a web component:

1. Extract any pure logic into `packages/shared/` and write a vitest there for the logic part.
2. Document the manual repro in the commit body — what to click, what's wrong, what should happen.
3. Open a follow-up flagged for "add web test config" in your suggestion (per AGENTS.md "Be proactive").

## 6. Commit

- One commit holds the regression test AND the fix. Reviewers (including future-Claude) should be able to see the test and confirm it would fail without the change.
- Use `fix(<scope>): <one-line summary>`. Body has the root-cause sentence and the repro path.
- Mention any `firestore.indexes.json` or rule change in the body so the deploy isn't missed (use `firestore-deploy`).

## Required outputs

- [ ] Failing test committed in the right harness per the table.
- [ ] Fix obeys AGENTS.md (no silent fallbacks, services-only ingress, models first).
- [ ] Original repro re-walked.
- [ ] Commit message: `fix(...)` prefix, root cause in the body.

## Don't

- **Don't ship a fix without a test** (web-only visual bugs excepted — document the manual repro).
- **Don't write the test after the fix** — you'll write one that already passes. Red first.
- **Don't fix the symptom layer** when the cause lives one layer up. The contract is the bug.
- **Don't add a try/catch to silence the error** — that's a silent fallback, AGENTS.md violation.
- **Don't bundle a refactor or "while I'm here" cleanup** into the fix commit. Land it separately.

## Companion skills

- `touch-service`, `guardrail-enforcement`, `firestore-deploy`, `cloud-function-logging`.
````

- [ ] **Step 10.2: Commit**

```bash
git add .claude/skills/fix-bug/SKILL.md
git commit -m "docs(skills): add fix-bug skill"
```

---

## Task 11: Adapted skill — `manage-plan-docs`

**Files:**
- Create: `.claude/skills/manage-plan-docs/SKILL.md`

- [ ] **Step 11.1: Confirm the docs structure**

Run: `ls docs/`
Expected: at minimum `superpowers/`, `architecture/`. (`plans/` and `archive/` may not exist yet — the skill instructs the engineer to create them on first promotion.)

- [ ] **Step 11.2: Write the skill**

Create `.claude/skills/manage-plan-docs/SKILL.md`:

````markdown
---
name: manage-plan-docs
description: Procedure for creating, updating, promoting, or archiving plan and spec docs under cultuvilla's `docs/`. Use whenever drafting a new plan or spec, changing a doc's status, finishing work a doc covers, or asking "where does this doc go?". Encodes the three-state lifecycle (superpowers drafts → canonical plans → archive) and the Status frontmatter so sessions stay aligned.
---

# Manage plan docs

The `docs/` tree has a deliberate lifecycle. Plans and specs move through three states — drafted in `superpowers/`, promoted to `plans/` when blessed, archived when shipped. Status is tracked inline so a single `grep` answers "what's active right now."

## Folder map

```
docs/
├── plans/             canonical: active + backlog + blocked + speculative + reference
├── superpowers/       drafts (this is where new content starts)
│   ├── plans/
│   └── specs/
├── architecture/      living reference (already exists — keep)
├── ENVIRONMENTS.md    living reference doc
├── testing.md         living reference doc
└── archive/           terminal (work shipped or killed)
    ├── plans/
    ├── specs/
    └── audits/
```

- **`superpowers/`** is the workspace. Brainstorming and writing-plans skills write here. Content here is not yet canonical — the user hasn't blessed it.
- **`plans/`** is canonical. Anything here is real work being tracked.
- **`archive/`** is terminal. Files arrive here only when the work they describe is shipped (or formally killed).
- **`architecture/`**, `ENVIRONMENTS.md`, `testing.md` are living reference — separate from the plan lifecycle.

Create `plans/` and `archive/` (with `plans/`, `specs/`, `audits/` subfolders) on first use; they don't exist by default.

## Status taxonomy

Every file in `docs/plans/` must have a Status block right after the H1:

```markdown
# <Title>

**Status:** <value> — <optional one-line reason>
**Last reviewed:** YYYY-MM-DD

…rest of doc…
```

Allowed values:

| Status | Meaning |
|---|---|
| `active` | being worked on now (open commits, partial implementation in main) |
| `backlog` | queued, ready to start, nothing blocking |
| `blocked` | waiting on a dependency, decision, or calm window (note what in the reason) |
| `speculative` | maybe never — idea preserved for future reference |
| `reference` | living convention/audit/precedent — informs ongoing decisions, doesn't describe pending work |

When work ships, do NOT change the status to `done` in place — `git mv` to `archive/plans/` instead. The folder location is the terminal-state signal.

## Decision tree — where does my new doc go?

```
Is this a draft I'm just starting, before the user has blessed the shape?
  → docs/superpowers/plans/  (or specs/ for design content)

Is this a blessed plan describing pending implementation work?
  → docs/plans/  with Status: backlog (or active/blocked)

Is this a permanent reference doc (conventions, audit methodology, precedent)?
  → docs/plans/  with Status: reference

Is this an idea I want to preserve but probably won't execute?
  → docs/plans/  with Status: speculative

Is the work this doc describes already shipped?
  → docs/archive/<type>/  (no further status changes)
```

## Lifecycle transitions

### 1. Draft (you wrote something new)

Land it in `docs/superpowers/plans/` or `docs/superpowers/specs/`. Drafts use a dated filename `YYYY-MM-DD-<kebab-slug>.md` — the date sorts drafts chronologically while many proposals coexist. No Status frontmatter required yet — the folder is the signal.

### 2. Promote (the user has blessed it)

When the user signs off and the doc should become canonical:

1. Add the Status frontmatter block (pick from the taxonomy above).
2. **Drop the date prefix** when renaming. Canonical filenames in `docs/plans/` are slug-only (`claude-skills-and-conventions.md`, not `2026-05-19-claude-skills-and-conventions.md`).
3. `git mv docs/superpowers/<plans|specs>/YYYY-MM-DD-<slug>.md docs/plans/<slug>.md`.
4. Update any cross-links to the file. Other plans may reference it by path.

A spec paired with an active plan can either be inlined into the plan or live alongside it in `docs/plans/` with the `-design.md` suffix and `Status: reference`. Prefer inlining for short designs; keep separate for >300 lines.

### 3. Archive (work is shipped)

When a plan ships:

1. Verify the doc captures the final state. The archived file is the historical record.
2. `git mv docs/plans/<file>.md docs/archive/plans/<file>.md`.
3. For a plan that had a paired spec in `superpowers/specs/`, archive the spec at the same time to `docs/archive/specs/`.
4. Do **not** change the Status line on archival. Folder location signals "done."

### Status changes within `docs/plans/`

When work moves between `backlog → active`, `active → blocked`, etc., **edit the Status line in place**. Do not move the file. Only the alive↔archive transition involves a `git mv`.

Always bump `**Last reviewed:**` to today when you update a Status.

## Filename convention

| Folder | Format | Example |
|---|---|---|
| `docs/superpowers/plans/` and `specs/` | `YYYY-MM-DD-<slug>.md` | `2026-05-19-claude-skills-and-conventions.md` |
| `docs/plans/` | `<slug>.md` (slug-only, no date) | `claude-skills-and-conventions.md` |
| `docs/archive/<type>/` | preserve whatever name the file had at archival | `claude-skills-and-conventions.md` |

Strip the date prefix at promotion time, not at archive time. Once a file is in a canonical folder, its slug is its identity for cross-links — preserve it through archival.

## When linking between docs

Use repo-relative paths. Common patterns:

- Plan → architecture: `[../architecture/<file>.md](../architecture/<file>.md)`
- Plan → archived doc: `[../archive/plans/<file>.md](../archive/plans/<file>.md)`
- Plan → reference doc (same folder): `[./<file>.md](./<file>.md)`
- Archived doc back to a plan: `[../../plans/<file>.md](../../plans/<file>.md)`

When you archive a file, grep for inbound links to it and update the paths. Otherwise links break silently.

## What this skill does NOT do

- It does not decide *what* the plan should contain — that's `superpowers:writing-plans` / `superpowers:brainstorming`.
- It does not run `git commit`. Doc moves are working-tree changes; the user controls commits in this repo (the rest of the workflow is direct-to-main per `feedback_push_main`, but the user decides when each move lands).

## Common mistakes to avoid

- **Writing a new plan directly into `docs/plans/`** — bypasses the draft-review step. Start in `superpowers/`, get the user to bless it, then promote.
- **Renaming a file when promoting in a way that breaks git's rename detection** — `git mv` preserves blame and rename detection; raw `mv + add + rm` does not.
- **Changing Status to `done`** — there is no `done` status. Shipped work moves to `archive/`. The status taxonomy describes alive states only.
- **Leaving a stale `Last reviewed:` date** — if you edited the doc or changed the Status, bump it.
- **Creating a `docs/specs/` folder at the top level** — design content goes in `docs/superpowers/specs/` (draft), `docs/plans/` with `Status: reference` (promoted), or `docs/archive/specs/` (shipped).

## Companion skills

- `superpowers:brainstorming`, `superpowers:writing-plans` — produce the drafts this skill manages.
````

- [ ] **Step 11.3: Commit**

```bash
git add .claude/skills/manage-plan-docs/SKILL.md
git commit -m "docs(skills): add manage-plan-docs skill"
```

---

## Task 12: Stub skill — `gcloud-cultuvilla` (partial — active sections + TODOs)

**Files:**
- Create: `.claude/skills/gcloud-cultuvilla/SKILL.md`

- [ ] **Step 12.1: Write the skill (active + TODO sections)**

Create `.claude/skills/gcloud-cultuvilla/SKILL.md`:

````markdown
---
name: gcloud-cultuvilla
description: Project-specific gcloud facts for cultuvilla. Use whenever running gcloud against this repo (Cloud Logging, IAM, Secret Manager, BigQuery). Encodes the named-config + dev-default-prod-explicit rule and the auth split between gcloud and the firebase CLI. Several sections are TODO until the matching infrastructure lands (Secret Manager, observability salt, IAM).
---

# gcloud — cultuvilla specifics

## Auth

- The gcloud and Firebase CLIs have **independent** credential stores. `firebase login` does not authenticate gcloud, and vice versa. Cloud Logging / IAM / Secret Manager operations need gcloud auth; Firestore deploys via Firebase CLI use Firebase auth.
- If multiple gcloud accounts are credentialed on this machine, switch with `gcloud auth list` + `gcloud config set account <email>` before working on cultuvilla.

## Named config

- Use a dedicated `cultuvilla` named gcloud configuration when working on this repo: `gcloud config configurations activate cultuvilla`. Create it if missing: `gcloud config configurations create cultuvilla`.
- Active project on this config is intentionally `villa-events` (dev). Beta and prod **must** be addressed with explicit `--project=cultuvilla-beta` / `--project=cultuvilla-prod` on every command.
- Rationale: unscoped commands default to dev so a typo or autocomplete misfire can't reach prod. Defensive even against own shell history.

## Project map

| Profile | Project ID | Notes |
|---|---|---|
| development | `villa-events` | Active gcloud project on the `cultuvilla` named config. Cultuvilla web reads from this when `NEXT_PUBLIC_FIREBASE_*` is set to dev values. |
| beta | `cultuvilla-beta` | Manual deploy refused by `firestore-deploy` skill — beta is for promotion via CI / user-insistence, not ad-hoc. |
| prod | `cultuvilla-prod` | Same — promotion only. |

## Cloud Logging

When investigating a Cloud Function failure that the user can repro on dev:

```bash
gcloud logging read 'resource.type=cloud_function AND jsonPayload.handler="<handler-name>"' \
  --project=villa-events --limit=50 --format='value(timestamp,severity,jsonPayload.message)'
```

The `handler` field is set by the v2 logger convention (see the `cloud-function-logging` skill). Without it, filters fall back to log-name grep which is noisy.

For beta/prod, add `--project=cultuvilla-beta` or `--project=cultuvilla-prod` explicitly.

## When deploying functions

- Dev deploys are fine ad-hoc — use the `firestore-deploy` skill.
- Beta/prod deploys: defer to CI when it's wired up, or require explicit user confirmation. Don't run them silently.

## TODO — fill in when the matching infrastructure lands

- [ ] **Secret Manager.** Cultuvilla does not currently use Secret Manager. When secrets are introduced (e.g. for the future mobile app, Stripe, or first-party observability), add a section here covering:
  - Which secrets exist in which env.
  - How Cloud Functions read them via `defineSecret`.
  - The rotate command (`gcloud secrets versions add <name> --data-file=- --project=<project>`).
  - The "never `secrets versions access` the value" rule (don't pollute shell history).
- [ ] **Observability salt.** If/when an observability event pipeline is added, document the per-env `OBSERVABILITY_USER_ID_SALT` (or equivalent) and the rotation policy — see the analogous ordago section as a template.
- [ ] **IAM grants for service accounts.** No bespoke service accounts beyond default Firebase ones today. When custom ones are introduced, list the role grants and the `gcloud projects add-iam-policy-binding` invocation per env.
- [ ] **BigQuery dataset(s) for analytics.** None today; document if added.

Until these land, the active sections above are sufficient.
````

- [ ] **Step 12.2: Commit**

```bash
git add .claude/skills/gcloud-cultuvilla/SKILL.md
git commit -m "docs(skills): add gcloud-cultuvilla skill (partial, with TODO sections)"
```

---

## Task 13: Stub skill — `expo-native-rebuild`

**Files:**
- Create: `.claude/skills/expo-native-rebuild/SKILL.md`

- [ ] **Step 13.1: Write the stub**

Create `.claude/skills/expo-native-rebuild/SKILL.md`:

````markdown
---
name: expo-native-rebuild
description: STUB — inactive until `apps/mobile/` exists. Future skill for the planned cultuvilla mobile app — rebuild native projects after Expo plugin changes. Activates when the React Native + Expo app is added under `apps/mobile/`. Template below mirrors the ordago-apps procedure; fill in the TODO block before activating.
---

# Rebuild cultuvilla native projects after Expo plugin changes

> **STATUS: STUB.** Cultuvilla has no mobile app today. This skill is a forward template. Do not invoke against the current repo — there are no native projects to rebuild. When `apps/mobile/` is added, fill in the TODO block and remove the STUB banner.

## When this will apply (once mobile lands)

Run a clean prebuild whenever any of:

1. Added/removed a package that ships an Expo config plugin (`@react-native-firebase/app`, `@react-native-firebase/crashlytics`, `@sentry/react-native`, etc.).
2. Changed the `plugins` array in `apps/mobile/app.config.js` (or `app.json`).
3. Modified one of the local plugins under `apps/mobile/plugins/`.
4. App launches and immediately force-closes with a native error from `FirebaseInitProvider`, missing Crashlytics build ID, or a similar Cocoa/Gradle plugin error.

`expo run:android` / `run:ios` does **incremental** prebuild — it does NOT re-merge new Expo config plugins into existing `android/build.gradle`, `android/app/build.gradle`, or `ios/Podfile`. Result: the new plugin is in `app.config.js` but its Gradle/CocoaPods injection never lands.

## The fix (once mobile lands)

`apps/mobile/android/` and `apps/mobile/ios/` will be gitignored prebuild output, regenerated from `app.config.js` and `apps/mobile/plugins/*` on every clean prebuild. Safe to nuke.

```bash
cd <repo-root>/apps/mobile
EAS_BUILD_PROFILE=development npx expo prebuild --platform android --clean
# or --platform ios, or both with no --platform flag
```

After prebuild, rebuild + reinstall via the dev script.

## TODO — fill in before activating

- [ ] Confirm the mobile app's directory name: `apps/mobile/` vs `apps/cultuvilla-app/` vs other.
- [ ] Confirm `app.config.js` vs `app.json` as the source of truth for `plugins`.
- [ ] List the local plugins under `apps/mobile/plugins/` once they exist (e.g. `withGoogleServices.js`, `withAndroidSupportsScreens.js`).
- [ ] Document the build-profile env var name and how it maps to dev/beta/prod google-services files.
- [ ] Document the `pnpm app:build:local:*` (or equivalent) reinstall command.
- [ ] List the expected Gradle/Pods injections to verify — e.g. for Crashlytics:
  - `android/build.gradle`: `classpath 'com.google.firebase:firebase-crashlytics-gradle:...'`
  - `android/app/build.gradle`: `apply plugin: 'com.google.firebase.crashlytics'`
- [ ] Document any cultuvilla-specific package-name suffixes (e.g. `.devclient`, `.beta`) and where they're set.
- [ ] Remove the **STUB STATUS** banner.

## Don't (once activated)

- Manually edit `android/` or `ios/` files to fix plugin injections — they get blown away on the next clean prebuild. Fix the upstream `app.config.js` plugin entry instead.

## When this skill applies

When `apps/mobile/` exists AND the user is changing native modules, plugins, or seeing native init crashes.

## Reference

Template adapted from `ordago-apps/.claude/skills/expo-native-rebuild/SKILL.md`. When activating, refine against cultuvilla's actual mobile setup; the ordago version is illustrative, not authoritative.
````

- [ ] **Step 13.2: Commit**

```bash
git add .claude/skills/expo-native-rebuild/SKILL.md
git commit -m "docs(skills): add expo-native-rebuild skill (stub for future mobile app)"
```

---

## Task 14: Stub skill — `parallel-agent-workflow`

**Files:**
- Create: `.claude/skills/parallel-agent-workflow/SKILL.md`

- [ ] **Step 14.1: Write the stub**

Create `.claude/skills/parallel-agent-workflow/SKILL.md`:

````markdown
---
name: parallel-agent-workflow
description: STUB — inactive until `apps/mobile/` exists and per-slot Metro/emulator infrastructure is wired up. Future skill for parallel agents running Metro, Firebase emulators, and Android emulators concurrently inside `.claude/worktrees/`. The current cultuvilla worktree workflow (web + backend tasks only, no Metro, no AVD) does NOT need this skill.
---

# Parallel agent workflow

> **STATUS: STUB.** Cultuvilla's current parallel-agent setup is worktrees-only — no per-slot Metro, no isolated Firebase emulators, no Android emulator orchestration. The repo's existing `.claude/worktrees/` workflow (documented in [AGENTS.md](../../../AGENTS.md) "Development workflow" step 1) is sufficient for web + backend work. This skill activates when the mobile app lands and per-slot infrastructure is built.

## When this will apply (once mobile + per-slot infra land)

When an agent works inside `.claude/worktrees/<branch>/` AND needs to start long-running services (Metro, Firebase emulators, Android emulator) without colliding with the user's main checkout or other parallel agents.

## Pipeline shape (template — fill in once infra exists)

```
cd into worktree
pnpm agent:slot-up . [--with-device]    ← env + Metro + emulators (+ device)
# … make code changes, tests, open commit …
# (user runs `pnpm agent:slot-down <N> [--with-worktree] [--with-avd]` after review)
```

## TODO — fill in before activating

- [ ] Decide on a port-slot scheme — typically: slot N gets `5000 + N*100` for emulators, `8081 + N*10` for Metro, etc.
- [ ] Add `scripts/agent-env.sh` (or equivalent) that exports `$CULTUVILLA_AGENT_SLOT`, port env vars, and a tmux session name.
- [ ] Add a `firebase.agent.json` config that swaps emulator ports per slot.
- [ ] Add `pnpm agent:slot-up` / `pnpm agent:slot-down` / `pnpm agent:status` scripts.
- [ ] Document the tmux session naming convention: `cultuvilla-slot-<N>` with `metro`, `emulators`, `device` windows.
- [ ] (Mobile-specific) Add Android emulator orchestration: AVD cloning, port forwarding for WSL → Windows host if relevant, RAM-budget guard.
- [ ] Document the "decide: device or no device?" decision table — backend-only tasks skip the device.
- [ ] Document the review-handoff block to paste in commit/PR bodies.
- [ ] Remove the **STUB STATUS** banner.

## Hard rules (template — adapt to cultuvilla)

Once active, the rules should mirror ordago's:

1. **Source `scripts/agent-env.sh` first.** Confirm slot variable is non-zero.
2. **Use `firebase.agent.json` for emulators.** Never the default `firebase.json` from a worktree.
3. **Run services inside the slot's tmux session.**
4. **In the commit body, include the review-handoff block.**
5. **Do NOT tear down yourself** — leaves state alive for user review. User runs `pnpm agent:slot-down`.

## When this skill applies

When `apps/mobile/` exists, per-slot scripts are in place, and the agent needs to run Metro or emulators in parallel. For web + backend work, the current worktree workflow is sufficient — do NOT invoke this skill.

## Reference

Template adapted from `ordago-apps/.claude/skills/parallel-agent-workflow/SKILL.md`. The ordago version is mature; cultuvilla's variant will need port slot numbers, RAM budgets, and tmux session names tuned to this machine.
````

- [ ] **Step 14.2: Commit**

```bash
git add .claude/skills/parallel-agent-workflow/SKILL.md
git commit -m "docs(skills): add parallel-agent-workflow skill (stub for future mobile app)"
```

---

## Task 15: Verify final state + promote spec

- [ ] **Step 15.1: List all created skills**

Run: `ls .claude/skills/`
Expected: 13 directories — `add-firestore-collection`, `cloud-function-logging`, `denormalized-read-model`, `expo-native-rebuild`, `firestore-deploy`, `fix-bug`, `gcloud-cultuvilla`, `guardrail-audit`, `guardrail-enforcement`, `i18n-add-string`, `manage-plan-docs`, `parallel-agent-workflow`, `touch-service`.

- [ ] **Step 15.2: Verify each has a SKILL.md**

Run: `for d in .claude/skills/*/; do test -f "$d/SKILL.md" || echo "MISSING: $d"; done`
Expected: no output (silence = all present).

- [ ] **Step 15.3: Verify frontmatter on every skill**

Run: `for f in .claude/skills/*/SKILL.md; do head -1 "$f" | grep -q '^---$' || echo "BAD FRONTMATTER: $f"; done`
Expected: no output.

- [ ] **Step 15.4: Promote the spec from `superpowers/` to `plans/` (now that the plan is complete)**

Per the `manage-plan-docs` skill: a spec paired with an active plan can live in `docs/plans/` with `-design.md` suffix and `Status: reference`. Since the implementation has shipped, both the spec and this plan move to `docs/archive/`.

Create the archive folders if missing:

```bash
mkdir -p docs/archive/plans docs/archive/specs
```

Move both files:

```bash
git mv docs/superpowers/specs/2026-05-19-claude-skills-and-conventions-design.md \
       docs/archive/specs/2026-05-19-claude-skills-and-conventions-design.md
git mv docs/superpowers/plans/2026-05-19-claude-skills-and-conventions.md \
       docs/archive/plans/2026-05-19-claude-skills-and-conventions.md
```

- [ ] **Step 15.5: Commit the archive move**

```bash
git commit -m "docs(plans): archive claude-skills-and-conventions spec + plan (shipped)"
```

- [ ] **Step 15.6: Final sanity — confirm AGENTS.md cross-references resolve**

Run:

```bash
grep -E '`(touch-service|guardrail-enforcement|add-firestore-collection|denormalized-read-model|cloud-function-logging)`' AGENTS.md
```

Expected: at least one match per skill name — the cross-references added in Task 1.5.

Run:

```bash
for name in touch-service guardrail-enforcement add-firestore-collection denormalized-read-model cloud-function-logging firestore-deploy guardrail-audit fix-bug manage-plan-docs i18n-add-string gcloud-cultuvilla expo-native-rebuild parallel-agent-workflow; do
  test -f ".claude/skills/$name/SKILL.md" && echo "OK $name" || echo "MISSING $name"
done
```

Expected: 13 `OK` lines.

---

## Done state

- 13 skills under `.claude/skills/<name>/SKILL.md`, each with valid YAML frontmatter and a procedure body.
- 5 targeted insertions in `AGENTS.md` (dev-server prohibition, no-retrocompat, be-proactive, four skill cross-references).
- Spec + plan archived to `docs/archive/`.
- 16 commits, each conventional-prefixed (`docs(agents):` or `docs(skills):` or `docs(plans):`).

## Out of scope (deferred — for a future plan)

- Web-side `prepare-release` skill (revisit when release flow is formalized).
- Sub-directory `AGENTS.md` files (mentioned in the new "Be proactive" section as a pattern; not created here).
- Activating the three stub skills — happens when `apps/mobile/` lands.
- A vitest config that asserts every `SKILL.md` has valid frontmatter (would be a nice safeguard but feels like over-tooling for 13 hand-written files).
