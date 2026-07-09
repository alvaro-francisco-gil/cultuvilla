# Content moderation unification + occupations without proposals

**Goal:** Collapse the accidental, per-entity moderation inconsistency into one
optimistic + soft-hide model for user-generated *content*, and remove the
occupation proposal flow in favour of a hardcoded catalog with a free-string
fallback.

## Context

Today almost every user-creatable entity carries the same
`pending | approved | rejected` review field (the shared `reviewDecisionFields`
mixin from `ReviewableDataModel`), but that field only actually gates *display*
for two of them:

| Entity | Gated before display? | How |
|---|---|---|
| News posts | **yes** | feed queries force `status == 'approved'` in `newsService` |
| Occupations | **yes** | separate `occupationProposals/` collection, public reads only live `occupations/` |
| Barrios | no | `allow read: if true`, no status filter; comment: "lands as `pending` and is visible to all" |
| Places | no | same as barrios |
| Organizations | soft-gated | rules open; visibility depends on whether the *caller* passes `'approved'` |
| Festival posters | soft-gated | same as organizations |
| Events | no | `status` is a lifecycle enum (`published`/`cancelled`/`completed`), not a review gate |

The result is a `status` field that means "hidden until approved" for news,
nothing for barrios/places, and "hidden if the caller remembered to filter" for
orgs/posters. That per-call-site soft-gating is a latent leak, not a design.

Separately, occupations use a full proposal → app-admin-review → live-collection
pipeline for what is effectively a free-text tag on a person. That ceremony is
disproportionate to the value.

## Decisions (settled during brainstorming)

- **Posture: optimistic everywhere.** Content appears the moment it is created;
  a village admin removes/hides bad content a posteriori. Enforced in the
  service layer, never per-call-site.
- **Removal = soft-hide,** not hard delete. Reversible, keeps an audit trail,
  avoids dangling references from notifications / denormalized read models.
- **Scope = pure content only:** news posts, festival posters, barrios, places.
- **Out of scope (keep their approval gate):** organizations and organizer
  requests — approval there *grants admin authority* (seeds the founder as
  admin; ayuntamiento = town hall), so the gate is a real safeguard, not
  accidental soft-gating. Events remain unmoderated (lifecycle only).
- **Hide is an audited callable,** not a rules-gated client write. Moderation is
  an accountability-sensitive authority action; we want a tamper-proof record of
  who hid whose content and why, and `status` should be function-owned so it
  can't be forged. This matches the repo's existing pattern
  (`changeVillageMemberRole` / `approveOrganization` → `membershipEvents`).

## Design

### A. Unified visibility model (news, festival posters, barrios, places)

Replace `reviewDecisionFields` / `ReviewStatus` on these four entities with a
shared **visibility** field set (new, in `packages/shared/src/models/core/`):

```
VisibilityStatus = 'active' | 'hidden'
visibilityFields = { status: VisibilityStatus, hiddenBy: string | null,
                     hiddenAt: Date | null, hiddenReason: string | null }
```

- All four are **created `active`** and visible immediately.
- **Read filter lives in the service:** every public/feed query filters
  `status == 'active'`. No call site can surface hidden content. This closes the
  current soft-gating on orgs/posters (posters are in scope; orgs keep approval
  and are handled separately — see Out of scope).
- **`status` is function-owned.** `firestore.rules` forbid clients from writing
  `status` / `hiddenBy` / `hiddenAt` / `hiddenReason` on these collections.

Removed as part of this:
- News: `moderateNewsPost` approval callable, the trusted-author auto-approve
  bypass, `rejectionReason`. `submittedAt` → `createdAt`; `publishedAt` set at
  creation.
- Barrios/places: `approveBarrio` / `approvePlace`; `propose*` service names
  become `create*`. The `ProposalStatus` type usage on these two is dropped.
- Festival posters: the `approve`-poster path; the village-home call stops
  passing `'approved'` (the service filters `active` itself).

### B. `setContentVisibility` audited callable + `moderationEvents/` log

One callable handles hide/unhide for all four collections:

```
setContentVisibility({ collection, docId, hidden, reason? })
```

- Verifies the caller is a village admin of the doc's `municipalityId`
  (or app admin) — server-authoritative.
- In one transaction: flips `status` (+ `hiddenBy`/`hiddenAt`/`hiddenReason`),
  and appends to `moderationEvents/` (append-only, top-level, scoped by
  `municipalityId`, readable by village/app admins) — a sibling of
  `membershipEvents/`.
