# Event group sign-ups — an unclaimed seat is a real registration

## Context

An organizer can declare that an event is signed up for in *parejas*, *tríos* or
*grupos de cuatro* (`signupGroupSize` 2–4). The invariant has to hold where it
actually costs something: at the capacity boundary, through cancellations, and
through waitlist promotion. A seat in your group may be filled by a persona you
have a cargo over, or by a different real user reached through a link — commonly
someone who is not yet a village member, or not yet a user at all.

## Decision

**The group owner books every seat up front, including the ones nobody has taken
yet.** An unclaimed seat is a real, `confirmed` registration with a placeholder
name and `personId: ''`, holding capacity — and, on a paid event, owed for — from
the moment it is created. Claiming it is a **reassignment of an existing row**,
not a sign-up.

The consequences are what justify it:

- `RegistrationStatus` stays `confirmed | waitlisted`. No consumer changed.
- Capacity is honest: the seat is occupied from minute one, seated in the same
  transaction as the booker's own. There is no pending-vs-held policy to pick.
- No expiry sweeper. A seat nobody claims degrades into "I brought a guest whose
  name the organizer doesn't know" — a fine outcome, not a failure state.

**The `userId` / `groupOwnerId` split is load-bearing.** On a claimed seat
`userId` moves to the claimer, so the seat behaves like any other registration of
theirs in everything already built (`getUserRegistrations`, the *apuntado*
ribbon, *Mis inscripciones*) with no new query. `groupOwnerId` keeps pointing at
the booker, and is what `resolveCancellation` reads to tell "the group is
leaving" from "one guest dropped out".

**The claim token is the doc id** (`events/{id}/seatTokens/{token}`), single-use,
owner+organizer read, callable-only write.

**One group per `registerToEvent` call**, with
`registrants.length + openSeats === signupGroupSize` exactly. That keeps seating
a single fits-or-waits decision instead of a packing problem; a user wanting two
parejas registers twice.

## Rejected alternatives

- **Pending invitations** — a seat that does not exist until the guest accepts.
  The obvious design, and the expensive one: an expiry sweeper, a third
  registration status, and a policy question about whether the seat holds
  capacity while pending, each rippling through `confirmedCount`, the waitlist
  trigger, roster export, check-in and the paid register.
- **Cross-user pairs through an in-app picker.** `municipalityPeople` is already
  a village-gated directory and would make a workable partner picker landing in
  the Solicitudes inbox. Deferred because the link flow reaches people who are
  not yet members or even users — the common case in a pueblo — and needs no new
  request type. It is a UX layer over the same state machine.
- **A friends/social graph.** No such concept exists and none should be added for
  this: village membership already *is* the trust boundary, and gating pair
  sign-up behind "first go make friends" inverts the product.

## What this binds

- **`cancelRegistration` is the only delete path.** Rules deny client deletes on
  registrations outright; the callable resolves `delete-solo` / `delete-group` /
  `release-seat`. Anything new that removes a registration goes through it.
- **Waitlist promotion is group-wise**, via `selectPromotionGroup` — a group is
  promoted whole or not at all.
- **Walk-ins stay ungrouped** even on a group event. A walk-in is the organizer's
  override at the door; refusing someone standing in front of them for want of a
  partner would be the rule serving itself.
- **A group of pure open seats is refused** — you must be in your own group,
  otherwise it is a stranger's booking made in your name.
- **A group has no partial edit.** It cannot shrink below its size, so "remove
  one seat" is not an operation the event admits: cancel and rebook, or have the
  guest release the seat.
- `signupGroupSize` freezes once `totalCount > 0`.
- `claimEventSeat` does **not** require village membership — ordinary sign-up
  never did.

## Revisit when

- People ask for in-app partner selection → layer the `municipalityPeople` picker
  over the existing state machine; no model change.
- A use case appears for a seat that should *not* hold capacity before it is
  claimed → that is the pending-invitation design, and it should be re-costed
  against the list above rather than bolted on.
