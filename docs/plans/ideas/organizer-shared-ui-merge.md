# Organizer / villager shared-UI merge

## Goal

Delete the separate `/village/[villageId]/admin/` route group and fold every organizer task onto the same village screens villagers already use, so role changes the *behaviour* of a screen rather than which screen you land on.

## Context

Today organizer tasks live in a parallel `/village/[villageId]/admin/` area gated by `isVillageAdmin || isAppAdmin`, reachable via "Gestionar" buttons and a duplicate "Edit" affordance (village tab pencil + admin hero both deep-link to `/admin/community`). This produces two problems the user wants gone:

- A uniform "Manage / Add → go to admin screen" card grid hides that the underlying tasks are genuinely different (approval queues vs. inline CRUD vs. a settings form), and the "Gestionar" verb is meaningless once you realise you could just act in place.
- Villagers have no way to contribute content (a missing landmark, a new peña) without an organizer doing it for them.

The codebase already has a clean precedent for "anyone proposes, organizer commits": **occupation proposals** (`occupationProposals`, `proposeOccupation` → `status:'pending'` → admin `reviewProposal` update, with a trigger handling side-effects) and **organizations** (villagers create `peña`/`asociación` as `status:'pending'`; `isVillageAdmin` updates the status). Places and barrios are currently `isAppAdmin`-only with no status field.

"Organizer" throughout means `isVillageAdmin(municipalityId) || isAppAdmin()`.

## Design / approach

### Information architecture

Remove the `/village/[villageId]/admin/` route group entirely. Management happens on the shared village screens. You are never routed *to* management; you are already on the screen and the affordances differ by role. This is what makes "Gestionar" disappear.

Every screen falls into one of three interaction patterns:

| Pattern | Villager | Organizer | Domains |
|---|---|---|---|
| **Propose-pending** | Add → creates a `pending` item visible to all; can edit/withdraw their own pending item | Add → commits live; taps any `pending` item to accept/reject; edits live items directly | Places, Barrios, Organizations |
| **Role-mode** | Consumes: answers census / views header | Authors: edits census schema / edits header in place | Census, Community header |
| **Shared view + drill-in console** | Views the detail screen and acts (registers for an event) | Same screen reveals light inline affordances + an entry into a dedicated organizer-only management console | Events |

A capability layer, **not** a generic mega-component. A `useEntityCapabilities(municipalityId)` hook answers *can I commit directly? can I approve? is this my own pending item?* A small set of presentational primitives — `PendingBadge`, `AddAffordance`, `ApproveRejectActions`, own-pending `Edit`/`Withdraw` — compose into each screen. We deliberately avoid a config-driven `<ProposableList>`: places/barrios/orgs have different item shapes and census/community are not lists, so a single component would force-fit them.

### Propose-pending: data model

Places and barrios gain the three fields organizations already carry, plus a proposer pointer:

```ts
status: 'pending' | 'approved' | 'rejected'
approvedBy: string | null      // who approved (also set on organizer self-commit)
decidedAt: Date | null
proposedBy: string             // for isOwnPending() + "withdraw your own"
```

(Organizations already have `status` + `requestedBy` + `approvedBy` + `decidedAt`; only naming alignment is needed there.)

Existing places/barrios rows are app-admin-created, so a one-shot backfill stamps them `status:'approved'`, `proposedBy` = a sentinel/admin uid, `approvedBy` = same, `decidedAt` = `createdAt`.

### Propose-pending: single create path (organizer auto-approve)

Both villagers and organizers create through one path that always writes `status:'pending'`. When the caller is an organizer, the UI immediately follows with `approve<Entity>()`. This keeps **one** rules `create` surface and **one** validation function, and records `approvedBy` even for organizer self-commits (full audit trail). Rejected alternative: a second "create directly as approved" path — avoided because it doubles the rules/validation surface for no UX gain (the auto-approve round-trip is invisible to the organizer).

### Propose-pending: firestore rules

