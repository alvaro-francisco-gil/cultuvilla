# Remove Reactions + Invisible Read Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the entity reactions feature end-to-end, add an invisible function-owned `readCount` per entity, move the feed card comment count to the title row, force comments last on the festival-poster detail, and drop the "be the first to comment" string.

**Architecture:** Reactions are removed from every layer (models → converters/refs → service → Cloud Function → rules → UI → i18n → tests), following delete>deprecate. `readCount` mirrors the existing `commentCount` denormalized-counter pattern but is written only by a new no-auth callable `recordEntityView` (admin `FieldValue.increment`), invoked fire-and-forget when a detail screen mounts, and never displayed.

**Tech Stack:** TypeScript (strict), Zod schemas, Firebase (Firestore, Cloud Functions v2 `onCall`), Expo/React Native + NativeWind, vitest (shared), jest (mobile), `@firebase/rules-unit-testing` (rules e2e).

## Global Constraints

- Strict TypeScript everywhere. No `any`, no `@ts-nocheck`, no `// eslint-disable`.
- Components/hooks/screens must not import `firebase/*` directly — go through a service.
- Denormalized counts (`commentCount`, `readCount`) are **function-owned**: clients never write them; rules must forbid client writes and require `== 0` on create.
- Cloud Functions: never `console.*`; use `logger.info/warn/error` with a `handler` field.
- User-facing strings go through `useT()` / `packages/i18n/messages/es.json`.
- No retrocompat shims; delete dead code. Backfill dev (`villa-events`) docs in the same change.
- Affected entity kinds (6): `event`, `festivalPoster`, `news`, `organization`, `place`, `barrio`.
- Work happens in worktree `.claude/worktrees/reactions-readcount` on branch `feat/remove-reactions-read-count`. Every command runs from that worktree root.
- Conventional commits, header ≤ 100 chars. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Models — drop `reactionCounts`, add `readCount`

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts`
- Modify: `packages/shared/src/models/festivalPoster/FestivalPosterDataModel.ts`
- Modify: `packages/shared/src/models/news/NewsPostDataModel.ts`
- Modify: `packages/shared/src/models/organization/OrganizationDataModel.ts`
- Modify: `packages/shared/src/models/municipality/MunicipalityDataModel.ts` (place + barrio schemas)
- Delete: `packages/shared/src/models/interaction/ReactionDataModel.ts`
- Modify: `packages/shared/src/models/interaction/index.ts` (drop `ReactionDataModel` re-export)
- Test: `packages/shared/test/models/event/EventDataModel.test.ts`,
  `.../organization/OrganizationDataModel.test.ts`, `.../news/NewsPostDataModel.test.ts`,
  `packages/shared/test/models/interaction.test.ts`

**Interfaces:**
- Produces: each entity read schema now has `readCount: z.number().int()` and no
  `reactionCounts`; builders default `readCount: 0`. `ReactionKind`, `ReactionCounts`,
  `ReactionData`, `ReactionCountsSchema`, `NewsReactionCountsSchema`, `buildReactionData`,
  `reactionDocId` no longer exist.

- [ ] **Step 1: Update model tests (RED).** In each model test, replace `reactionCounts`
  assertions with `readCount`. Example for `EventDataModel.test.ts` — where the builder
  default is asserted:

```ts
// was: expect(event.reactionCounts).toEqual({ like: 0, heart: 0 });
expect(event.readCount).toBe(0);
expect(event.commentCount).toBe(0);
expect('reactionCounts' in event).toBe(false);
```

  In `interaction.test.ts`, delete every test that imports from `ReactionDataModel`
  (`ReactionKindSchema`, `reactionDocId`, `buildReactionData`, `ReactionCountsSchema`).
  Keep the comment/`EntityKind` tests.

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `pnpm --filter @cultuvilla/shared test -- models`
Expected: FAIL (readCount missing / removed exports still referenced).

- [ ] **Step 3: Edit `ReactionDataModel.ts` → delete the file**, then in
  `models/interaction/index.ts` remove the line `export * from './ReactionDataModel';`.

- [ ] **Step 4: For each of the 6 entity schemas**, remove the `ReactionCountsSchema`
  (or `NewsReactionCountsSchema`) import + field + the `{ like:0, heart:0 }` builder default,
  and add `readCount`. Pattern (EventDataModel.ts):

```ts
// remove: import { ReactionCountsSchema } from '../interaction/ReactionDataModel';
// in the schema object, replace `reactionCounts: ReactionCountsSchema,` with:
  readCount: z.number().int(),