- `collection` is validated against an allow-list of the four in-scope
  collections; anything else is rejected.

### C. Occupations: hardcoded catalog + collected free strings

- **Catalog:** a global constant of occupation keys with i18n labels, in
  `@cultuvilla/shared` (keys) + `@cultuvilla/i18n` (labels). Source of truth for
  the suggested list.
- **Person field:** replace `occupationIds: string[]` **and**
  `pendingOccupations: string[]` with a single `occupations: string[]`. Each
  entry is either a catalog key or a raw free string typed by the user. Render
  as `catalogLabel(value) ?? value`.
- **Collected free strings:** a lightweight global `occupations/` collection,
  upserted per free string via `recordOccupation(name)` →
  `occupations/{slug}` `{ name, count: increment(1), updatedAt }`. `slug` is a
  normalized (lowercased, trimmed, accent-folded) key for dedup. No status, no
  approval. Admins "promote" a popular free string by adding it to the catalog
  (a code change) and optionally pruning the collection.
- **Deleted:** the `occupationProposals/` collection and its model;
  `proposeOccupation`, `getPendingProposals`, `reviewProposal`; the app-admin
  occupation-review UI. The `occupations/` collection is repurposed from
  "approved occupations" to "collected free strings" (no `createdAt`/`createdBy`
  ceremony beyond what's useful for curation).

### D. Migration (dev backfill — autonomous, `villa-events` only)

- **Persons:** build `occupations[]` from the old fields — resolve each
  `occupationId` to its occupation-doc `name` (map to a catalog key if it
  matches, else keep the name as a free string), append `pendingOccupations`
  verbatim, then remove `occupationIds` + `pendingOccupations`.
- **`occupations/`:** rebuild in the collected-free-strings shape (or wipe and
  let `recordOccupation` refill).
- **`occupationProposals/`:** delete.
- **News / posters / barrios / places:** re-point `status` — existing
  `approved` and `pending` both become `active` (optimistic: previously-pending
  content becomes visible); `rejected` news becomes `hidden` with
  `hiddenReason` carried over from `rejectionReason` if present.
- Idempotent `scripts/backfill-*.mjs` per the `firebase-admin-dev` conventions;
  verify with `pnpm check:dev-conformance` before and after.

### E. Testing

- **vitest (`packages/shared/test/`):** catalog lookup / label resolution;
  `recordOccupation` slug normalization + dedup; the new visibility model
  builders; person `occupations[]` builder.
- **e2e rules (`packages/shared/test/e2e/`):** clients cannot write
  `status`/`hidden*` on the four collections; village admin (and app admin) can
  invoke the hide path, non-admins cannot; service queries exclude `hidden`
  docs.
- **functions:** `setContentVisibility` authority checks + `moderationEvents`
  append, under the emulator harness.
- Update the already-touched news storage-rules tests as needed.

## Resolved / out of scope

- **`moderationEvents` is a new collection** (not a reuse of `membershipEvents`):
  membership events are about roles, moderation is about content; one log per
  concern.
- **Village-specific occupation catalogs:** out of scope. The catalog is global;
  a per-village catalog is a future extension.
- **Author notification on hide:** deferred. The callable is the natural home for
  it, but v1 ships without it.
- **Organizations / organizer requests / events:** unchanged (see Decisions).

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Architecture:** Two independent workstreams. WS1 replaces the review gate on
four content entities with a `VisibilityStatus` model + an audited
`setContentVisibility` callable. WS2 removes the occupation proposal pipeline in
favour of a hardcoded catalog + a free-string field on the person. Ship WS1 and
WS2 separately; within each, tasks are ordered so every task ends green.

**Tech stack:** TypeScript (strict), Zod + `makeConverter`, Firebase (Firestore
rules, Cloud Functions v2 `onCall`), vitest (`packages/shared`), Firebase
emulator harness (`functions/`, `packages/shared/test/e2e/`), Expo/RN mobile.

## Global Constraints

- Strict TS, no `any`, no `@ts-nocheck`. `unknown` + narrow at boundaries.
- No Firebase SDK imports in components/hooks — go through a service
  (`packages/shared/src/services/`). `functions/` never uses `console.*` — use
  `logger.*(msg, { handler, ... })`.
- Every new query shape needs a composite index in `firestore.indexes.json` in
  the same change.
- Reads route through strict Zod converters: a model field change requires a
  dev backfill in the same change (no optional-field shims). Dev backfill is
  autonomous on `villa-events`; verify with `pnpm check:dev-conformance`.
- New collection = `add-firestore-collection` checklist (model + service + index
  re-export + `_services-map.md` + rules + composite index + vitest + rules
  test).
- User-facing strings via `@cultuvilla/i18n` + `useT()`.
- Conventional commits; run `pnpm check` before pushing.

## File Structure

**WS1 — visibility model + moderation**
- Create `packages/shared/src/models/core/VisibilityModel.ts` — `VisibilityStatus`,
  `visibilityFields`.
- Create `packages/shared/src/models/moderation/ModerationEventDataModel.ts` +
  `index.ts` — the audit-log doc.
- Create `functions/src/moderation/setContentVisibility.ts` — the callable.
- Modify models: `NewsPostDataModel.ts`, `FestivalPosterDataModel.ts`,
  `BarrioDataModel.ts`, `PlaceDataModel.ts` — swap `reviewDecisionFields` →
  `visibilityFields`; news also drops `rejectionReason`, renames
  `submittedAt`→`createdAt`, sets `publishedAt` at create.
- Modify services: `newsService.ts`, `festivalPosterService.ts`,
  `municipalityService.ts` — `status == 'active'` read filter, `approve*`/
  `propose*` → `create*`, add `setContentVisibility` wrappers.
- Delete `functions/src/news/moderateNewsPost.ts` + its `index.ts` export.
- Modify `firestore.rules` — function-own `status`/`hidden*` on the four
  collections; add `moderationEvents` read rules.
- Modify `firestore.indexes.json` — `status + <sortField>` indexes for the four.
- Modify mobile: `components/feature/proposable/{PlacesManager,BarriosManager,
  FestivalPostersManager}.tsx` (approve/reject → hide/unhide), news
  moderation surfaces.
- Create `scripts/backfill-visibility-status.mjs`.

**WS2 — occupations**
- Create `packages/shared/src/models/occupation/occupationCatalog.ts` — catalog
  keys.
- Add catalog labels to `packages/i18n/messages/es.json`.
- Modify `packages/shared/src/models/occupation/index.ts` +
  `OccupationDataModel.ts` — repurpose `occupations/` doc to collected
  free-string shape; delete the proposal model.
- Modify `occupationService.ts` — `recordOccupation`, delete `proposeOccupation`/
  `getPendingProposals`/`reviewProposal`.
- Modify `PersonDataModel.ts` — `occupationIds` + `pendingOccupations` → single
  `occupations: string[]`.
- Modify person-edit mobile screen; delete `apps/mobile/app/admin/occupations.tsx`.
- Create `scripts/backfill-person-occupations.mjs`.

---

## WS1 — Unified visibility model + moderation callable

### Task 1: `VisibilityModel` core fields

**Files:**
- Create: `packages/shared/src/models/core/VisibilityModel.ts`
- Test: `packages/shared/test/models/visibilityModel.test.ts`

**Produces:** `VisibilityStatus = 'active' | 'hidden'`; spreadable
`visibilityFields` (`status`, `hiddenBy: string|null`, `hiddenAt: Date|null`,
`hiddenReason: string|null`); `defaultVisibility()` → `{ status: 'active',
hiddenBy: null, hiddenAt: null, hiddenReason: null }`.

- [ ] **Step 1 — failing test**

```ts
import { describe, it, expect } from 'vitest';
import { VisibilityStatusSchema, visibilityFields, defaultVisibility }
  from '../../src/models/core/VisibilityModel';
import { z } from 'zod';

describe('VisibilityModel', () => {
  it('parses active/hidden and rejects legacy review statuses', () => {
    expect(VisibilityStatusSchema.parse('active')).toBe('active');
    expect(VisibilityStatusSchema.parse('hidden')).toBe('hidden');
    expect(() => VisibilityStatusSchema.parse('pending')).toThrow();
  });
  it('defaultVisibility is active with null hide metadata', () => {
    expect(defaultVisibility()).toEqual({
      status: 'active', hiddenBy: null, hiddenAt: null, hiddenReason: null,
    });
  });
  it('visibilityFields compose into a schema', () => {
    const s = z.object({ ...visibilityFields });
    expect(s.parse(defaultVisibility()).status).toBe('active');
  });
});
```

- [ ] **Step 2 — run, expect fail** — `pnpm --filter @cultuvilla/shared test visibilityModel` → FAIL (module missing).
- [ ] **Step 3 — implement**

```ts
import { z } from 'zod';

export const VisibilityStatusSchema = z.enum(['active', 'hidden']);
export type VisibilityStatus = z.infer<typeof VisibilityStatusSchema>;

/** Spreadable visibility fields. `status` is function-owned (see firestore.rules);
    clients never write these. hidden* are null while active. */
export const visibilityFields = {
  status: VisibilityStatusSchema,
  hiddenBy: z.string().nullable(),
  hiddenAt: z.date().nullable(),
  hiddenReason: z.string().nullable(),
};

export function defaultVisibility() {
  return { status: 'active' as const, hiddenBy: null, hiddenAt: null, hiddenReason: null };
}
```

- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — export** from `packages/shared/src/models/core/index.ts` (add `export * from './VisibilityModel';`), then commit: `feat(shared): add VisibilityStatus core model`.

### Task 2: `moderationEvents` collection (model + rules + index + services-map)

Follow the `add-firestore-collection` skill.

**Files:**
- Create: `packages/shared/src/models/moderation/ModerationEventDataModel.ts`, `.../index.ts`
- Modify: `packages/shared/src/models/index.ts` (re-export), `firestore.rules`,
  `firestore.indexes.json`, `packages/shared/src/services/_services-map.md`
- Test: `packages/shared/test/models/moderationEvent.test.ts`

**Produces:** `ModerationEventData` = `{ municipalityId: string, collection:
ModeratedCollection, docId: string, action: 'hide' | 'unhide', actorUserId:
string, reason: string | null, createdAt: Date }`; `ModeratedCollectionSchema =
z.enum(['news','festivalPosters','barrios','places'])`; `buildModerationEventData(input)`.

- [ ] **Step 1 — failing test** (build + schema round-trip):

```ts
import { describe, it, expect } from 'vitest';
import { buildModerationEventData, ModerationEventDataSchema }
  from '../../src/models/moderation';

it('builds a hide event', () => {
  const e = buildModerationEventData({
    municipalityId: 'm1', collection: 'news', docId: 'n1',
    action: 'hide', actorUserId: 'admin1', reason: 'spam', createdAt: new Date(0),
  });
  expect(ModerationEventDataSchema.parse(e).action).toBe('hide');
});
it('rejects an out-of-scope collection', () => {
  expect(() => ModerationEventDataSchema.parse({
    municipalityId: 'm1', collection: 'organizations', docId: 'o1',
    action: 'hide', actorUserId: 'a', reason: null, createdAt: new Date(0),
  })).toThrow();
});
```

- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement model** (mirror `MembershipEventDataModel.ts` shape).
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — rules:** add to `firestore.rules` — `moderationEvents/{id}`:
  `allow read: if isVillageAdmin(resource.data.municipalityId) || isAppAdmin();`
  `allow write: if false;` (function-owned). Add composite index
  `moderationEvents: municipalityId ASC, createdAt DESC` to
  `firestore.indexes.json`. Add a row to `_services-map.md`.
- [ ] **Step 6 — commit:** `feat(shared): add moderationEvents collection`.

### Task 3: `setContentVisibility` callable

**Files:**
- Create: `functions/src/moderation/setContentVisibility.ts`
- Modify: `functions/src/index.ts` (export)
- Test: `functions/src/moderation/__tests__/setContentVisibility.test.ts`

**Consumes:** `ModeratedCollectionSchema`, `buildModerationEventData`.
**Produces:** callable `setContentVisibility({ collection, docId, hidden,
reason? })` → `{ status: VisibilityStatus }`. Authority: caller is admin of the
doc's `municipalityId` (via `municipalities/{id}/members/{uid}.role == 'admin'`)
or app admin. Transaction: set `status`/`hiddenBy`/`hiddenAt`/`hiddenReason` on
the target doc + append a `moderationEvents` doc.

- [ ] **Step 1 — failing test** (emulator harness, mirror
  `moderateNewsPost.test.ts`): seed a village admin + a news doc `active`; call
  with `hidden: true` → target `status == 'hidden'`, `hiddenBy == adminUid`, a
  `moderationEvents` doc exists with `action: 'hide'`. Non-admin call →
  `HttpsError('permission-denied')`. Unknown `collection` →
  `HttpsError('invalid-argument')`.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement:**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ModeratedCollectionSchema } from '@cultuvilla/shared/models/moderation';

