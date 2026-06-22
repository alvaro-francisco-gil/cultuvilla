# Solicitudes — request taxonomy + admin inbox

## Goal

Pin down the canonical set of user-initiated "solicitudes" (requests) in the app, add the missing **join-org** request type, and give approvers a single **Solicitudes** inbox (top-right menu) scoped to what each role is allowed to approve.

## Context

The app already has two request flows, but they were never named as a coherent family and have no shared approver surface:

- **Organizer request** — `/organizerRequests` (top-level). A user asks to become the organizer/admin of a village. App admins approve via the `respondToOrganizerRequest` callable. See `packages/shared/src/models/municipality/OrganizerRequestDataModel.ts`, `functions/src/village/requestOrganizeVillage.ts`, `respondToOrganizerRequest.ts`.
- **Organization request** — a `/organizations/{id}` doc with `status: 'pending'` *is* the request. Village admins or app admins approve via `approveOrganization` / `rejectOrganization`. `ayuntamiento` is a per-village singleton created through the `requestAyuntamiento` callable. See `packages/shared/src/services/organizationService.ts`.

There is also a **dangling, unimplemented** third type: the notification enum in `NotificationDataModel.ts` already carries `join_request_created | join_request_approved | join_request_rejected`, but no collection, service, or rule backs it. This plan **implements** that type rather than deleting it.

Org membership today is **flat**: `/organizations/{orgId}/members/{userId}` is just `{ joinedAt }`. Any member can add others (`addOrgMember`); removal is limited to self (`isOwner`) or a village/app admin. There is no org-internal authority that can approve joins or remove members — which is the gap that motivates the org-admin role below.

## Design / approach

### 1. The canonical taxonomy (3 request types)

| # | Request | Created by | Created from (in-context) | Approved in Solicitudes by |
|---|---|---|---|---|
| 1 | **Organizer request** — be the pueblo's organizer/admin | any user | village screen | super admin |
| 2 | **Organization request** — create a peña / asociación / ayuntamiento | village member | village / orgs screen | village admin (own village) **or** super admin |
| 3 | **Join-org request** *(new)* — join a specific peña / asociación | any authed non-member | org screen | org admin (of that org) **or** super admin |

Types 1 & 2 exist today and are unchanged in behavior; they are only *surfaced* in the new inbox. Type 3 is new.

The **Solicitudes button receives requests; it does not launch them.** Non-admin users never see the button — they create requests from the existing in-context entry points (village screen, org screen) and track outcomes through the existing per-user notifications (`/users/{uid}/notifications`).

### 2. Org-admin role (new)

Add a role to org membership so an org has an internal authority that can approve joins and remove members.

- Add `role: 'admin' | 'member'` to `/organizations/{orgId}/members/{userId}`. `buildOrgMemberData` defaults to `'member'`.
- On org **approval**, the org's `requestedBy` creator is written as the first member with `role: 'admin'`.
- **Org admin can:** approve/reject join requests, remove members, and **promote/demote** other members to/from `admin`.
- **Regular member can:** only leave (self-remove).
- **Village admin / super admin:** unchanged backstop — can still add/remove anyone.
- Rules gain an `isOrgAdmin(orgId)` helper. The member-doc `update` rule (currently `false`) opens **only** for `role` changes performed by an org admin or backstop admin — no other field may change.
- **Backfill:** mark every existing approved org's `requestedBy` as `role: 'admin'` (and any pre-existing members as `'member'`). Runs per-env (dev → beta → prod).

### 3. Join-org request flow & storage

- New top-level collection `/organizationJoinRequests/{id}` mirroring `OrganizerRequest`:
  `{ userId, orgId, municipalityId, status: 'pending' | 'approved' | 'rejected', requestedAt, reviewedAt, reviewedBy }`.
  Top-level (not a subcollection) so the super-admin firehose and org-admin queries are straightforward; `municipalityId` is denormalized for scoping/queries.
- `requestJoinOrganization(orgId)` creates the doc. Rules allow create by any authed user who is **not already a member** and has no open pending request for that org.
- **Approval is a callable** (admin SDK) that, in one transaction, flips `status → approved` **and** writes the `/organizations/{orgId}/members/{userId}` doc (`role: 'member'`). Rejection just flips `status → rejected`. Doing both in a transaction keeps the membership and the request record consistent.
- Reads gated: `isOrgAdmin(orgId) || isAppAdmin()`, plus the requester may read their own requests.
- Direct-add (`addOrgMember`) stays exactly as-is, alongside the request flow.
- Wire the existing `join_request_created | join_request_approved | join_request_rejected` notification types: notify org admins on create, notify the requester on decision (follow `functions/src/helpers/notifyRequests.ts`).

### 4. The Solicitudes inbox (admin-only)

- A top-right menu button rendered **only** when the signed-in user can approve *something* — i.e. is a **village admin, an org admin, or a super admin**. Everyone else: no button.
- Inbox contents by role (a user with multiple roles sees the union):
  - **Super admin** → all pending requests of all 3 types, across all villages (firehose).
  - **Village admin** → **organization-creation requests** for their own village. *Not* join requests, *not* organizer requests.
  - **Org admin** → **join requests** for the org(s) they administer.
- Each row offers approve / reject, calling the relevant callable/service (organizer → `respondToOrganizerRequest`; org-creation → `approveOrganization`/`rejectOrganization`; join → the new callable). Decisions fan out via the notification types above.
- **Row display per type** (give the approver enough to decide without drilling in):
  - **Organizer request** → the **municipality** (resolve `municipalityId` → name), and the requester's **motivation** text *if present* (`motivation` is nullable). The proposed `description` may also be shown.
  - **Org-creation request** → org name + type (peña/asociación/ayuntamiento) + municipality.
  - **Join request** → requester display name + target org name.

### 5. Deliverables

1. A concise **taxonomy section in `AGENTS.md`** (the 3 types: who creates, who approves, where each lives) — the durable "define it properly" record.
2. This spec, promoted through the plan lifecycle (`ideas/` → `ready/` → `ongoing/`).
3. Implementation: new model + service + rules + approval callable + backfill + inbox UI, following the `add-firestore-collection`, `guardrail-enforcement`, and `cloud-function-logging` skills.

## Out of scope

- **Self-service join for villages** (a "request to join a pueblo" type) — village membership stays invite-token / admin-add only.
- **A standalone requester "outbox" UI** — status tracking rides on existing notifications.
- **Org-admin management UI polish** (member list, promote/demote screen) beyond what's needed to action join requests — can follow once the inbox lands.

## Open questions

- Exact query strategy for the **org-admin join-request inbox** (per-org reads vs. a denormalized "orgs I administer" list vs. an `in` query, capped at 30). Decide during `ready/` planning.
- Whether org-creation approvals should *also* notify the requesting village's admin when a super admin acts (avoid duplicate/cross fan-out). Decide during `ready/` planning.
