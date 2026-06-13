# Village join/organizer requests go through Cloud Function callables, deduplicated by uid

## Context

The mobile signup flow assumed a user already belonged to a village: it created
a Firebase Auth user but never wrote `users/{uid}`, so `profile` stayed `null`,
and there was no path to find a village, ask to join one, or propose organizing
an inactive municipality. Users needed to register without a village, then
discover and request access.

## Decision

- **Two request collections.** `municipalities/{mid}/joinRequests/{userId}` is
  keyed by uid so duplicate join requests are *structurally impossible* — one doc
  per user per village. `organizerRequests/{requestId}` is top-level (auto-id)
  because the target municipality may not yet have an active community to nest
  under, so dedup is enforced in-function instead (query for an existing pending
  request before creating).
- **All writes go through four Cloud Function callables** —
  `requestJoinVillage`, `respondToJoinRequest`, `requestOrganizeVillage`,
  `respondToOrganizerRequest`. Clients never write these docs directly; the
  services in `@cultuvilla/shared` are thin `httpsCallable` wrappers plus reads.
- **Firestore rules deny all client writes** to both collections (create/update/
  delete `if false`) — Cloud Functions (admin SDK) own them. Reads are scoped:
  requester, village admin of that municipality, or app admin.
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
- **Auto-approval / open-membership village mode** — deferred to a future
  per-village `community.joinPolicy` field; admin always approves for now.
- **Web admin UI for organizer-request review** — out of scope; mobile-only.

## What this binds

- New mutations on join/organizer requests must be added as Cloud Function
  callables, not client writes — the rules will reject direct writes.
- The uid-as-doc-id key on `joinRequests` is the dedup mechanism; do not switch
  to auto-ids without re-adding an explicit duplicate check.
- Collection-group queries over `joinRequests` must filter `userId == auth.uid`
  (the rules' self-list carve-out only covers that shape).
- The invite-token flow stays untouched as the "skip the queue" path.

## Revisit when

- A village wants frictionless joins (introduce `community.joinPolicy`).
- Discovery for users already in a village (beyond the switcher's "buscar otro
  pueblo") warrants promoting discovery back to a dedicated tab.