// in the builder, replace `reactionCounts: { like: 0, heart: 0 },` with:
  readCount: 0,
```

  For `NewsPostDataModel.ts` also delete the `NewsReactionCountsSchema` /
  `NewsReactionCounts` declarations and the optional `reactionCounts?` builder input;
  add `readCount: z.number()` to the schema and `readCount: input.readCount ?? 0` to the
  builder (news uses loose `z.number()` for counts — match `commentCount`). For
  `MunicipalityDataModel.ts` apply the change to **both** the place and barrio schemas
  and their builders.

- [ ] **Step 5: Run tests to confirm they pass.**

Run: `pnpm --filter @cultuvilla/shared test -- models`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add packages/shared/src/models packages/shared/test/models
git commit -m "refactor(shared): drop reactionCounts, add readCount on entity models"
```

---

### Task 2: Shared refs, converters, service

**Files:**
- Delete: `packages/shared/src/firebase/converters/reactionConverter.client.ts`, `.admin.ts`
- Modify: `packages/shared/src/firebase/refs/client.ts`, `refs/admin.ts`
- Modify: `packages/shared/src/services/commentsService.ts`
- Test: `packages/shared/test/services/commentsService.test.ts`,
  `packages/shared/test/integration/commentsServiceIntegration.test.ts`,
  `packages/shared/test/firebase/converters/eventConverter.test.ts` (drop any reactionCounts refs)

**Interfaces:**
- Consumes: Task 3's callable name `recordEntityView` (Firebase callable id).
- Produces: `commentsService` exports `addComment`, `deleteComment`, `getComments`,
  and new `recordEntityView(input: { entityKind: EntityKind; entityId: string; municipalityId: string }): Promise<void>`.
  No `reactToEntity` / `removeReaction` / `getMyReaction` / `ReactToEntityInput`.
  `reactionsCollection` / `reactionDoc` refs removed.

- [ ] **Step 1: Update service tests (RED).** In `commentsService.test.ts` and
  `commentsServiceIntegration.test.ts`, delete tests for `reactToEntity`, `removeReaction`,
  `getMyReaction`. Add a unit test that `recordEntityView` invokes the callable with the
  args (mock `httpsCallable`):

```ts
it('recordEntityView calls the recordEntityView callable with entity coords', async () => {
  const callable = vi.fn().mockResolvedValue({ data: undefined });
  vi.mocked(httpsCallable).mockReturnValue(callable as never);
  await recordEntityView({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1' });
  expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'recordEntityView');
  expect(callable).toHaveBeenCalledWith({ entityKind: 'event', entityId: 'e1', municipalityId: 'm1' });
});
```

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `pnpm --filter @cultuvilla/shared test -- commentsService`
Expected: FAIL (recordEntityView undefined; removed fns still referenced elsewhere compile-fail).

- [ ] **Step 3: Delete both `reactionConverter.*` files.** Remove their imports and the
  `reactionsCollection` / `reactionDoc` factories (client + admin refs) — including the
  `// ── Comments + reactions …` comment, retitle to `// ── Comments (…)`.

- [ ] **Step 4: Edit `commentsService.ts`.** Remove `reactToEntity`, `removeReaction`,
  `getMyReaction`, `ReactToEntityInput`, the `reactionDoc` import, and the
  `buildReactionData`/`reactionDocId`/`ReactionKind` imports. Add:

```ts
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from '../firebase';

export interface RecordEntityViewInput {
  entityKind: EntityKind;
  entityId: string;
  municipalityId: string;
}

export async function recordEntityView(input: RecordEntityViewInput): Promise<void> {
  const fn = httpsCallable(getFunctions(getApp(), 'us-central1'), 'recordEntityView');
  await fn(input);
}
```

  (Match the existing callable-invocation pattern in the codebase — check another service
  that calls a callable for the exact `getFunctions`/region seam and reuse it.)

- [ ] **Step 5: Run tests to confirm they pass.**

