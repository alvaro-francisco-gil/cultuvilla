# Product-analytics instrumentation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand product-analytics event coverage from the 4 conversion points to full-engagement instrumentation (content views, search, org join/invite, inbox), so a behavioral dashboard can be built on the data.

**Architecture:** Every event goes through the existing observability *port* (`observability.trackEvent(name, params)`). New event names are registered in the single `OBSERVABILITY_EVENTS` taxonomy const; new context fields are added to the single `ALLOWED_CONTEXT_KEYS` PII allowlist. Call sites are one-liners mirroring the four existing ones. No adapter or transport changes — events flow to Firebase Analytics on web and are no-ops on native (web-first; native activation is out of scope here).

**Tech Stack:** TypeScript (strict), vitest (shared-package tests), Expo/React Native (mobile call sites), Firebase Analytics (web adapter, already wired).

**Parent design:** [../ideas/product-analytics-behavioral-dashboard.md](../ideas/product-analytics-behavioral-dashboard.md) — this plan is Phase 1 of that four-phase initiative. Phase 0 (enable GA4→BigQuery export) and Phases 2–3 (dashboard, ops) are separate and not covered here.

## Global Constraints

- **Event names live ONLY in `packages/shared/src/services/observability/observabilityEvents.ts`** — never inline a string at a call site. Names must match `/^[a-z]+(\.[a-z_]+){2}$/` (`<domain>.<action>.<outcome>`, lowercase) and be unique. Enforced by `packages/shared/test/services/observabilityEvents.test.ts`.
- **Any context key an event emits MUST be in `ALLOWED_CONTEXT_KEYS`** (`packages/shared/src/services/observability/observabilityService.ts`) or `filterContext` silently drops it. Existing keys: `uid, municipalityId, villageId, role, appVersion, platform, route, operation_id`.
- **No raw free-text in events.** Never log search query text, names, or user content. Log shape/counts (`resultCount`, `surface`), never the query itself — this preserves the foundation's structural-PII posture ([../../decisions/observability-foundation.md](../../decisions/observability-foundation.md)).
- **Consent + PII transforms stay at the boundary.** Call sites never hash/scrub; `trackEvent` is consent-gated in the port; the server chokepoint owns PII transforms. Call sites just pass allowlisted keys.
- **Mirror the existing call-site pattern:** import `{ observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared';`. For mutation events use the `let succeeded = false` flag so a post-write error doesn't double-count (see `VillageDiscovery.tsx:154/162`).
- **Every new event must be added to the `observability-conventions` skill's event list** in the same change (it is the review gate).
- **`strict: true`, no `any`.**

## Design decisions settled in this plan (override on review if you disagree)

- **D1 — One generic content-view event, not one per entity.** `content.detail.viewed` carries `entityKind` + `entityId`, so the dashboard breaks content performance down by kind and scales to new entity kinds without new event names. New allowlist keys: `entityKind`, `entityId` (a doc id and an enum — neither is PII).
- **D2 — Search logs shape, never text.** `search.query.submitted` carries `surface` + `resultCount` (no query string). Only the server-backed village-discovery search fires "submitted" (already debounced); the in-memory home-feed filter does NOT fire per-keystroke (noise). Both surfaces fire `search.result.selected` (`surface`) on a result tap. New allowlist keys: `surface`, `resultCount`.
- **D3 — Instrument org join + share (village invites were removed).** `org.join.success` / `org.join.error` on the `addOrgMember` mutation, and `org.invite.shared` on the org share action. `viaInvite` (boolean) distinguishes invite-arrival from direct-FAB join. New allowlist key: `viaInvite`.
- **D4 — Inbox open, not per-notification tap.** `inbox.open.viewed` fires from the existing inbox mount effect, carrying `unreadCount`. Per-notification tap is deliberately deferred: `NotificationRow` has no `onPress` today, so adding one is a behavior change, not instrumentation (YAGNI). New allowlist key: `unreadCount`.
- **D5 — Native stays a no-op.** New events compile and run on native but emit nothing until `@react-native-firebase/analytics` is wired at native release. That activation is out of scope for Phase 1 (web-first).

