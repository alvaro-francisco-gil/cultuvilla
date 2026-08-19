# Event Group Sign-ups — parejas, tríos, open seats

## Status

Implemented. Ships with the `feat/event-group-signups` PR. This document records
the design decisions that the code cannot state for itself; once it has been on
prod for a release it should be distilled into `docs/decisions/` and deleted
(see the `managing-plans-lifecycle` skill).

## Goal

Let an organizer say "this event is signed up for in parejas" (or tríos, or
grupos de cuatro) and have the system actually hold that invariant — including
at the capacity boundary, through cancellations, and through waitlist
promotion. A person filling a seat may be a persona the booker has a cargo, or
a different real user reached by a link.

## The decision that made this small

The obvious design for "invite a real user to your pareja" is a pending
invitation: a seat that does not exist until the guest accepts, with an expiry
sweeper, a third registration status, and a policy question about whether the
seat holds capacity while pending. Every one of those costs ripples through
`confirmedCount`, the waitlist trigger, roster export, check-in and the paid
register.

**We do not do that.** The group owner books *every* seat up front, including
the ones nobody has taken. An unclaimed seat is a real, confirmed registration
with a placeholder name, held and (on a paid event) owed for from the moment it
is created. Claiming it is a **reassignment** of an existing row, not a
sign-up.

Consequences, all of them good:

- `RegistrationStatus` stays `confirmed | waitlisted`. No consumer changes.
- Capacity is honest: the seat is occupied from minute one, seated in the same
  transaction as the booker's own. No pending-vs-held policy to pick.
- No expiry sweeper. A seat nobody claims degrades into "I brought a guest whose
  name the organizer doesn't know", which is a fine outcome rather than a
  failure state.
- `personId` only needed *widening* to accept `''` (the walk-in shape already
  used it), and the three new registration fields are additive.

## Model

| Field | Where | Meaning |
|---|---|---|
| `signupGroupSize` | `events/{id}` | 1 = individual (default). 2-4 = seats booked together. Frozen once `totalCount > 0`. |
| `groupId` | `registrations/{rid}` | Seats booked together. `null` on every individual registration. |
| `groupOwnerId` | `registrations/{rid}` | Who booked the group. Equals `userId` on the booker's own seats; on a claimed seat `userId` is the claimer and this still points at the booker. |
| `isOpenSeat` | `registrations/{rid}` | Held but unfilled. Placeholder name, `personId: ''`. |
| — | `events/{id}/seatTokens/{token}` | **The doc id is the secret.** Single-use claim token. Owner+organizer read, callable-only write. |

The `userId` / `groupOwnerId` split is load-bearing. Moving `userId` to the
claimer means their seat behaves like any registration of theirs everywhere
already built — `getUserRegistrations`, the "apuntado" ribbon, `/me/registrations`
— with no new query. `groupOwnerId` is what `resolveCancellation` reads to tell
"the group is leaving" from "one guest dropped out".

## Server

- **`registerToEvent`** — one group per call. `registrants.length + openSeats`
  must equal `signupGroupSize` exactly. Seats the group atomically via
  `computeGroupStatuses`, mints a token per open seat. One group per call is
  what keeps the seating a single fits-or-waits decision instead of a packing
  problem; a user wanting two parejas registers twice.
- **`claimEventSeat`** — validates the token, checks the persona belongs to the
  caller, re-asks the event's `signupFields`, reassigns the row, consumes the
  token, notifies the owner. Does **not** require village membership: ordinary
  sign-up never did.
- **`cancelRegistration`** — new; the *only* delete path (rules now deny client
  deletes outright). Three outcomes from `resolveCancellation`:
  `delete-solo`, `delete-group`, `release-seat`.
- **`onRegistrationDeleted`** — promotes whole groups via `selectPromotionGroup`.

## Deliberate carve-outs

- **Walk-ins stay ungrouped** even on a group event. A walk-in is the
  organizer's override at the door; refusing someone standing in front of them
  for want of a partner would be the rule serving itself.
- **The group summary has no partial edit.** A group cannot shrink below its
  size, so "remove one seat" is not an operation the event admits. Change who is
  coming by cancelling and rebooking, or have the guest release their seat.
- **A group of pure open seats is refused.** You must be in your own group;
  otherwise it is a stranger's booking made in your name.

## Not done, and why

- **Cross-user pairs by in-app picker.** `municipalityPeople` is already a
  village-gated directory and would make a workable partner picker, landing the
  request in the existing Solicitudes inbox. Deferred: the link flow reaches
  people who are not yet members or even users, which is the common case in a
  pueblo, and it needs no new request type. Revisit only if people ask for
  in-app partner selection — it is a UX layer over the same state machine.
- **A friends/social graph.** No such concept exists in the codebase and none
  should be added for this: village membership already *is* the trust boundary,
  and gating pair sign-up behind "first go make friends" inverts the product.