// collection key -> Firestore path builder (top-level vs municipality-scoped)
const PATHS: Record<string, (id: string, m: string) => string> = {
  news:            (id) => `news/${id}`,
  festivalPosters: (id) => `festivalPosters/${id}`,
  barrios:         (id, m) => `municipalities/${m}/barrios/${id}`,
  places:          (id, m) => `municipalities/${m}/places/${id}`,
};
```

  Validate `collection` with `ModeratedCollectionSchema.safeParse`; read the
  target doc; derive `municipalityId` from the doc; verify admin via a members
  read; run a transaction that patches the four visibility fields
  (`status: hidden ? 'hidden' : 'active'`, hide metadata or nulls) and creates
  the `moderationEvents` doc; `logger.info('content visibility set', { handler:
  'setContentVisibility', collection, docId, hidden })`.
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — export** from `functions/src/index.ts`; **delete**
  `functions/src/news/moderateNewsPost.ts` and its export (superseded).
- [ ] **Step 6 — commit:** `feat(functions): setContentVisibility callable + moderationEvents`.

### Task 4: News model → visibility

**Files:** Modify `packages/shared/src/models/news/NewsPostDataModel.ts`;
Test `packages/shared/test/models/newsPost.test.ts` (extend).

- [ ] **Step 1 — failing test:** `buildNewsPostData({...})` yields `status:
  'active'`, `hiddenBy: null`, has `createdAt`, has `publishedAt` set (== input
  or `createdAt`), and has **no** `submittedAt`/`rejectionReason`/`reviewedBy`.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement:** replace `...reviewDecisionFields` with
  `...visibilityFields`; remove `rejectionReason`; rename `submittedAt` →
  `createdAt`; builder defaults `status` via `defaultVisibility()`, sets
  `publishedAt: input.publishedAt ?? input.createdAt`. Remove the trusted-author
  auto-approve concept from the builder.
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — commit:** `refactor(shared): news post uses visibility model`.

### Task 5: Festival poster / barrio / place models → visibility

**Files:** Modify `FestivalPosterDataModel.ts`, `BarrioDataModel.ts`,
`PlaceDataModel.ts`; extend their model tests.

- [ ] **Step 1 — failing tests:** each builder yields `status: 'active'` +
  null hide metadata; `ProposalStatus`/`reviewDecisionFields` no longer present.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement:** swap `reviewDecisionFields` → `visibilityFields`,
  builder default `defaultVisibility()`. Drop `ProposalStatus` usage on these.
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — commit:** `refactor(shared): posters/barrios/places use visibility model`.

### Task 6: Service read-filters + create/hide API

**Files:** Modify `newsService.ts`, `festivalPosterService.ts`,
`municipalityService.ts`; `firestore.indexes.json`; extend service vitest.

**Produces:** every public read filters `where('status','==','active')`;
`proposeBarrio`→`createBarrio`, `proposePlace`→`createPlace` (no `proposedBy`/
approve params); `approveBarrio`/`approvePlace`/`approveFestivalPoster` deleted;
thin client wrappers `hideContent(collection, docId, reason?)` /
`unhideContent(collection, docId)` that call `setContentVisibility` (via
`functions` service seam).

- [ ] **Step 1 — failing tests** (vitest with a mocked Firestore query builder,
  mirror existing `newsService` tests): assert the query includes a `status ==
  'active'` constraint for the home/all-villages/other-villages reads and for
  `getFestivalPosters`/`getBarrios`/`getPlaces`.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement** the filters + renames + wrappers. Add composite
  indexes: `news: status ASC, municipalityId ASC, publishedAt DESC` (adjust to
  the existing news index shape), `festivalPosters: municipalityId ASC, status
  ASC, <sortField>`, and confirm barrios/places single-collection reads need a
  `status`-included index (add if the query orders/filters need it).
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — commit:** `refactor(shared): services filter active + hide/unhide wrappers`.

### Task 7: firestore.rules — function-own visibility

**Files:** Modify `firestore.rules`; extend `packages/shared/test/e2e/` (new
`visibilityRules.test.ts` or extend `newsRules`/`placeProposalRules`/
`barrioProposalRules`/`festivalPosterRules`).

- [ ] **Step 1 — failing e2e tests:** a client update that changes `status` (or
  any `hidden*` field) on `news`/`festivalPosters`/`barrios`/`places` is
  **denied**; a client update to allowed content fields (title/body/etc.) still
  **succeeds**; reads of `active` docs succeed for anyone per existing posture.
- [ ] **Step 2 — run, expect fail** (`pnpm test:rules`, emulators booted by the
  wrapper — user runs long-lived emulators; this self-boots when they're down).
- [ ] **Step 3 — implement:** in each of the four collection rules, add to the
  update guard `&& request.resource.data.diff(resource.data).affectedKeys()
  .hasAny(['status','hiddenBy','hiddenAt','hiddenReason']) == false` (clients
  cannot touch visibility fields). Creation must set `status == 'active'` and
  null hide metadata.
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — commit:** `feat(rules): visibility fields are function-owned`.

### Task 8: Mobile — hide/unhide UI

**Files:** Modify `components/feature/proposable/{PlacesManager,BarriosManager,
FestivalPostersManager}.tsx`, the news detail/admin surfaces, and
`apps/mobile/lib/useVillageHome.ts` (stop passing `'approved'`); i18n strings.

- [ ] **Step 1** — replace the `onApprove`/`onReject` affordances in the three
  managers with a single admin **hide/unhide** action wired to
  `hideContent`/`unhideContent`. Remove `proposedBy` from create calls.
- [ ] **Step 2** — news: replace the moderation (approve/reject) surface with
  hide/unhide for village admins; drop trusted-author UI branches.
- [ ] **Step 3** — `useVillageHome`/`useMentionSources` etc.: drop the manual
  `'approved'` status args (the service filters now).
- [ ] **Step 4** — add/rename i18n keys under the relevant namespaces.
- [ ] **Step 5** — `pnpm app:typecheck && pnpm app:test`; expect pass.
- [ ] **Step 6 — commit:** `feat(mobile): admin hide/unhide replaces approve flow`.

### Task 9: Dev backfill — visibility status

**Files:** Create `scripts/backfill-visibility-status.mjs`.

- [ ] **Step 1** — write an idempotent script (mirror
  `scripts/backfill-municipality-namelower.mjs`): project-id guard
  (`villa-events`), for `news`, `festivalPosters`, and every
  `municipalities/*/barrios|places`: map `approved|pending → active` (set
  `status`, null hide metadata), `rejected` (news) → `hidden` +
  `hiddenReason` from `rejectionReason`; remove `reviewedBy`/`reviewedAt`/
  `rejectionReason`/`submittedAt` (news writes `createdAt` from `submittedAt`).
- [ ] **Step 2** — run against dev; run `pnpm check:dev-conformance` before/after.
- [ ] **Step 3 — commit:** `chore(scripts): backfill visibility status on dev`.
- [ ] **Step 4 — deploy** rules + indexes to dev via `firestore-deploy` skill;
  deploy `setContentVisibility` (`pnpm deploy:functions:dev`).

---

## WS2 — Occupations without proposals

### Task 10: Occupation catalog

**Files:** Create
`packages/shared/src/models/occupation/occupationCatalog.ts`; add labels to
`packages/i18n/messages/es.json`; Test
`packages/shared/test/models/occupationCatalog.test.ts`.

**Produces:** `OCCUPATION_CATALOG: readonly string[]` (stable keys, e.g.
`'farmer'`, `'teacher'`, …); `isCatalogOccupation(value): boolean`;
`occupationI18nKey(key): string` (`occupations.catalog.<key>`).

- [ ] **Step 1 — failing test:** catalog is non-empty, keys are unique
  lowercase-kebab, `isCatalogOccupation('teacher')` true / `'astronaut-xyz'`
  false, `occupationI18nKey('teacher') === 'occupations.catalog.teacher'`.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement** the constant + helpers; add matching
  `occupations.catalog.*` labels to `es.json`.
- [ ] **Step 4 — run, expect pass; commit:** `feat(shared): occupation catalog`.

### Task 11: Repurpose `occupations/` + `recordOccupation`; delete proposal flow

**Files:** Modify `packages/shared/src/models/occupation/OccupationDataModel.ts`
+ `index.ts` (delete proposal model), `occupationService.ts`; Test
`packages/shared/test/services/recordOccupation.test.ts` + model test.

**Produces:** `occupations/{slug}` doc `{ name: string, count: number,
updatedAt: Date }`; `slugifyOccupation(name): string` (lowercase, trim,
accent-fold, collapse whitespace to `-`); `recordOccupation(name):
Promise<void>` (upsert with `count: FieldValue.increment(1)`); `getOccupations()`
returns the collected list for suggestions. Deleted: proposal model,
`proposeOccupation`, `getPendingProposals`, `reviewProposal`, `createOccupation`,
`deleteOccupation` review usage.

- [ ] **Step 1 — failing test:** `slugifyOccupation('  Panadería ')` →
  `'panaderia'`; two names with same slug collide to one doc; `recordOccupation`
  increments `count`.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement**; delete the proposal model + service fns + their
  index exports.
- [ ] **Step 4 — run, expect pass.**
- [ ] **Step 5 — rules:** `occupations/{slug}` — `allow read: if true;` update
  guard so clients may only bump `count`/set `name`/`updatedAt` (or make it
  function-owned if we route through a callable — default: client upsert is
  fine, low-risk reference data). Delete `occupationProposals` rules. e2e rules
  test updated.
- [ ] **Step 6 — commit:** `refactor(shared): occupations collected, no proposals`.

### Task 12: Person model — `occupations[]`

**Files:** Modify `packages/shared/src/models/person/PersonDataModel.ts`; extend
person model test.

- [ ] **Step 1 — failing test:** `buildPersonData({ occupations: ['teacher','Herrero
  del pueblo'] })` yields `occupations: ['teacher','Herrero del pueblo']` and
  has **no** `occupationIds`/`pendingOccupations`.
- [ ] **Step 2 — run, expect fail.**
- [ ] **Step 3 — implement:** replace both fields with `occupations:
  z.array(z.string()).default([])`; update `PersonDataInput` + builder.
- [ ] **Step 4 — run, expect pass; commit:** `refactor(shared): person.occupations single field`.

### Task 13: Mobile — occupation picker; delete admin review

**Files:** Modify the person-edit screen (occupation input); **delete**
`apps/mobile/app/admin/occupations.tsx`; i18n strings.

- [ ] **Step 1** — occupation input: multi-select over
  `OCCUPATION_CATALOG` (i18n labels) + a free-text "otro" entry that appends the
  raw string and calls `recordOccupation`. Persist to `person.occupations`.
- [ ] **Step 2** — delete the admin occupation-review screen + its route/nav
  entry + the now-unused service imports.
- [ ] **Step 3** — `pnpm app:typecheck && pnpm app:test`; expect pass.
- [ ] **Step 4 — commit:** `feat(mobile): occupation catalog picker + free text`.

### Task 14: Dev backfill — persons + occupations; delete proposals

**Files:** Create `scripts/backfill-person-occupations.mjs`.

- [ ] **Step 1** — idempotent script: for each person, resolve `occupationIds`
  → occupation-doc `name` (or catalog key if `isCatalogOccupation`), append
  `pendingOccupations` verbatim, write `occupations[]`, remove the two old
  fields; rebuild `occupations/` in the collected shape (or wipe + let
  `recordOccupation` refill); delete the `occupationProposals/` collection.
- [ ] **Step 2** — run on dev; `pnpm check:dev-conformance` before/after.
- [ ] **Step 3 — commit:** `chore(scripts): backfill person occupations on dev`.
- [ ] **Step 4 — deploy** rules to dev (`firestore-deploy` skill).

### Task 15: Docs + full gate

- [ ] **Step 1** — update `_services-map.md` (occupations repurposed,
  moderationEvents added, removed services), `CHANGELOG.md` `[Unreleased]`, and
  delete any stale proposal references in `docs/`.
- [ ] **Step 2** — run `pnpm check`; expect green.
- [ ] **Step 3 — commit:** `docs: sync services map + changelog for moderation/occupations`.

## Self-review notes

- **Spec coverage:** Part A → Tasks 1,4,5,6,7,8,9. Part B (callable + log) →
  Tasks 2,3. Part C (occupations) → Tasks 10–14. Migration (Part D) → Tasks
  9,14. Testing (Part E) → per-task tests + Task 15 gate.
- **Type consistency:** `VisibilityStatus`, `visibilityFields`,
  `defaultVisibility`, `ModeratedCollectionSchema`, `setContentVisibility`,
  `hideContent`/`unhideContent`, `recordOccupation`, `slugifyOccupation`,
  `OCCUPATION_CATALOG`, `person.occupations` — names are used consistently
  across tasks.
- **Ordering:** WS1 model→service→rules→mobile→backfill→deploy; WS2
  catalog→collection→person→mobile→backfill. Each task ends green.