Run: `pnpm --filter @cultuvilla/shared test -- commentsService`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add packages/shared/src/firebase packages/shared/src/services packages/shared/test
git commit -m "refactor(shared): remove reaction refs/converters/service, add recordEntityView"
```

---

### Task 3: Cloud Function — remove reaction sync, add `recordEntityView` callable

**Files:**
- Modify: `functions/src/interaction/syncEntityInteractionCounts.ts`
- Create: `functions/src/interaction/recordEntityView.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/src/__tests__/handlers/interaction/syncEntityInteractionCounts.test.ts`
- Create test: `functions/src/__tests__/handlers/interaction/recordEntityView.test.ts`

**Interfaces:**
- Consumes: `applyToParent(entityKind, entityId, municipalityId, field, value, ...more)`
  from `syncEntityInteractionCounts.ts` — export it so `recordEntityView.ts` can reuse it.
- Produces: `recordEntityView` v2 `onCall` handler incrementing `readCount` by 1 on the
  parent entity; `syncEntityReactionCounts` removed.

- [ ] **Step 1: Write the callable test (RED).** `recordEntityView.test.ts`:

```ts
import { recordEntityView } from '../../../interaction/recordEntityView';
// use the repo's callable test harness (see an existing onCall test for wrapping)

it('increments readCount on the parent event', async () => {
  // seed an event doc with readCount: 0
  await recordEntityViewWrapped({ data: { entityKind: 'event', entityId: 'e1', municipalityId: 'm1' } });
  // assert event doc readCount === 1
});

it('no-ops when the parent is missing', async () => {
  await expect(
    recordEntityViewWrapped({ data: { entityKind: 'event', entityId: 'missing', municipalityId: 'm1' } }),
  ).resolves.not.toThrow();
});
```

  Also edit `syncEntityInteractionCounts.test.ts`: delete every `syncEntityReactionCounts`
  test block; keep `syncEntityCommentCount`.

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `pnpm test:functions -- interaction`
Expected: FAIL (recordEntityView missing; reaction tests reference removed export).

- [ ] **Step 3: Edit `syncEntityInteractionCounts.ts`.** Add `export` to `applyToParent`
  (and `ApplyResult`, `isNotFound` if needed). Delete the entire `syncEntityReactionCounts`
  export. Keep `syncEntityCommentCount`.

- [ ] **Step 4: Create `recordEntityView.ts`.**

```ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { applyToParent } from './syncEntityInteractionCounts';

const db = getFirestore();

export const recordEntityView = onCall({ region: 'us-central1' }, async (request) => {
  const { entityKind, entityId, municipalityId } = (request.data ?? {}) as {
    entityKind?: string; entityId?: string; municipalityId?: string;
  };
  if (!entityKind || !entityId || !municipalityId) {
    throw new HttpsError('invalid-argument', 'entityKind, entityId, municipalityId required');
  }
  const result = await applyToParent(
    entityKind, entityId, municipalityId, 'readCount', FieldValue.increment(1),
  );
  if (result === 'unknown-kind') {
    throw new HttpsError('invalid-argument', `unknown entityKind: ${entityKind}`);
  }
  if (result === 'applied') {
    logger.info('entity view recorded', { handler: 'recordEntityView', entityKind, entityId });
  }
  return { ok: true };
});
```

  Note: `applyToParent` uses a shared `db` in its module; confirm `recordEntityView.ts`
  does not create a conflicting second `getFirestore()` init problem (importing the fn is
  enough — remove the local `db` here if unused).

- [ ] **Step 5: Wire the export in `functions/src/index.ts`.** Replace
  `export { syncEntityCommentCount, syncEntityReactionCounts } from './interaction/syncEntityInteractionCounts';`
  with:

```ts
export { syncEntityCommentCount } from './interaction/syncEntityInteractionCounts';
export { recordEntityView } from './interaction/recordEntityView';
```

- [ ] **Step 6: Run tests to confirm they pass.**

Run: `pnpm test:functions -- interaction`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add functions/src
git commit -m "feat(functions): add recordEntityView callable, remove reaction count sync"
```

---

### Task 4: Firestore rules

**Files:**
- Modify: `firestore.rules`
- Test: `packages/shared/test/e2e/interactionRules.test.ts`, and the per-entity rules
  e2e specs that assert `reactionCounts` (`festivalPosterRules`, `newsRules`,
  `eventOrglessRules`, `eventOrganizerUserRules`, `placeProposalRules`,
  `barrioProposalRules`, `shapeRules`, `rulesShapeContract`)

**Interfaces:**
- Produces: no `/reactions/{reactionId}` collection rules; every entity create requires
  `readCount == 0` and forbids client writes to `readCount` / `commentCount`; no
  `reactionCounts` anywhere.

