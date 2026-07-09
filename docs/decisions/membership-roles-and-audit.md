# Membership roles & audit trail

Villages and organizations are one abstraction — a *membership group* (members
carrying a `role`, one founder, a request→approval lifecycle). Role transitions
are server-side and audited; the founder pointer is attribution, never authority.

## Problem

Villages and orgs were two parallel subsystems that had drifted:

- The village founder pointer `community.adminUserId` was overloaded (founder +
  wiki-state signal + singleton latch) and misnamed — it reads like "the admin",
  but authority is the `role` flag and a village can have many admins. It grants
  no capability of its own and appears nowhere in `firestore.rules`.
- Promotion to admin was a raw, rules-gated client `updateDoc` on the member doc
  (villages) or an unused client helper (orgs). Neither entity had any record of
  who changed whose role, when.

A client allowed to flip its own `role: 'admin'` cannot be trusted to also
honestly append "promoted by X at time T". An audit trail is only credible when
written **server-side, atomically, by code the user can't bypass** — so wanting
audit forces role transitions behind callables. Once that exists for villages,
it's exactly what orgs need: build it once, for "a membership group", not twice.

## Decision

1. **Honest founder pointer.** `community.adminUserId` → `community.organizerId`
   (`string | null`; `null` = wiki phase). Pure attribution, the village twin of
   org `requestedBy`. Authority stays the `role` flag for both entities. Wiki
   phase still derives from `organizerId == null`.

2. **Shared audit substrate — `membershipEvents/`.** A first-class top-level
   collection scoped by `municipalityId` (AGENTS.md invariant #3), append-only,
   **function-owned** (no client write ever). Rows record actor, target, action
   (`added` | `removed` | `role_changed` | `organizer_set`), and role transition.
   Read authority: village admin of the `municipalityId`, or the org's admin for
   `scopeType == 'org'`, or app admin. Scoping by `municipalityId` lets a village
   admin see all membership activity in their village — *including* role changes
   inside its orgs — for free, and gives super-admins a global view.

3. **Server-side, audited role transitions.** `changeVillageMemberRole` /
   `changeOrgMemberRole` callables check authority, mutate the role, and write the
   event in one transaction. Client services (`setVillageMemberRole`,
   `setOrgMemberRole`) are thin `httpsCallable` wrappers. **This is how new admins
   are created** — one audited callable per scope. Existing seed points
   (organizer approval, org approval, join-request approval) also emit events, so
   the log is complete from day one.

4. **`role` is function-owned in rules.** Client self-join create is preserved
   (village `role: 'user'`, org `role: 'member'`); the client can no longer write
   `role` on update. Only the Admin SDK inside callables writes it.

## Rejected alternatives

- **Merging the two `members` subcollections.** Village members carry censo
  `profileAnswers`, `barrioId`, `trustedNewsAuthor` that org members don't. What
  unifies is the layer *above* storage (audit substrate + audited transition
  path), not the storage itself. Kept separate.
- **Renaming org `requestedBy` for symmetry.** Churn with no clarity payoff —
  orgs legitimately can't be founder-less, unlike a village in its wiki phase.
- **Aligning role vocabulary (`'user'` ↔ `'member'`).** Cosmetic, extra backfill;
  deliberately deferred.

## What this binds

- Never write `role` from a client. New admins/demotions go through
  `changeVillageMemberRole` / `changeOrgMemberRole` only.
- Every role transition and membership seed must `writeMembershipEvent` inside the
  same transaction — the log's credibility depends on atomicity.
- `organizerId` (village) and `requestedBy` (org) are attribution, not authority.
  Never gate a capability on them; gate on `role == 'admin'`.
- Demoting the current `organizerId` holder below admin is refused
  (`failed-precondition`) until a transfer-organizer flow exists.

## Revisit when

- A transfer-organizer flow is needed (cut 1 only *guards* against demoting the
  organizer; the transfer callable was left as a follow-up).
- A per-group history UI lands — add the `scopeType, scopeId, at DESC` composite
  index (only `municipalityId, at DESC` ships today).
- Role vocabulary alignment becomes worth the backfill.
