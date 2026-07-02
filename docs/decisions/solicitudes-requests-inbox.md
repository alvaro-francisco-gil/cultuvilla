# Solicitudes — one inbox/outbox over three request types; org join via org-admin role

## Context

Three user-initiated requests exist (see the taxonomy table in `AGENTS.md`
§"Request types"): organizer requests, organization-creation requests, and org
join requests. They had (or would have had) separate approval surfaces. Product
wanted a single "Solicitudes" screen where a user sees both what they need to act
on and what they've sent, without three bespoke inboxes. Organization join
requests were the missing piece: there was no way for a non-member to ask to join
a peña/asociación and no notion of *who* in an org may approve.

## Decision

- **Org join requests are their own collection with an org-admin approver.**
  `organizationJoinRequests/` created by any authed non-member; approved by an org
  admin or super admin via the `respondToJoinRequest` callable. Org membership
  carries `role: 'admin' | 'member'` (`OrgMemberDataModel`); the request's
  `requestedBy` creator is seeded as `admin` when the org is approved, so every
  org starts with exactly one admin. Approval seeds the member doc in a
  transaction.
- **One screen, inbox + outbox, open to everyone.** `solicitudes/index.tsx` has a
  Recibidas (inbox) and Enviadas (outbox) tab and is reachable by any user — it is
  *not* admin-gated. Non-approvers simply see an empty inbox and their own
  outbox; approvers see actionable items scoped to what they can approve. The menu
  entry is ungated for the same reason.
- **Approver status is multi-scope, not single-village.** `useApproverStatus`
  exposes `adminVillageIds` + `adminOrgIds` + `canApprove` rather than a single
  `activeMunicipalityId`, so a user who administers several villages/orgs (or a
  super admin) sees requests across all of them. Super-admin org-creation review
  spans every village.
- **Approver predicates that rules can't express live in callables.** Firestore
  rules can gate "creator owns this request" and simple shape, but "is the caller
  an admin of the org/village this request targets" needs cross-doc lookups →
  `respondToJoinRequest` / `respondToOrganizerRequest` / `approveOrganization`
  are admin-callable Cloud Functions that do the authorization and the
  seed-on-approve atomically.

## Rejected alternatives

- **Admin-only Solicitudes screen** (initial design). Rejected once the outbox was
  added — a regular user has sent requests they want to track, so the screen has
  to be everyone's. Visibility is scoped by data, not by hiding the screen.
- **Org join grants membership directly (no approver / no role).** Would make any
  peña joinable without the org's consent. Org join stays approval-gated, unlike
  *village* membership which is self-service (see
  [self-service-membership](self-service-membership.md)) — belonging to your
  pueblo needs no permission; joining someone's association does.

## What this binds

- Every org has ≥1 admin: the seed-`requestedBy`-as-admin invariant must hold on
  any new org-creation path. Org admins are the approval backstop for join
  requests and member management; village/app admins are the outer backstop.
- Request visibility is enforced by data scoping + callable authorization, not by
  gating the Solicitudes screen — keep the screen reachable by everyone.
- New approver-side actions must derive eligibility from `useApproverStatus`'s
  multi-scope fields, not a single active village.
- Outbox queries depend on `organizations` by `requestedBy, createdAt` and the
  `organizationJoinRequests` composites in `firestore.indexes.json`; a new
  request-list shape needs its index in the same change.

## Revisit when

- A fourth request type appears → extend the taxonomy table in `AGENTS.md` and the
  inbox/outbox loaders rather than adding a bespoke screen.
- Org join needs member-level (not just admin) triage, or a blocklist for repeat
  requesters → revisit the role model and the seed-on-approve transaction.