- [ ] **Step 1: Update rules tests (RED).** In `interactionRules.test.ts` delete the
  `reactions` describe block; add assertions that a client cannot create an entity with
  `readCount != 0`, cannot mutate `readCount`, and that a doc with `readCount: 0` +
  no `reactionCounts` is accepted. In each per-entity spec, replace `reactionCounts:{like:0,heart:0}`
  in fixture docs with `readCount: 0` and drop `reactionCounts` from `affectedKeys`
  immutability assertions (use `readCount` there instead). Update `rulesShapeContract.test.ts`
  / `shapeRules.test.ts` field lists.

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `pnpm test:rules -- interactionRules`
Expected: FAIL.

- [ ] **Step 3: Edit `firestore.rules`.**
  - Delete the `isValidReactionCounts(...)` helper.
  - In every entity block (event, news, org, festivalPoster, place, barrio): remove
    `reactionCounts` from the allowed-keys lists, remove `&& isValidReactionCounts(d.reactionCounts)`
    and `&& d.reactionCounts.like == 0 && d.reactionCounts.heart == 0` on create; add
    `&& d.readCount == 0`. In the function-owned/immutable lists (the `affectedKeys().hasAny([...])`
    guards and setContentVisibility notes), replace `'reactionCounts'` with `'readCount'`
    (keep `'commentCount'`).
  - Delete the whole `match /reactions/{reactionId} { … }` block.

- [ ] **Step 4: Run tests to confirm they pass.**

Run: `pnpm test:rules -- interactionRules && pnpm test:rules`
Expected: PASS (run the full rules suite to catch the per-entity specs).

- [ ] **Step 5: Commit.**

```bash
git add firestore.rules packages/shared/test/e2e
git commit -m "refactor(rules): drop reactions + reactionCounts, gate readCount as function-owned"
```

---

### Task 5: Mobile UI — comments, cards, detail screens, i18n

**Files:**
- Delete: `apps/mobile/components/feature/ReactionBar.tsx`, `ReactionBar.test.tsx`
- Modify: `apps/mobile/components/feature/EntityComments.tsx`, `EntityComments.test.tsx`
- Modify: `apps/mobile/components/feature/FeedCard.tsx`
- Modify: detail screens: `app/event/[eventId].tsx`, `app/news/[newsId].tsx`,
  `app/o/[orgId]/index.tsx`, `app/village/[villageId]/festival-poster/[posterId].tsx`,
  `app/village/[villageId]/place/[placeId].tsx`, `app/village/[villageId]/barrio/[barrioId].tsx`
- Modify: `packages/i18n/messages/es.json`
- Modify: `apps/mobile/e2e/flows/entity-comments.spec.ts`

**Interfaces:**
- Consumes: `recordEntityView` from `@cultuvilla/shared/services/commentsService`.
- Produces: `EntityComments` prop type drops `initialReactionCounts`.

- [ ] **Step 1: Update component tests (RED).** In `EntityComments.test.tsx`, remove the
  `initialReactionCounts` prop from render calls, delete reaction-bar assertions, and add
  `expect(queryByTestId('reaction-like')).toBeNull()`. Remove the empty-string assertion
  (or assert the empty string is NOT rendered). In `entity-comments.spec.ts`, delete the
  reaction-tap steps. Add/keep a FeedCard test asserting the comment count renders on the
  title row when `commentCount > 0` (testID `feed-card-comment-count`).

- [ ] **Step 2: Run tests to confirm they fail.**

Run: `pnpm app:test -- EntityComments`
Expected: FAIL.

- [ ] **Step 3: Delete `ReactionBar.tsx` + `ReactionBar.test.tsx`.**

- [ ] **Step 4: Edit `EntityComments.tsx`.** Remove the `ReactionBar` import + render,
  remove `initialReactionCounts` from `EntityCommentsProps` and the destructure. Change the
  empty branch to render nothing:

```tsx
{loading ? (
  <View className="items-center py-4"><ActivityIndicator /></View>
) : comments.length === 0 ? null : (
  <VStack gap={3}> … existing list … </VStack>
)}
```

- [ ] **Step 5: Edit `FeedCard.tsx`.** Move the comment-count block out of the meta row
  into the title row so title + count share one line:

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center' }}>
  <Text variant="h1" numberOfLines={1} style={{ color: '#ffffff', fontSize: 22, flex: 1 }}>
    {title}
  </Text>
  {commentCount && commentCount > 0 ? (
    <View
      testID="feed-card-comment-count"
      style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, flexShrink: 0 }}
    >
      <Ionicons name="chatbubble-outline" size={iconSizes.sm} color="rgba(255,255,255,0.85)" />
      <Text variant="body" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}>
        {commentCount}
      </Text>
    </View>
  ) : null}
