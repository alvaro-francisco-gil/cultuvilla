# Solicitudes — inbox + outbox for everyone

> Implementation plan. Builds on the merged `solicitudes-inbox` feature. Execute task-by-task; each ends with a test/commit.

**Goal:** Make the Solicitudes screen visible to every signed-in user, with two tabs — **Recibidas** (the existing role-scoped approver inbox) and **Enviadas** (the requests you submitted, any status, read-only) — and fix the bug where a village admin's inbox depends on the single `activeMunicipalityId`.

**Architecture:** Reuse the three request stores. Outbox = per-user queries (`getMyOrganizerRequests`, `getMyJoinRequests`, new `getMyOrganizations`). Inbox stays role-scoped but detects approver status across *all* the user's villages/orgs, not just the active one. Drop the menu/screen gating so everyone reaches the screen.

**Tech stack:** TS, Zod, Firestore, Expo/RN + NativeWind, i18n catalog.

## Global constraints
- Zod source of truth; no `any`. No raw `collection()`/`doc()` outside `firebase/refs/`.
- New composite index needed (`organizations` by `requestedBy, createdAt`) — deploy to dev; builds async.
- i18n via the shared catalog; no hardcoded Spanish in app UI.
- No `Alert.alert` (web no-op); styles on `style` for any `Animated.*`.
- Reads must respect existing rules (no rules changes — owners already read their own organizer/join requests; `/organizations` is public read).

## Design (agreed)
- **Recibidas (inbox):** super admin → all pending (organizer + org-creation across all villages + join); village admin → org-creation for **every village they admin**; org admin → join requests for their orgs; non-approver → empty. Rows keep Aprobar/Rechazar.
- **Enviadas (outbox):** the signed-in user's own requests, any status, read-only with a status badge (Pendiente/Aprobada/Rechazada): organizer (`getMyOrganizerRequests`), join (`getMyJoinRequests`), org-creation (`getMyOrganizations`, all villages).
- **Visibility:** menu item shows for any signed-in user; screen no longer redirects non-approvers. Default tab = Recibidas.

## Tasks

### Task 1 — `getMyOrganizations` + index + test
- `packages/shared/src/services/organizationService.ts`: add
  `export async function getMyOrganizations(userId: string): Promise<(OrganizationData & { id: string })[]>` — query `organizationsCollection` `where('requestedBy','==',userId), orderBy('createdAt','desc')`, map `{id,...data}`. Typed refs only.
- `_services-map.md`: mention `getMyOrganizations` on the organizationService row.
- `firestore.indexes.json`: add `{ collectionGroup:'organizations', queryScope:'COLLECTION', fields:[{fieldPath:'requestedBy',order:'ASCENDING'},{fieldPath:'createdAt',order:'DESCENDING'}] }`.
- vitest: `getMyOrganizations` issues the requestedBy+createdAt query and maps ids (mirror existing organizationService tests).
- Verify `pnpm check:no-raw-firestore-refs` + `pnpm --filter @cultuvilla/shared test`.

### Task 2 — `useApproverStatus` multi-village (bug fix)
- `apps/mobile/lib/auth/useApproverStatus.ts`: stop relying solely on `activeMunicipalityId`. Use `getUserMemberships(uid)` (from `villageMemberService`) to compute `adminVillageIds: string[]` = villages where the user's membership `role === 'admin'`. Compute `adminOrgIds` across **all** those villages (gather `getOrgMembershipsByUserInMunicipality(uid, villageId)` per membership village, filter `role === 'admin'`).
- New output interface: `{ loading, isSuperAdmin, adminVillageIds: string[], adminOrgIds: string[], canApprove }`, `canApprove = isSuperAdmin || adminVillageIds.length>0 || adminOrgIds.length>0`. (Replaces the single `isVillageAdmin` boolean — consumers now use `adminVillageIds`.)
- Keep the cancelled-on-unmount + fail-closed pattern. No `any`.
- Update/extend the hook test for: super admin → canApprove; admin in a non-active village → adminVillageIds includes it + canApprove; org admin → adminOrgIds + canApprove; none → all empty, canApprove false.

### Task 3 — i18n
- `packages/i18n/messages/es.json`, `solicitudes` namespace: add `tab.inbox` ("Recibidas"), `tab.outbox` ("Enviadas"), `status.pending` ("Pendiente"), `status.approved` ("Aprobada"), `status.rejected` ("Rechazada"), `outbox.empty` ("No has enviado solicitudes"), `outbox.organizer` ("Organizar {municipality}"), `outbox.org` ("Crear {org}"), `outbox.join` ("Unirse a {org}"). Keep existing keys. Valid JSON; `pnpm i18n:typecheck`.

### Task 4 — Solicitudes screen: Inbox/Outbox tabs
- `apps/mobile/app/solicitudes/index.tsx`: 
  - Remove the `!canApprove → router.replace('/')` redirect. Everyone renders the screen.
  - Add a tab toggle (Recibidas | Enviadas), default Recibidas. Use a simple in-screen segmented control (no `Alert`); follow existing toggle components if one exists (e.g. `SegmentedToggle`).
  - **Inbox tab:** keep current behavior but drive the village-admin org-creation load off `adminVillageIds` (load pending orgs for each admin village; super admin still uses `getPendingOrganizations()`), join requests off `adminOrgIds`. Empty state when nothing.
  - **Outbox tab:** on mount (signed-in), load `getMyOrganizerRequests(uid)`, `getMyJoinRequests(uid)`, `getMyOrganizations(uid)`. Render read-only rows with a status badge via `solicitudes.status.*`; resolve municipality/org names like the inbox does. Empty state `solicitudes.outbox.empty`. No approve/reject actions.
  - Typecheck (`tsc --noEmit`) + `pnpm app:check-web-compat` clean.

### Task 5 — Menu: show for everyone
- `apps/mobile/components/feature/UserMenuModal.tsx`: replace the `...(canApprove ? [section] : [])` gate so the Solicitudes section renders for any signed-in user (drop the `useApproverStatus`/`canApprove` dependency here). Keep title `solicitudes.title`, label `menu.solicitudes`, route `/solicitudes`. Typecheck + web-compat.

### Task 6 — Full check + deploy
- `pnpm check` green. Deploy the new index to dev (`pnpm deploy:indexes:dev`); note it builds async (the outbox org query fails until ready).

## Out of scope
- Notifications changes. Rules changes. Pagination of the outbox. Cross-village org-admin inbox beyond what `adminOrgIds` covers.
