# Unified inbox (Buzón) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold Solicitudes and notifications into a single "Buzón" screen — one feed where actionable requests pin to the top with inline approve/reject and everything else reads below — reached from the header bell with an unread badge.

**Architecture:** No storage-layer merge. The screen renders one list fed by two sources kept separate underneath: **live request queries** (today's Recibidas logic, role-branched) produce *actionable* items; the **notification log** plus the user's own still-pending sent requests produce read-only *activity* items. A pure `buildActivityFeed` combiner in `@cultuvilla/shared` sorts/merges the activity source and is unit-tested; actionable items stay as live queries. Backend: a new `onOrganizationUpdated` Firestore trigger emits the currently-dead `org_approved`/`org_rejected` types uniformly for both the approve callable and the client-write reject; the redundant approver-side `*_request_created` writes are dropped.

**Tech Stack:** Expo SDK 56 / Expo Router / NativeWind v4 / React Native (apps/mobile); Firebase Cloud Functions v2 (functions); Zod-backed models + services (packages/shared); vitest (shared), jest (mobile), functions vitest emulator harness.

## Status

- **Updated:** 2026-07-09
- **Stage:** Stage A, Task 1 — `onOrganizationUpdated` trigger (about to start)
- **Branch:** cultuvilla `feat/unified-inbox` (worktree `.claude/worktrees/unified-inbox`, based on `origin/develop` @ 0122a14)
- **Done:** brainstorm + plan (this doc); worktree set up, deps installed, shared built, baseline typecheck green
- **Next:** implement Task 1 (Stage A) via subagent-driven-development
- **Blockers:** none. Note: cannot boot Firebase emulators (AGENTS.md) — emulator-backed test steps must be handed to the user to run.
- **Handoff:** fresh worktree requires `pnpm --filter @cultuvilla/shared build` before `functions` typecheck passes (functions resolves `@cultuvilla/shared` via `dist/`). Re-run after shared model changes. Do not run `pnpm test`/`test:functions` yourself (boots emulators).

## Global Constraints

- **Service-layer ownership:** screens/components/hooks must not import `firebase/*`; all Firestore access goes through `packages/shared/src/services/`. (AGENTS.md §1)
- **Strict TS, no `any`.** `unknown` + narrow at boundaries. (AGENTS.md §5)
- **Cloud Functions logging:** no `console.*`; use `logger.info(msg, { handler, ... })`. (AGENTS.md)
- **i18n:** user-facing strings go through `useT()`; add keys to `packages/i18n/messages/es.json`. No hardcoded Spanish in the mobile app.
- **Web parity:** the bell/badge and feed must work on the Firebase Hosting web build. No `Alert.alert` (no-op on RN-Web) — use the `Modal` error pattern already in the Solicitudes screen. Don't put styles on `className` for `Animated.*`. (mobile-web-compat)
- **Delete > deprecate:** remove the old Solicitudes route, its i18n `outbox`/tab keys, and the dropped notification writers outright — no shims. (AGENTS.md)
- **Backfill not required:** no model field is added or tightened (the two "dead" enum values already exist in the schema), so no dev backfill is needed.

## Resolved decisions (were open questions)

- **Mark-as-read:** mark-all-on-open for v1 (`markAllAsRead` when the Buzón mounts). Per-item-on-scroll deferred.
- **Badge count:** per-launch query at current scale — `getUnreadCount` (unread notifications) + a count of pending-actionable items from the same role-branched queries the feed already runs. No denormalized counter yet; revisit if read cost bites.
- **Entry point:** header bell only. The `UserMenuModal` "Solicitudes" item is **removed** (delete > deprecate).
- **Screen name:** **Buzón** (i18n key `inbox.*`, replacing `solicitudes.*`).
- **Sent-pending requests:** shown as read-only "esperando aprobación" activity lines (preserves what Enviadas answered without a tab).

## File Structure

**Create:**
- `functions/src/organizations/notificationTriggers.ts` — `onOrganizationUpdated` trigger: emits `org_approved`/`org_rejected` to `requestedBy` on `pending → approved|rejected`.
- `functions/src/__tests__/handlers/onOrganizationUpdated.test.ts` — trigger handler test.
- `packages/shared/src/services/inboxService.ts` — `buildActivityFeed(...)` pure combiner + `ActivityItem`/`InboxFeed` types + an `getMyPendingRequests(uid)` aggregator.
- `packages/shared/test/inboxService.test.ts` — vitest for `buildActivityFeed` sort/merge.
- `apps/mobile/app/inbox/index.tsx` — the Buzón screen (replaces `solicitudes/index.tsx`).
- `apps/mobile/components/feature/NotificationRow.tsx` — read-only activity row.
- `apps/mobile/lib/hooks/useUnreadInboxCount.ts` — badge count hook.

**Modify:**
- `functions/src/index.ts` — export `onOrganizationUpdated`.
- `functions/src/village/requestOrganizeVillage.ts` — drop `notifyOrganizerRequestCreated` call.
- `functions/src/organizations/requestJoinOrganization.ts` — drop `notifyJoinRequestCreated` call.
- `functions/src/helpers/notifyRequests.ts` — delete `notifyOrganizerRequestCreated` + `notifyJoinRequestCreated`.
- `functions/src/__tests__/handlers/*` — update request-flow tests that asserted the dropped writes.
- `apps/mobile/components/layout/AppHeader.tsx` — wire the bell `onPress` to `router.push('/inbox')`; add badge.
- `packages/shared/src/services/index.ts` — export `inboxService`.
- `packages/shared/src/services/_services-map.md` — document `inboxService`.
- `apps/mobile/components/feature/UserMenuModal.tsx` — remove the Solicitudes menu item.
- `packages/i18n/messages/es.json` — add `inbox.*`; remove obsolete `solicitudes.*` keys not reused.
- `CHANGELOG.md` — note under `[Unreleased]`.

**Delete:**
- `apps/mobile/app/solicitudes/index.tsx` (superseded by `app/inbox/index.tsx`).

## Model / interface reference (verified against current code)

```ts
// packages/shared/src/models/notification — already exists
type NotificationType =
  | 'waitlist_promoted' | 'event_cancelled' | 'event_updated'
  | 'org_approved' | 'org_rejected'
  | 'join_request_created' | 'join_request_approved' | 'join_request_rejected'
  | 'organizer_request_created' | 'organizer_request_approved' | 'organizer_request_rejected';
interface NotificationData {
  type: NotificationType; title: string; body: string;
  eventId: string | null; municipalityId: string | null; requesterUid: string | null;
  read: boolean; createdAt: Date;
}

// notificationService (exists): getNotifications(uid, max=50), getUnreadCount(uid),
//   createNotification(uid, input), markAsRead(uid, id), markAllAsRead(uid)
```

New shared types this plan introduces:

```ts
// packages/shared/src/services/inboxService.ts
export type ActivityItem =
  | { kind: 'notification'; id: string; notification: NotificationData & { id: string } }
  | { kind: 'pending-sent'; id: string; requestType: 'organizer' | 'org' | 'join';
      label: string; createdAt: Date };

export interface InboxFeed { activity: ActivityItem[]; } // actionable stays in the screen

export function buildActivityFeed(
  notifications: (NotificationData & { id: string })[],
  pendingSent: { requestType: 'organizer' | 'org' | 'join'; id: string; label: string; createdAt: Date }[],
): ActivityItem[];  // merged, sorted by createdAt desc
```

---

## Stage A — Backend notification correctness

### Task 1: `onOrganizationUpdated` trigger emits `org_approved` / `org_rejected`

**Files:**
- Create: `functions/src/organizations/notificationTriggers.ts`
- Create: `functions/src/__tests__/handlers/onOrganizationUpdated.test.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `userNotificationsCollection(db, uid)` (admin ref), `buildNotificationData` — both already used by `functions/src/events/notificationTriggers.ts`.
- Produces: exported `onOrganizationUpdated` Firestore trigger.

- [ ] **Step 1: Write the failing handler test.** Mirror `functions/src/__tests__/handlers/` style. Assert: a `pending → approved` update writes one `org_approved` notification to `requestedBy`; `pending → rejected` writes one `org_rejected`; any other transition (e.g. `approved → approved`, field edits) writes nothing; missing `requestedBy` writes nothing.
- [ ] **Step 2: Run it, verify it fails** (`onOrganizationUpdated` undefined). Use the repo's functions test command under emulators — do NOT boot emulators yourself; if you can't run it, state so and hand the command to the user.
- [ ] **Step 3: Implement the trigger.** Mirror `events/notificationTriggers.ts` exactly (raw snapshot access, narrow casts, typed converter ref, plain-`Date` `createdAt`):

```ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { userNotificationsCollection } from '@cultuvilla/shared/firebase/refs/admin';
import { buildNotificationData } from '@cultuvilla/shared/models';

const db = getFirestore();

// Fires for BOTH approval (callable) and rejection (client write) so the
// org_approved/org_rejected notifications land uniformly regardless of which
// path flipped the status. Snapshots are raw DocumentData (not converter-wrapped).
export const onOrganizationUpdated = onDocumentUpdated(
  'organizations/{orgId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const beforeStatus = before['status'] as string | undefined;
    const afterStatus = after['status'] as string | undefined;
    const requestedBy = after['requestedBy'] as string | undefined;
    const municipalityId = (after['municipalityId'] as string | undefined) ?? null;
    const orgName = (after['name'] as string | undefined) ?? '';
    if (!requestedBy) return;
    if (beforeStatus !== 'pending') return;

    let type: 'org_approved' | 'org_rejected';
    let title: string;
    let body: string;
    if (afterStatus === 'approved') {
      type = 'org_approved';
      title = 'Organización aprobada';
      body = `Tu organización "${orgName}" fue aprobada.`;
    } else if (afterStatus === 'rejected') {
      type = 'org_rejected';
      title = 'Organización rechazada';
      body = `Tu organización "${orgName}" fue rechazada.`;
    } else {
      return;
    }

    const ref = userNotificationsCollection(db, requestedBy).doc();
    await ref.set(buildNotificationData({ type, title, body, municipalityId }));
  },
);
```

- [ ] **Step 4: Export it** — add `export { onOrganizationUpdated } from './organizations/notificationTriggers';` to `functions/src/index.ts` (match the existing `onEventUpdated` export style).
- [ ] **Step 5: Run the test, verify it passes.**
- [ ] **Step 6: Commit** — `feat(functions): emit org_approved/org_rejected on org status change`.

### Task 2: Drop the redundant approver `*_request_created` notifications

**Files:**
- Modify: `functions/src/helpers/notifyRequests.ts` (delete `notifyOrganizerRequestCreated`, `notifyJoinRequestCreated`)
- Modify: `functions/src/village/requestOrganizeVillage.ts`, `functions/src/organizations/requestJoinOrganization.ts` (remove the calls)
- Modify: request-flow handler tests asserting those writes

**Interfaces:**
- Produces: `notifyRequests.ts` exporting only `notifyJoinRequestResolved`, `notifyOrganizerRequestResolved`.

- [ ] **Step 1: Update the failing tests first.** In the `requestOrganizeVillage` / `requestJoinOrganization` handler tests, change the assertion from "an approver notification was written" to "no `*_request_created` notification is written" (the actionable card is now the sole surface).
- [ ] **Step 2: Run, verify they fail.**
- [ ] **Step 3: Delete the two writers** from `notifyRequests.ts` and their call sites in the two callables. Also drop the now-unused `adminsCollection`/`organizationMembersCollection` imports in `notifyRequests.ts` if nothing else uses them.
- [ ] **Step 4: Grep** `rg "notifyOrganizerRequestCreated|notifyJoinRequestCreated" functions/` → expect no hits outside deleted lines.
- [ ] **Step 5: Run tests, verify pass.** (`organizer_request_created` / `join_request_created` remain valid enum values — leaving them in the schema is fine; they're simply no longer written.)
- [ ] **Step 6: Commit** — `refactor(functions): drop redundant approver request-created notifications`.

---

## Stage B — Shared inbox aggregator

### Task 3: `buildActivityFeed` combiner + `getMyPendingRequests`

**Files:**
- Create: `packages/shared/src/services/inboxService.ts`
- Create: `packages/shared/test/inboxService.test.ts`
- Modify: `packages/shared/src/services/index.ts`, `packages/shared/src/services/_services-map.md`

**Interfaces:**
- Consumes: `getNotifications` (notificationService); `getMyOrganizerRequests`, `getMyOrganizations`, `getMyJoinRequests` (existing services) for `getMyPendingRequests`.
- Produces: `buildActivityFeed`, `getMyPendingRequests`, types `ActivityItem` / `InboxFeed` (signatures in the reference block above).

- [ ] **Step 1: Write failing vitest** for `buildActivityFeed`: given 2 notifications and 1 pending-sent item with interleaved `createdAt`, it returns all 3 merged, sorted `createdAt` desc, each tagged with the right `kind`; empty inputs → `[]`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement `buildActivityFeed`** as a pure function (sort by `createdAt` desc; map to tagged `ActivityItem`s). Implement `getMyPendingRequests(uid)` to fetch the three "my requests" services, keep only `status === 'pending'`, and map to `{ requestType, id, label, createdAt }` (label from org/municipality name — reuse the screen's existing hydration approach, or pass names in from the caller to keep this service pure of extra reads; prefer returning ids + a separate name-resolution left to the screen).
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Export + document** in `index.ts` and `_services-map.md`.
- [ ] **Step 6: Commit** — `feat(shared): add inboxService activity-feed combiner`.

---

## Stage C — Mobile Buzón screen + entry point

### Task 4: `NotificationRow` presentational component

**Files:**
- Create: `apps/mobile/components/feature/NotificationRow.tsx`

**Interfaces:**
- Consumes: `NotificationData` type; primitives `VStack`/`Text`.
- Produces: `NotificationRow({ title, body, read, createdAt })` — read-only row; unread gets a subtle dot/emphasis; `createdAt` rendered via `formatRelativeTime` from `@cultuvilla/shared/utils/format`.

- [ ] **Step 1: Write a jest render test** asserting title/body render and an unread indicator shows when `read === false`.
- [ ] **Step 2–4:** implement to pass; use primitives + semantic Tailwind classes (`bg-surface`, `text-body`, `border-subtle`).
- [ ] **Step 5: Commit** — `feat(mobile): add NotificationRow`.

### Task 5: The Buzón screen (`app/inbox/index.tsx`)

**Files:**
- Create: `apps/mobile/app/inbox/index.tsx`
- Delete: `apps/mobile/app/solicitudes/index.tsx`
- Modify: `packages/i18n/messages/es.json`

**Interfaces:**
- Consumes: everything the current Solicitudes screen consumes for the actionable queries (`useApproverStatus`, the pending/respond services, name hydration), plus `getNotifications` + `markAllAsRead` (notificationService), `getMyPendingRequests` + `buildActivityFeed` (inboxService).
- Produces: default-exported `InboxScreen` at route `/inbox`.

- [ ] **Step 1: Build the actionable section** by lifting the *inbox* half of `solicitudes/index.tsx` verbatim (the role-branched `loadData`, the three `render*` request cards, `handleOrganizerDecide`/`handleOrgDecide`/`handleJoinDecide`, the `Modal` error pattern). Render it under an "Necesita tu acción" heading, pinned above the activity section. Keep the `onStartShouldSetResponder` web-click isolation and `testID`s.
- [ ] **Step 2: Build the activity section.** On mount: `getNotifications(uid)` + `getMyPendingRequests(uid)` → `buildActivityFeed(...)` → render `NotificationRow` for `kind:'notification'` and a muted "esperando aprobación" line for `kind:'pending-sent'`, under an "Actividad" heading. Then call `markAllAsRead(uid)`.
- [ ] **Step 3: Drop the `SegmentedToggle`** — one scroll view, two sections; no tabs. Empty state when both are empty.
- [ ] **Step 4: i18n** — add `inbox.title`, `inbox.needsAction`, `inbox.activity`, `inbox.empty`, `inbox.pendingSent.{organizer,org,join}`, reusing the existing `solicitudes.approve/reject/tab.*/orgRow/joinRow/motivation/wantsToAdminister` copy by moving those under `inbox.*`. Remove `solicitudes.tab.inbox/outbox`, `solicitudes.outbox.*`, `solicitudes.status.*` if unused after the move.
- [ ] **Step 5: Delete** `app/solicitudes/index.tsx`.
- [ ] **Step 6: Verify in-app** (ask the user to run web + AVD): admin sees actionable cards on top + activity below; non-admin sees only activity; approve/reject still works; opening clears the badge. See `verify` / `drive-android-avd`.
- [ ] **Step 7: Commit** — `feat(mobile): Buzón inbox screen replacing Solicitudes`.

### Task 6: Header bell → `/inbox` + unread badge

**Files:**
- Create: `apps/mobile/lib/hooks/useUnreadInboxCount.ts`
- Modify: `apps/mobile/components/layout/AppHeader.tsx`, `apps/mobile/components/feature/UserMenuModal.tsx`

**Interfaces:**
- Consumes: `getUnreadCount` (notificationService) + a pending-actionable count derived from the same role-branched queries (reuse via `useApproverStatus` + the pending getters).
- Produces: `useUnreadInboxCount(): { count: number; refresh: () => void }`.

- [ ] **Step 1:** implement `useUnreadInboxCount` — sum `getUnreadCount(uid)` + pending-actionable count; returns 0 for guests.
- [ ] **Step 2:** in `AppHeader`, replace the no-op bell `onPress` with `router.push('/inbox')`; overlay a badge (small `bg-accent`/`bg-danger` pill with the count, hidden when 0) on the existing `notifications` `Ionicons`. Badge is a plain `View` (no `Animated`) for web parity.
- [ ] **Step 3:** remove the "Solicitudes" item from `UserMenuModal`.
- [ ] **Step 4: Verify** the badge shows a count, clears after opening the Buzón (mark-all-read), and the menu no longer lists Solicitudes.
- [ ] **Step 5: Commit** — `feat(mobile): header bell opens Buzón with unread badge`.

---

## Stage D — Wrap-up

### Task 7: Docs + full check

- [ ] **Step 1:** `CHANGELOG.md` under `[Unreleased]`: note the unified Buzón, the bell/badge, and the notification correctness fixes.
- [ ] **Step 2:** confirm `_services-map.md` lists `inboxService`.
- [ ] **Step 3:** run `pnpm check` (lint + typecheck + test + build). Fix to green.
- [ ] **Step 4:** open PR targeting `develop` per AGENTS.md workflow (What / Why / Tests / Test plan).

---

## Self-review notes

- **Spec coverage:** one-feed + pinned-actionable (Task 5), bell+badge (Task 6), dead-type fix (Task 1), drop redundant notifs (Task 2), sent-pending-as-activity (Tasks 3+5) — all covered.
- **Web parity** called out in Tasks 5–6 (no `Alert`, badge is not `Animated`).
- **No backfill** needed — no model field added/tightened.
- **Deletions** (old route, menu item, dropped writers, obsolete i18n keys) are explicit per delete>deprecate.