</View>
```

  Then delete the `commentCount` block from the location/date `<View>` row (leave metaLeft/metaRight).

- [ ] **Step 6: Detail screens — remove `initialReactionCounts`, add view tracking.** In all
  six screens, delete the `initialReactionCounts={…reactionCounts}` prop line. Add a mount
  effect firing the view (fire-and-forget; use the entity's own id/municipalityId; guard for
  loaded data). Example (event screen):

```tsx
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
// …
useEffect(() => {
  if (!event) return;
  void recordEntityView({ entityKind: 'event', entityId: event.id, municipalityId: event.municipalityId });
}, [event?.id]);
```

  Use the correct `entityKind` per screen (`news`, `organization`, `festivalPoster`,
  `place`, `barrio`).

- [ ] **Step 7: Festival-poster reorder.** In `festival-poster/[posterId].tsx`, move the
  `images.slice(1)` block from `belowContent` into `children`, placed **before**
  `<EntityComments>`; drop the now-unused `belowContent` prop:

```tsx
{subtitle ? <Text tone="muted">{subtitle}</Text> : null}
{poster && poster.images.length > 1 ? (
  <VStack gap={2} className="pt-2">
    {poster.images.slice(1).map((uri) => <NaturalImage key={uri} uri={uri} />)}
  </VStack>
) : null}
{poster ? (
  <EntityComments key={poster.id} entityKind="festivalPoster" entityId={poster.id}
    municipalityId={poster.municipalityId} canModerate={canManage} />
) : null}
```

- [ ] **Step 8: i18n.** In `packages/i18n/messages/es.json`, remove `comments.reactionLike`,
  `comments.reactionHeart`, and `comments.empty` from the active `comments` block (line ~924).
  (Also check line ~849's nested `comments.empty` — remove only if unused after grep.)

- [ ] **Step 9: Run tests to confirm they pass.**

Run: `pnpm app:test && pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 10: Commit.**

```bash
git add apps/mobile packages/i18n
git commit -m "feat(mobile): remove reactions UI, track views, move comment count to title row"
```

---

### Task 6: Dev backfill + docs + full gate

**Files:**
- Create: `scripts/backfill-entity-readcount.mjs`
- Modify: `packages/shared/src/services/_services-map.md`
- Modify: `docs/architecture/denormalized-read-models.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write `scripts/backfill-entity-readcount.mjs`** (mirror
  `scripts/backfill-municipality-namelower.mjs`): guard `projectId === 'villa-events'`;
  for each top-level collection (`events`, `festivalPosters`, `news`, `organizations`) and
  each municipality subcollection (`places`, `barrios`), set `readCount: 0` where missing and
  `reactionCounts: FieldValue.delete()` where present; idempotent; log counts via structured logs.

- [ ] **Step 2: Run the backfill against dev.**

Run: `node scripts/backfill-entity-readcount.mjs`
Expected: patches stale docs; re-running reports 0 changes.

- [ ] **Step 3: Verify dev conformance.**

Run: `pnpm check:dev-conformance`
Expected: no nonconforming docs.

- [ ] **Step 4: Docs.** Add `readCount` (function-owned, written by `recordEntityView`) and
  remove `reactionCounts` in `_services-map.md` and `denormalized-read-models.md`. Note the
  change under `## [Unreleased]` in `CHANGELOG.md` (removed reactions; added invisible read count;
  feed comment-count moved to title row; poster comments always last).

- [ ] **Step 5: Full gate.**

Run: `pnpm check`
Expected: lint + typecheck + test + build all PASS.

- [ ] **Step 6: Commit.**

```bash
git add scripts packages/shared/src/services/_services-map.md docs CHANGELOG.md
git commit -m "chore: backfill readCount, drop reactionCounts, sync docs + changelog"
```

---

## Self-Review notes

- **Spec coverage:** reactions removal (T1–T5), readCount field (T1) + callable (T3) +
  client wrapper (T2) + mount firing (T5) + rules (T4), feed card (T5.5), poster order
  (T5.7), empty string (T5.8), backfill + docs (T6). All covered.
- **Type consistency:** `recordEntityView({ entityKind, entityId, municipalityId })` used
  identically in service (T2), callable (T3), and screens (T5). `applyToParent` exported in
  T3 and consumed by the new callable. `readCount` int on all schemas (T1) and asserted in
  rules/model tests.
- **Open confirmations for the executor:** exact callable-invocation seam (`getFunctions`
  region/app) — copy from an existing service that calls a callable rather than guessing;
  the functions callable test harness shape — copy from an existing `onCall` test.