## File Structure

- **Modify:** `packages/shared/src/services/observability/observabilityEvents.ts` — add 7 event names.
- **Modify:** `packages/shared/src/services/observability/observabilityService.ts` — add 6 keys to `ALLOWED_CONTEXT_KEYS`.
- **Modify:** `packages/shared/test/services/observabilityService.test.ts` — assert new keys pass through `filterContext`.
- **Modify (mobile call sites, one-liners):**
  - `apps/mobile/app/event/[eventId].tsx` (content view)
  - `apps/mobile/app/news/[newsId].tsx` (content view)
  - `apps/mobile/app/village/[villageId]/place/[placeId].tsx` (content view)
  - `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx` (content view)
  - `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx` (content view)
  - `apps/mobile/app/o/[orgId]/index.tsx` (content view + org join + invite share)
  - `apps/mobile/components/feature/VillageDiscovery.tsx` (search submitted + result selected)
  - `apps/mobile/app/(tabs)/index.tsx` (home-feed search result selected)
  - `apps/mobile/app/inbox/index.tsx` (inbox open)
- **Modify (docs/gate):** `.claude/skills/observability-conventions/SKILL.md` — extend the event list.

**Testability note:** Only Task 1 (shared taxonomy + allowlist) has extractable logic and gets full TDD. The mobile call sites (Tasks 2–6) are UI-only one-liners with no extractable unit; they match the four existing call sites which are also unit-untested. They are verified by `pnpm app:typecheck` + the taxonomy test (name exists & valid) + a manual web smoke against Firebase Analytics DebugView. This is the "genuinely untestable UI, stated explicitly" carve-out from AGENTS.md step 4.

---

### Task 1: Extend the event taxonomy and PII allowlist

**Files:**
- Modify: `packages/shared/src/services/observability/observabilityEvents.ts`
- Modify: `packages/shared/src/services/observability/observabilityService.ts:30-39`
- Test: `packages/shared/test/services/observabilityService.test.ts`

**Interfaces:**
- Produces: new members on `OBSERVABILITY_EVENTS` — `CONTENT_DETAIL_VIEWED = 'content.detail.viewed'`, `SEARCH_QUERY_SUBMITTED = 'search.query.submitted'`, `SEARCH_RESULT_SELECTED = 'search.result.selected'`, `ORG_INVITE_SHARED = 'org.invite.shared'`, `ORG_JOIN_SUCCESS = 'org.join.success'`, `ORG_JOIN_ERROR = 'org.join.error'`, `INBOX_OPEN_VIEWED = 'inbox.open.viewed'`.
- Produces: `ALLOWED_CONTEXT_KEYS` additionally contains `entityKind, entityId, surface, resultCount, viaInvite, unreadCount`.

- [ ] **Step 1: Write the failing test** — assert the new allowlist keys survive `filterContext`. Append to `packages/shared/test/services/observabilityService.test.ts` inside the existing `describe('observability port', ...)`:

```ts
it('forwards the new engagement keys through filterContext', () => {
  observability.trackEvent(OBSERVABILITY_EVENTS.CONTENT_DETAIL_VIEWED, {
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: 'm1',
    surface: 'village_discovery',
    resultCount: 3,
    viaInvite: true,
    unreadCount: 5,
    leaked: 'nope',
  });
  const [, params] = adapter.calls.trackEvent[0];
  expect(params).toEqual({
    entityKind: 'event',
    entityId: 'e1',
    municipalityId: 'm1',
    surface: 'village_discovery',
    resultCount: 3,
    viaInvite: true,
    unreadCount: 5,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- observabilityService`
