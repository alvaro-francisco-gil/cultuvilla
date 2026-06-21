# Self-Service Membership — Idea Exploration

> **Status:** Pre-spec exploration (brainstormed 2026-06-21). Not yet a formal
> implementation plan. Use as reference before writing the full spec.

---

## What we're changing

Today, joining a village is **gated by an organizer**: a user files a join
request, a village admin approves it, and only then does a membership document
exist. Belonging requires someone's permission.

We're flipping that to **self-service**, and in doing so we untangle a knot:
"organizing" currently bundles *bringing a village into existence* with
*becoming the person who runs it*. We separate a village's life into three
independent layers.

### Motivation

- Lower friction — approval is a bottleneck, and many villages have no active
  organizer to approve anyone.
- Belonging to your own village shouldn't need permission.
- Empty/inactive villages can't form bottom-up when the only entry point is
  taking on the full organizer burden.

Membership is **not** considered low-stakes noise — it still means something
("this is my village") — so the change pairs open access with honest framing.

---

## The three-layer model

A village's life is three independent acts instead of one all-or-nothing
"organize":

| Layer | Who | Gate | Confers |
|---|---|---|---|
| **Belong** (member) | Any authenticated user | None — self-service | Seeing attendee **names** + the village **census** (unchanged) |
| **Start** (activate) | First villager of a dormant municipality | None — explicit "start this village" step | Brings the community into existence; makes it joinable |
| **Organize** (admin) | A member who is granted it | Request → superadmin approves (or promoted by an existing admin) | Census, news moderation, places/peñas, edit/cancel events |

"Organizer" stops being the gate to existence and becomes a role a member grows
into. A village can be alive and self-described by its members **before** anyone
formally runs it.

### What membership confers today (unchanged by this work)

Verified against `docs/business-rules.md` §2–§4 — membership is a thin
privacy/identity layer, **not** a gate on participation:

- **Members only:** see attendee *names* (vs. counts) in that village's events;
  have a census record (fill it; answers visible to co-members).
- **Already available to any logged-in user** (not membership-gated): register
  for events, post/comment/react on news, manage personas.

Because membership is thin, opening it up is genuinely low-risk. This work does
**not** change what membership unlocks — only how you get it.

---

## Flows

### Join (active village)

Tap **Join** → a **lean confirmation screen** whose single headline message is:

> *Joining says you consider this your village — it doesn't verify you live here.*

→ confirm → membership created immediately (`members/{uid}` with `role: 'user'`).
No request, no admin in the loop.

The confirmation stays deliberately minimal. Other consequences (names
visibility, census trigger, leaving) are **discoverable in context**, not
front-loaded — keeping friction low.

### Start (dormant municipality)

A municipality with no `community` shows **Start this village** instead of
**Join**. Tapping it → confirmation explaining you're bringing it to life and
can add its basic info → activates the community **and** adds you as a member
(`role: 'user'`). No organizer is created.

- The activated `community` is created with `adminUserId: null`, empty
  description/cover images, `profileForm: null`, `communityActive: true`.
- **Fast path:** the start screen also offers, in the same flow, an optional
  "I'd like to organize this village" → files an organizer request at the same
  time (still superadmin-approved later). Starting and asking to run it feels
  like one action.

### Info editing (wiki phase → consolidation)

While a village **has no organizer** (no member with `role: 'admin'`), **any
member** can edit basic info — description, cover photo (wiki-style). Once an
organizer is granted, that authority **consolidates to organizers**.

Census definition, news moderation, places, and peñas are **organizer-only at
all times** — never part of the wiki phase.

> "Has an organizer" = at least one member with `role: 'admin'` exists (and/or
> `community.adminUserId` is set). The exact predicate is a spec detail.

### Becoming an organizer + contextual hooks

- The organizer request stays **superadmin-approved**; existing admins can still
  promote members directly. The request **no longer creates the village** (it is
  already active) — it just grants admin rights on an active village.
- **Contextual hooks:** organizer-gated creation surfaces (places/*lugares*,
  peñas/organizations, census setup, …) show — when the village has no organizer
  — an explanatory empty state with a CTA:
  > *For your village to have [places/peñas], it needs an organizer. Here's what
  > being an organizer means…* → links to the organize request.

  This surfaces the organizer role *at the moment a missing organizer blocks
  something*, and uses that moment to explain the responsibility.

### Organizer control over members

- Admins keep the existing **expel** power (for spam/abuse/clearly-not-local).
- **No blocklist** — an expelled person can re-join freely. No approval to join.
- Voluntary **leave** is unchanged (cancels future registrations in that
  village, deletes census answers; last admin must promote before leaving).

---

## What gets retired

The **request-and-approve join** path is removed:

- Callables `requestJoinVillage` / `respondToJoinRequest`.
- The `joinRequests` subcollection and its Firestore rules.
- The request-join screen and the admin "join requests" screen.

Invite tokens (`InviteTokenDataModel`, `acceptInvite`) are a **separate,
already-deferred** concern and are **not** touched here.

---

## Layers we'll touch (sketch, not final)

- **`firestore.rules`** — allow a user to create their own membership on an
  active community (`isOwner(userId) && isCommunityActive(municipalityId)`);
  allow members to edit `community` basic-info fields while no admin exists;
  retire `joinRequests` rules.
- **Cloud Functions** (`functions/src/village/`) — new `joinVillage` (server
  guards: community active, not already member, idempotent); a start/activate
  callable that creates the community with `adminUserId: null` and adds the
  founder as a member, optionally filing an organizer request; repurpose the
  organizer-grant path to *grant admin on an active village* rather than create
  the community.
- **`packages/shared`** — models (`VillageMemberDataModel`, community shape with
  nullable `adminUserId`; retire `JoinRequestDataModel` usage) and services.
- **`apps/mobile`** — Join confirmation screen, Start-this-village screen (with
  organizer fast path), member-editable village-info surfaces during the wiki
  phase, contextual organizer-request hooks on places/peñas; remove request-join
  and admin-requests screens.
- **`docs/business-rules.md`** §2–§3 — rewrite the joining rules and the three
  membership/activation/organizer layers; update the trust model.
- **Tests** — `joinVillage` and activation callables (vitest emulator harness),
  `@firebase/rules-unit-testing` rules tests for self-create membership and
  member-edit-while-no-admin, and removal of now-dead join-request tests.

---

## Open questions for the spec

- Exact predicate for "village has no organizer" (member role scan vs.
  `community.adminUserId == null`) and how the wiki→consolidation transition is
  enforced in rules.
- Whether `community.adminUserId` becomes nullable everywhere or is replaced by
  an "admin members exist" check.
- Migration for existing `joinRequests` documents (likely: leave as-is / drop;
  no pending-request backfill needed since approval is going away).
- Precise copy for the join confirmation, start confirmation, and organizer-hook
  empty states (i18n keys in `packages/i18n/`).
