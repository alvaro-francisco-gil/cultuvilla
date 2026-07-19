# Organizer / villager shared UI — role changes behaviour, not the screen

> **Partly superseded.** The "propose-pending" pattern (#1) and the in-collection
> `pending | approved | rejected` proposal state below now apply **only to
> organizations**. Places, barrios and festival posters moved to the optimistic
> visibility model — created `active`, removed by soft-hide — see
> [content-moderation-optimistic-visibility](content-moderation-optimistic-visibility.md).
> The shared-screen / role-changes-behaviour core of this decision still holds.

## Context

The app had a parallel `/village/[villageId]/admin/` route group: organizers used
a separate set of screens from the ones villagers saw. This duplicated every
surface (places, barrios, orgs, census, community header, events), drifted out of
sync, and forced navigation logic to route users to "their" version of a screen.

## Decision

Delete the `/admin/` route group. Every organizer task lives on the **shared
village screens**, and a user's **role changes a screen's behaviour** rather than
which screen they see. Enforcement lives in `firestore.rules` (mirroring
`occupationProposals` / `organizations`), not just the UI. Three interaction
patterns covered the original surface split. Current content moderation has since
retired the generic proposal queue for places, barrios and festival posters; the
historical patterns below should be read through the superseding note above.

1. **Request/approve** (Organizations only). Everyone can request a peña or
   asociación. A villager-created org lands as `pending`; village/app admins
   approve or reject because approval grants admin authority to the requester.
   One `useEntityCapabilities(municipalityId)` hook (`{ canManage, canApprove,
   uid }`) drives the affordances.
2. **Role-mode** (Census, Community header). Same screen, no proposals — the role
   picks the capability: author the census schema vs. answer it; edit the village
   header in place vs. view it.
3. **Shared view + drill-in console** (Events). One shared detail screen with
   light inline organizer affordances, plus a dedicated `/event/[eventId]/organize`
   route for the roster / edit / cancel / check-in / walk-in.

Supporting decisions that are non-obvious from the code:

- **Organization request state lives in-collection.** Organizations carry
  `status ∈ {pending, approved, rejected}` plus request/review fields on the same
  doc, not a side collection. Places, barrios and festival posters now use
  optimistic visibility (`active | hidden`) instead.
- **"Organizer" is context-dependent.** Everywhere it means
  `isVillageAdmin(municipalityId) || isAppAdmin()` — **except events**, where it
  is `isOrgMember(event.organizationId) || isVillageAdmin || isAppAdmin`, because
  an event is owned by an org, not the village.
- **Phone privacy is a document-level constraint.** Firestore rules gate whole
  documents, not fields, and a registration doc is publicly readable (attendee
  list). So a contact phone cannot be a field on the registration. It lives in a
  separately-gated `events/{eventId}/registrationContacts/{regId}` subcollection,
  readable only by the event's organizers, written by callables.
- **Walk-ins are organizer-created registrations with empty `userId`/`personId`**,
  added via the `addWalkInRegistration` callable so capacity/waitlist logic stays
  server-side.
- **Pending-visibility is UI filtering for organizations, not a security
  boundary.** Approved organizations are public; a pending org shows only to its
  requester and to admins; rejected orgs are hidden from lists. Places, barrios,
  festival posters and news are filtered by `active` visibility in their
  services.
- **`draft` event status was dropped.** Create → `published`; the enum is
  `['published','cancelled','completed']`. Legacy `draft` docs coerce to
  `published` on read via `z.preprocess`.

## Rejected alternatives

- **Keep separate admin screens.** The duplication and drift were the whole
  problem; role-gated shared screens remove an entire parallel surface.
- **A side `proposals` collection.** In-collection status + `.default` legacy
  compat avoids a join on every read and needs no migration.
- **A phone field on the registration doc.** Impossible to hide field-wise under
  document-level rules; hence the gated subcollection.

## What this binds

- New village-surface features follow one of the three patterns above; there is
  no admin route group to add screens to.
- Reads of a public doc must assume field-level privacy is impossible — sensitive
  data goes in a separately-gated child doc written by a callable.
- The review status enum is exactly `pending | approved | rejected` for
  approval-gated requests such as organizations and organizer requests. New
  content collections should not reuse it by default; use the optimistic
  visibility model unless authority is granted on approval.

## Revisit when

- Villager-proposed *edits* to existing approved items are wanted (v1 is
  new-items-only; editing an approved place/barrio stays organizer-direct).
- Member role management / removing members lands (out of scope here).