Expected: FAIL — `leaked` correctly dropped, but the new keys are also dropped (allowlist doesn't include them yet), so `params` is missing `entityKind`/`entityId`/`surface`/`resultCount`/`viaInvite`/`unreadCount`.

- [ ] **Step 3: Add the event names.** In `observabilityEvents.ts`, add inside the `OBSERVABILITY_EVENTS` object (before the closing `} as const;`):

```ts
  CONTENT_DETAIL_VIEWED: 'content.detail.viewed',
  SEARCH_QUERY_SUBMITTED: 'search.query.submitted',
  SEARCH_RESULT_SELECTED: 'search.result.selected',
  ORG_INVITE_SHARED: 'org.invite.shared',
  ORG_JOIN_SUCCESS: 'org.join.success',
  ORG_JOIN_ERROR: 'org.join.error',
  INBOX_OPEN_VIEWED: 'inbox.open.viewed',
```

- [ ] **Step 4: Add the allowlist keys.** In `observabilityService.ts`, extend `ALLOWED_CONTEXT_KEYS` (keep it `as const`):

```ts
export const ALLOWED_CONTEXT_KEYS = [
  'uid',
  'municipalityId',
  'villageId',
  'role',
  'appVersion',
  'platform',
  'route',
  'operation_id',
  'entityKind',
  'entityId',
  'surface',
  'resultCount',
  'viaInvite',
  'unreadCount',
] as const;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- observabilityService && pnpm --filter @cultuvilla/shared test -- observabilityEvents`
Expected: PASS. The taxonomy test confirms all 7 new names match `/^[a-z]+(\.[a-z_]+){2}$/` and are unique; the new filter test passes.

- [ ] **Step 6: Update the review gate.** In `.claude/skills/observability-conventions/SKILL.md`, add the 7 new events to the documented event list and note the 6 new allowlist keys (with the "no raw query text" rationale for `search.*`).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/services/observability/ packages/shared/test/services/observabilityService.test.ts .claude/skills/observability-conventions/SKILL.md
git commit -m "feat(observability): add engagement event taxonomy and allowlist keys"
```

---

### Task 2: Content-view instrumentation on entity detail screens

**Files (all Modify):**
- `apps/mobile/app/event/[eventId].tsx` (~line 70, inside the `recordEntityView` effect)
- `apps/mobile/app/news/[newsId].tsx` (~line 71)
- `apps/mobile/app/village/[villageId]/place/[placeId].tsx` (~line 56)
- `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx` (~line 58)
- `apps/mobile/app/village/[villageId]/festival-poster/[posterId].tsx` (~line 41)
- `apps/mobile/app/o/[orgId]/index.tsx` (~line 60)

**Interfaces:**
- Consumes: `OBSERVABILITY_EVENTS.CONTENT_DETAIL_VIEWED`, allowlist keys `entityKind`, `entityId`, `municipalityId` (from Task 1).

- [ ] **Step 1: Add the import (each file that lacks it).** At the top of each screen, ensure:

```ts
import { observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared';
```

(Several of these screens already import from `@cultuvilla/shared`; add the two names to the existing import rather than a second import line.)

- [ ] **Step 2: Fire the event inside the existing `recordEntityView` effect.** In each screen, next to the existing `void recordEntityView({ entityKind, entityId, municipalityId })` call, add a `trackEvent` with the same identifiers. Example for `event/[eventId].tsx` (adapt `entityKind` and the doc variable per file — `event`→`event`, `news`→`post`, `place`→`place`, `barrio`→`barrio`, `festivalPoster`→`poster`, `organization`→`org`):

```ts
useEffect(() => {
  if (!event?.id) return;
  void recordEntityView({ entityKind: 'event', entityId: event.id, municipalityId: event.municipalityId });
  observability.trackEvent(OBSERVABILITY_EVENTS.CONTENT_DETAIL_VIEWED, {
    entityKind: 'event',
    entityId: event.id,
    municipalityId: event.municipalityId,
  });
}, [event?.id]);
```

`entityKind` values must be from the `EntityKind` union (`apps/mobile/lib/entities/registry.ts`): `'event' | 'festivalPoster' | 'place' | 'barrio' | 'organization' | 'news'`.

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS (no missing-field or wrong-key errors).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/event apps/mobile/app/news apps/mobile/app/village apps/mobile/app/o
git commit -m "feat(observability): track content.detail.viewed on entity detail screens"
```

---

### Task 3: Search instrumentation

**Files (all Modify):**
- `apps/mobile/components/feature/VillageDiscovery.tsx` (submitted at the debounced fetch ~line 80; selected in `viewMuni` ~line 130)
- `apps/mobile/app/(tabs)/index.tsx` (result selected — where a filtered event/news row is tapped)

**Interfaces:**
- Consumes: `OBSERVABILITY_EVENTS.SEARCH_QUERY_SUBMITTED`, `OBSERVABILITY_EVENTS.SEARCH_RESULT_SELECTED`, keys `surface`, `resultCount` (from Task 1).

- [ ] **Step 1: VillageDiscovery — fire `search.query.submitted` after the debounced server search resolves.** In the existing debounced `useEffect` on `[search]` that calls `listMunicipalitiesPage`, after results are set, add (guard on a non-empty query so an empty box doesn't emit):

```ts
if (search.trim().length >= 2) {
  observability.trackEvent(OBSERVABILITY_EVENTS.SEARCH_QUERY_SUBMITTED, {
    surface: 'village_discovery',
    resultCount: results.length,
  });
}
```

(Use the actual results variable name assigned from `listMunicipalitiesPage`.)

- [ ] **Step 2: VillageDiscovery — fire `search.result.selected` in `viewMuni`.** At the top of `viewMuni`:

```ts
observability.trackEvent(OBSERVABILITY_EVENTS.SEARCH_RESULT_SELECTED, { surface: 'village_discovery' });
```

- [ ] **Step 3: Home feed — fire `search.result.selected` when a filtered result is tapped.** In `app/(tabs)/index.tsx`, only when `search.trim()` is non-empty at the moment of the tap, add to the event/news row `onPress` (before the `router.push`):

```ts
if (search.trim().length > 0) {
  observability.trackEvent(OBSERVABILITY_EVENTS.SEARCH_RESULT_SELECTED, { surface: 'home_feed' });
}
```

- [ ] **Step 4: Confirm the import** `import { observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared';` exists in both files (add the names to the existing shared import).

- [ ] **Step 5: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/VillageDiscovery.tsx apps/mobile/app/\(tabs\)/index.tsx
git commit -m "feat(observability): track search submit and result selection"
```

---

### Task 4: Org join + invite-share instrumentation

**Files (Modify):**
- `apps/mobile/app/o/[orgId]/index.tsx` (share action ~line 89; `onJoin` mutation ~lines 63-76, `addOrgMember` at ~71; `arrivedViaInvite` at ~line 29)

**Interfaces:**
- Consumes: `OBSERVABILITY_EVENTS.ORG_INVITE_SHARED`, `ORG_JOIN_SUCCESS`, `ORG_JOIN_ERROR`, keys `municipalityId`, `viaInvite` (from Task 1).

- [ ] **Step 1: Fire `org.invite.shared` on the share action.** In the share `onPress` (the one calling `share(getOrgViewLink(org.id), org.name)`), add before/after the `share(...)` call:

```ts
observability.trackEvent(OBSERVABILITY_EVENTS.ORG_INVITE_SHARED, { municipalityId: org.municipalityId });
```

- [ ] **Step 2: Instrument `onJoin` with the success/error pattern.** Rewrite the `onJoin` body around `addOrgMember` to mirror the `let succeeded = false` idiom:

```ts
let succeeded = false;
try {
  await addOrgMember(orgId, user.uid);
  succeeded = true;
  observability.trackEvent(OBSERVABILITY_EVENTS.ORG_JOIN_SUCCESS, {
    municipalityId: org.municipalityId,
    viaInvite: arrivedViaInvite,
  });
  // ...existing post-join navigation/state...
} catch (e) {
  if (!succeeded) {
    observability.trackEvent(OBSERVABILITY_EVENTS.ORG_JOIN_ERROR, {
      municipalityId: org.municipalityId,
      viaInvite: arrivedViaInvite,
    });
  }
  throw e; // preserve existing error handling
}
```

(Keep whatever the existing `onJoin` did on success/failure — only add the three lines and the flag.)

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/o/\[orgId\]/index.tsx
git commit -m "feat(observability): track org join outcome and invite share"
```

---

### Task 5: Inbox-open instrumentation

**Files (Modify):**
- `apps/mobile/app/inbox/index.tsx` (the `useEffect` on `[user]` that calls `getNotifications` ~line 161 and `markAllAsRead` ~line 195)

**Interfaces:**
- Consumes: `OBSERVABILITY_EVENTS.INBOX_OPEN_VIEWED`, key `unreadCount` (from Task 1).

- [ ] **Step 1: Fire `inbox.open.viewed` once per inbox load, with the unread count computed before `markAllAsRead`.** Inside the activity effect, after `getNotifications(user.uid)` returns `notifications` and before `markAllAsRead`:

```ts
observability.trackEvent(OBSERVABILITY_EVENTS.INBOX_OPEN_VIEWED, {
  unreadCount: notifications.filter((n) => !n.read).length,
});
```

(Use the actual variable name returned by `getNotifications`; the `read` field is on `NotificationDataModel`.)

- [ ] **Step 2: Confirm the import** `import { observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared';` in `inbox/index.tsx`.

- [ ] **Step 3: Typecheck**

Run: `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/inbox/index.tsx
git commit -m "feat(observability): track inbox.open.viewed with unread count"
```

---

### Task 6: Manual verification + CHANGELOG

**Files (Modify):**
- `CHANGELOG.md` (under `## [Unreleased]`)

- [ ] **Step 1: Run the full shared gate.**

Run: `pnpm --filter @cultuvilla/shared test && pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 2: Web smoke against Firebase Analytics DebugView.** Since native is a no-op (D5), verify on the web build: with analytics consent granted, open an entity detail, run a village-discovery search and tap a result, join an org, and open the inbox. Confirm each event appears in Firebase Analytics DebugView with only allowlisted params (no query text, no PII). (Requires the user to run the Expo web dev server — Claude does not start long-lived servers; ask the user to drive this step and report what DebugView shows.)

- [ ] **Step 3: Note the change in CHANGELOG.** Under `## [Unreleased]`:

```markdown
### Added
- Product-analytics engagement events: content-detail views, search submit/select, org join & invite share, and inbox open — feeding the behavioral-dashboard initiative (Phase 1).
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note engagement analytics instrumentation"
```

---

## Self-review

- **Spec coverage:** Design "full-engagement" surfaces (content views, search, invites, notifications) → Tasks 2/3/4/5. Taxonomy-as-enriched-const + allowlist → Task 1. Native deferral → D5 (no code). BigQuery/dashboard/ops → out of scope (Phases 0/2/3, parent doc). The parent design's "generated event dictionary" is intentionally deferred: it's only worth building once the const carries per-event metadata objects; this plan keeps the const as flat name→string to stay a minimal, mergeable slice. Flagged here so it isn't lost.
- **Placeholder scan:** none — every code step shows real code; variable-name adaptations are called out explicitly per file.
- **Type consistency:** `CONTENT_DETAIL_VIEWED` and the 6 other names are defined in Task 1 and consumed by the same identifiers in Tasks 2–5; `entityKind` values are constrained to the `EntityKind` union; all emitted keys are added to `ALLOWED_CONTEXT_KEYS` in Task 1.
- **Known scope cut:** per-notification tap (D4) and home-feed "search submitted" (D2) are deliberately excluded and documented as such.