Per entity (places, barrios), replacing the current `allow write: if isAppAdmin()`:

```
allow read: if true;   // unchanged — pending items are visible to everyone

allow create: if isVillageMember(municipalityId)
              && isValid<Entity>Create(request.resource.data)
              && request.resource.data.status == 'pending'
              && request.resource.data.proposedBy == request.auth.uid;

allow update: if isVillageAdmin(municipalityId) || isAppAdmin()   // approve/reject + edit live
              || ( isOwner(resource.data.proposedBy)              // proposer edits own pending
                   && resource.data.status == 'pending'
                   && request.resource.data.status == 'pending' );

allow delete: if isVillageAdmin(municipalityId) || isAppAdmin()
              || ( isOwner(resource.data.proposedBy)              // proposer withdraws own pending
                   && resource.data.status == 'pending' );
```

Enforcement is in the rules, not the UI — UI role-gating is convenience. This matches the `occupationProposals` / `organizations` precedent and needs **no new Cloud Function** (village-admin + status transition is expressible in rules). Per the `guardrail-enforcement` skill, the predicate stays in rules because it is identity/role + a simple state transition.

### Propose-pending: services

In `municipalityService.ts`: `createPlace` → `proposePlace`; add `approvePlace`/`rejectPlace`/`withdrawPlace` (and the barrio equivalents). Organizations already expose `approveOrganization`/`rejectOrganization` — align naming. Add a `proposed`/`pending` filter helper so non-management browse contexts (e.g. the public map / landmark list) show only `approved` items while the shared management view shows all statuses.

### Propose-pending: reads / visibility

`allow read` is already `true`, so pending items surface automatically. The list query returns all statuses; the shared screen styles `pending` distinctly (badge + approve/reject for organizers, edit/withdraw for the proposer). Purely consumer-facing surfaces filter to `status == 'approved'`.

### Role-mode: census

One shared census screen, branching on `isVillageAdmin`:

- Villager → the answer form: fills/edits **their own** answers against the current schema (already exists; `members/{uid}` self-update of `profileAnswers` is already allowed).
- Organizer → the schema authoring view: add/remove/edit questions via `updateCensoSchema`, which already routes through the `updateCenso` Cloud Function with transition validation.

No data-model change, no proposals, no pending. Just merging the two existing screens behind one entry point.

### Role-mode: community / village header

One shared header, branching on `isVillageAdmin`:

- Villager → views escudo, cover images, description, location.
- Organizer → inline edit affordances on the same header (escudo / cover / description / coordinates), writing through the existing `updateMunicipality` / `updateCommunity`. Rules already allow `isVillageAdmin` updates.

This removes the two duplicate "Edit" entry points (village-tab pencil + admin hero) — there is one header, edited in place.

### Events: shared detail + organize console (hybrid)

The event detail screen (`event/[eventId].tsx`) stays the single shared screen for everyone: title, description, date, location, the **public** attendee/waitlist list, and the register ("asistir") button. Registration stays **instant** — confirmed, or waitlisted if at `maxAttendees`, via the existing `registerToEvent` callable. Events have **no approval/request queue**; "organizing" an event is management, not moderation.

