# Unified inbox (Buzón)

## Goal

Fold Solicitudes and notifications into a single "Buzón" — one chronological feed where actionable requests render with approve/reject buttons and everything else is read-only — and finally give notifications a user-facing surface (bell + unread badge).

## Context

Two adjacent features exist today, one of which has no UI:

- **Solicitudes** ([apps/mobile/app/solicitudes/index.tsx](../../../apps/mobile/app/solicitudes/index.tsx)) — reached from a `UserMenuModal` item, gated by [useApproverStatus](../../../apps/mobile/lib/auth/useApproverStatus.ts). A `SegmentedToggle` with two tabs:
  - **Recibidas** (inbox) — requests awaiting *my* decision; only populated when `canApprove`. Reads live source-of-truth docs (`organizerRequests`, pending `organizations`, join requests) and mutates them on approve/reject.
  - **Enviadas** (outbox) — requests *I* sent, each shown with its current status.
- **Notifications** — the **write/storage layer is real and in active use**, but the **consumption side is entirely unbuilt**: no route under `apps/mobile/app/**`, nothing imports `notificationService`, no bell, no badge.
  - Model: [NotificationDataModel.ts](../../../packages/shared/src/models/notification/NotificationDataModel.ts) with 11 types.
  - Service: [notificationService.ts](../../../packages/shared/src/services/notificationService.ts) — `getNotifications`, `getUnreadCount`, `createNotification`, `markAsRead`, `markAllAsRead`.
  - Writers (all server-side): [notifyRequests.ts](../../../functions/src/helpers/notifyRequests.ts), [notificationTriggers.ts](../../../functions/src/events/notificationTriggers.ts), [waitlistPromotion.ts](../../../functions/src/events/waitlistPromotion.ts).

**The key realization:** notifications already shadow the solicitudes flows. When a request is created, the approver gets both a pending doc (Recibidas) *and* a `*_request_created` notification; outcomes go to the requester as `*_approved`/`*_rejected`, mirroring the Enviadas status change. The two are **not the same data model** and should not be merged at the storage layer — Solicitudes reads *live, mutable* source-of-truth docs, notifications are an *append-only, immutable* event log. But they can and should converge at the **presentation layer**.

Two existing defects this surfaces:
- `org_approved` / `org_rejected` are **declared but never written** — `approveOrganization`/`rejectOrganization` create no notification, unlike the join/organizer flows.
- The approver-side `*_request_created` notification is redundant with Recibidas.

## Design / approach

### One screen, one feed, two sources

A single **Buzón** screen renders one list, fed by two sources merged at read time. The user never sees "two data models" — just one inbox. Sources stay separate underneath:

- **Actionable source** — live request queries (today's Recibidas logic, branched by approver role: super-admin / village-admin / org-admin). Each row renders inline **Aprobar / Rechazar**, mutating the real request doc.
- **Informational source** — the notification log (`getNotifications`), covering outcomes, event changes, waitlist promotions; plus the user's own **still-pending sent requests** rendered as read-only "esperando aprobación" lines (this preserves what Enviadas answered — "what am I waiting on?" — without a separate tab).

### Feed order: actionable pinned to top

Two visual groups, actionable always above informational so nothing needing a decision gets buried:

```
— Necesita tu acción —
[ Join request de Ana        [✓][✗] ]
[ Nueva peña: Los Toros      [✓][✗] ]
— Actividad —
  Tu solicitud fue aprobada
  Evento 'Feria' cancelado
  Tu solicitud a Los Toros está pendiente
```

Within each group, newest first. For a non-admin the actionable group is empty and the feed is pure activity.

### Entry point: header bell + unread badge

- A bell icon with an unread-count badge in the app header opens the Buzón.
- Badge count = unread informational items (`getUnreadCount`) + count of pending-actionable items.
- On viewing the feed, `markAllAsRead` (or per-item `markAsRead` on scroll-into-view — TBD in plan).

### Backend changes

- **Fix the dead types:** `approveOrganization` / `rejectOrganization` write `org_approved` / `org_rejected` notifications to the requester, matching the join/organizer flows.
- **Drop the redundant approver notification:** stop writing `*_request_created` to approvers (`notifyOrganizerRequestCreated`, `notifyJoinRequestCreated`). The actionable card in the feed is the sole surface for incoming requests, so there is no double row. (Requester-facing `*_resolved` notifications stay.)

### What is explicitly NOT changing

- No storage-layer merge. `organizerRequests`, pending `organizations`, join-request docs, and `users/{uid}/notifications` all keep their current shapes and queries. This is a UI/read-model convergence, not a data migration.
- `respondTo*` callables and the rules model are untouched except for the two notification writers above.

## Open questions

- **Mark-as-read semantics:** mark everything read on open (simple), or per-item as it scrolls into view (accurate, more work)? Leaning open-mark for v1.
- **Badge count for pending-actionable items:** counting live pending queues on every launch may cost reads. Do we need a cheap count (denormalized counter) or is per-launch query acceptable at current scale?
- **Web parity:** bell/badge and the feed must work on the Firebase Hosting web build — check `Animated`/`Modal`/`Alert` gotchas (see `mobile-web-compat`). The existing Solicitudes screen already avoids `Alert.alert` for this reason.
- **Do we keep the `UserMenuModal` "Solicitudes" entry** as a secondary path, or is the header bell the only entry point?
- **Naming:** "Buzón" vs "Notificaciones" vs "Avisos" for the screen title (i18n key).
