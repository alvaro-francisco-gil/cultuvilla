# Village join/organizer requests go through Cloud Function callables, deduplicated by uid

> **Superseded in part by [self-service-membership](self-service-membership.md):**
> the *join* flow described here (`joinRequests`, `requestJoinVillage`,
> `respondToJoinRequest`, and their screens) is **retired** — joining a village is
> now an unapproved self-write. What remains durable below is the request pattern
> for the **organizer grant** (callable-owned writes, rules deny client writes,
> in-function transactional guardrails, `organizerRequests` dedup) and the
> profile-forced-post-signup + `activeVillageId`-as-UI-hint decisions.

## Context

The mobile signup flow assumed a user already belonged to a village: it created
a Firebase Auth user but never wrote `users/{uid}`, so `profile` stayed `null`,
and there was no path to find a village, ask to join one, or propose organizing
an inactive municipality. Users needed to register without a village, then
discover and request access.

## Decision

- **Request collection.** `organizerRequests/{requestId}` is top-level (auto-id)
  because the target municipality may not yet have an active community to nest
  under, so dedup is enforced in-function (query for an existing pending request
  before creating). *(The original `municipalities/{mid}/joinRequests/{userId}`
  collection — keyed by uid to make duplicate join requests structurally
  impossible — is retired; see the superseded note above.)*
- **All writes go through Cloud Function callables** — `requestOrganizeVillage`,
  `respondToOrganizerRequest`. Clients never write these docs directly; the
  services in `@cultuvilla/shared` are thin `httpsCallable` wrappers plus reads.
- **Firestore rules deny all client writes** to the request collection (create/
  update/delete `if false`) — Cloud Functions (admin SDK) own them. Reads are
  scoped: requester, village admin of that municipality, or app admin.
- **Guardrails the rules can't express live in the function**, inside a
  transaction: requester not already a member, no prior pending request, target
  community active (join) or inactive (organize). On approval the function
  transactionally adds the membership (and, for organizer approval, activates the
  community with the requester as admin).
- **Profile is forced post-signup**: a `(onboarding)/complete-profile` redirect
  fires when `user && profileChecked && !profile`, writing the missing
  `users/{uid}` doc so the rest of the app stops dereferencing `null`.
- **Three-tab nav** (Explora / dynamic village / Perfil) where the middle tab
  swaps between the active-village home and the discovery screen based on
  `profile.activeMunicipalityId`. Builds on
  [open-feed-architecture](open-feed-architecture.md)'s `activeVillageId` as a UI
  hint, never a security primitive.

## Rejected alternatives

- **Client-side request writes guarded only by rules** — rules can't express
  "not already a member AND no prior pending request" atomically; the callable +
  transaction does.
- **Web admin UI for organizer-request review** — out of scope; mobile-only.

## What this binds

- New mutations on organizer requests must be added as Cloud Function callables,
  not client writes — the rules will reject direct writes.
- The invite-token flow stays untouched as the "skip the queue" path.

## Revisit when

- Discovery for users already in a village (beyond the switcher's "buscar otro
  pueblo") warrants promoting discovery back to a dedicated tab.