Organizer of an event = `isOrgMember(event.organizationId) || isVillageAdmin(municipalityId) || isAppAdmin()` (matches the existing event update/delete rules — note this is a *different* axis from village-admin: a peña member who is not a village admin still organizes their own org's events). Determined client-side via `getOrgMembershipsByUserInMunicipality(uid, municipalityId, [organizationId])` plus the admin checks.

For an organizer the shared detail screen reveals (light, inline):

- Edit pencils on the editable fields (title / description / date / location / capacity / image) writing through the existing `updateEvent` service.
- A cancel-event control (`status:'cancelled'`).
- An **"Organize this event"** entry → the dedicated console.

The dedicated **`/event/[eventId]/organize` console** (organizer-only route) holds the roster-heavy management:

- Attendee + waitlist roster: names, member badge, confirmed/waitlist, count vs `maxAttendees`. **Organizer-only phone numbers** (see constraint below).
- **Check-in** — *greenfield*: a `checkedInAt: Date | null` on the registration doc + a per-attendee toggle.
- **Manual walk-in add** — *greenfield, explicitly required*: an organizer-created registration that does **not** require a real `userId`/`personId`, routed through the same server-side capacity/waitlist logic.
- **Remove a registration** (no-show / duplicate) — *rules tweak*: delete is currently self-only; extend to organizer.
- Cancel / mark `completed`.

**Drop the `draft` status.** Creating an event writes `status:'published'` directly; the current `draft` state is unreachable (no publish UI exists). `status` enum becomes `published | cancelled | completed`. Event-create validation drops `draft`.

Model / rules deltas for events:

- Registration model gains `checkedInAt: Date | null`.
- **Phone privacy:** Firestore rules are document-level — you cannot make a single field of a public doc private. The attendee roster stays `read: true`, so the phone (captured when the event has `telephoneRequired`) must live in a **separately-gated** doc, e.g. `events/{eventId}/registrationContacts/{regId}`, readable only by `isOrgMember(...) || isVillageAdmin || isAppAdmin`. Not as a field on the public registration doc.
- Registration `delete` rule extended from self-only to also allow `isOrgMember(event org) || isVillageAdmin || isAppAdmin`.
- Walk-in path: a registration shape that represents an organizer-added attendee without an auth account.

The cheap core (edit + cancel + public roster + delete) and the heavier greenfield items (check-in, walk-in, organizer-gated phones) can split into separate plan stages — the heavy three could be a v2 if the first cut needs to land fast.

### Net result

The village screens (header, people/members, places, barrios, organizations, census) become the only surface. `/admin/` is deleted. Organizer = the same screens with extra inline affordances driven by `useEntityCapabilities`. Events follow the same spirit — one shared detail screen — with a single organizer-only drill-in route (`/event/[eventId]/organize`) for roster-heavy management that would otherwise bloat the public screen.

## Out of scope (handled elsewhere / deferred)

- **Direct join (remove join-request approval).** Already an in-flight idea: `docs/plans/ideas/self-service-membership.md` + the `feat+self-service-membership` worktree (self-service `members` create rule drafted). Folding it in here would collide with that work. The merge spec assumes membership/role checks keep working as-is and does not touch the join flow.
- **Single invite link (retire multi-token invites).** Greenfield. Deep-link infra exists (`deepLinkService.getVillageInviteLink`) but is not wired to redemption; multi-token (`inviteTokens` + `acceptInvite`) is the current live mechanism. Its own plan.
- **Villager-proposed *edits* to existing approved items.** v1 proposals are new-items-only; editing an already-approved place/barrio stays organizer-only-direct (YAGNI).
- **Member role management / removing members.** Not part of this merge; no current public equivalent.

## Open questions

- Exact placement of the (now minimal) organizer-only bits once join-approval and multi-token are gone — likely nothing organizer-only-without-a-public-equivalent remains on the People screen, but confirm when that screen is built.
- Whether `proposedBy` backfill sentinel for legacy admin-created places/barrios should be a real admin uid or a reserved constant (affects whether `isOwnPending` could ever match legacy rows — a reserved non-uid constant is safer).
- Whether organizations need any UI change at all beyond adopting the shared primitives, since their data model + rules already fit the pattern.
- Where the attendee phone is captured today (the registration doc has no phone field) — registration-time capture into the gated `registrationContacts` doc is the assumption, but confirm whether `telephoneRequired` collects a phone anywhere currently.
- Walk-in attendee representation: a sentinel/null `userId` on the registration vs. a distinct shape — affects the roster query, the capacity logic, and waitlist promotion.
- Whether check-in / walk-in / organizer-gated phones ship in v1 or as a v2 stage after edit + roster + cancel + delete.
