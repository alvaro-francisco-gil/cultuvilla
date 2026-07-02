# Per-village barrio & the member-vs-resident split

A user can belong to multiple villages and set a distinct barrio in each. The
non-obvious part is *where* barrio lives and why a Cloud Function keeps two copies
in sync — this file records that, because neither is inferable from reading a
single service.

## Problem

Barrio residency has to satisfy two facts that pull in opposite directions:

1. **The residents-by-barrio list must query one collection.** It is a single
   `array-contains` query — `getPersonsByBarrio` →
   `where('municipalityLinks', 'array-contains', { municipalityId, barrioId })`
   over **`persons`**. That collection is the only place where *all* residents
   coexist: account-holders **and** non-account persons (deceased relatives,
   historical figures, family members someone else added). Non-account persons
   have no membership doc, so the query cannot read the members subcollection.
   `persons.municipalityLinks` is therefore the non-negotiable read/query surface.

2. **For account-holders, barrio should be coupled to membership.** Barrio is a
   property of *belonging* to a village — joining makes you a resident, leaving
   drops you. That lifecycle lives on `municipalities/{id}/members/{uid}`, not on
   the person.

## Decision

Two entities, two roles — **member ≠ resident**:

| | Lives on | Who qualifies |
|---|---|---|
| **Member** | `members/{uid}` (keyed by Firebase uid) | Account-holders only — a non-account person has no uid, so cannot have a membership doc |
| **Resident** | a `persons.municipalityLinks` entry | Anyone with a residence link — account or not |

- **Account-holders:** the *editable source of truth* for barrio is
  `members/{uid}.barrioId` (`null` = "Todo el pueblo"). A Firestore trigger,
  `syncMemberBarrioToResidence`, **projects** it into that user's
  `persons.municipalityLinks` so the residents query stays consistent. The trigger
  also validates the barrio is an *approved* barrio of that municipality
  (normalizing stale/foreign/tampered values to `null`) and removes the residence
  link when the membership is deleted.
- **Non-account persons:** barrio is written **directly** to
  `persons.municipalityLinks` (via `ResidenceLinksEditor`); there is no membership
  to drive it, and no validation trigger.

So a deceased great-grandparent is a **resident** of a barrio (appears in
`getPersonsByBarrio`) but never a **member** (no role, no admin, absent from
member counts). That distinction is deliberate — "residents of barrio X" is a
broader set than "members living in barrio X".

## Key points

- `member.barrioId` has **no consumer** other than the edit UI (showing the
  current value) and the trigger — it is a pure duplicate of the person's link,
  the price of choosing membership as the source of truth.
- The trigger's genuinely load-bearing job is the **delete branch**: when a
  village admin removes a member, the ex-member's `persons.municipalityLinks` must
  be cleaned, and the admin **cannot** write another user's person doc (rules gate
  `persons` update to `userId == request.auth.uid`). Only an admin-SDK context
  can. Self-service join/leave/edit do **not** need the trigger — those docs are
  all client-writable by the owner.
- Barrio-approved validation is **already absent** on the non-account path
  (`ResidenceLinksEditor` writes unvalidated). The trigger only tightens the
  account path, so the two halves are not equally strict.
- Firestore rules cannot enforce "every `municipalityLinks` entry maps to a real
  membership + an approved barrio" — it is an arbitrary-length **array**, and
  rules cannot iterate an array doing a `get()` per element. Cross-doc validation
  of residence therefore can only live in a trigger or a callable, never in rules.

## Revisit when

The duplication (`member.barrioId`) and the eventual-consistency edit path exist
only because membership was chosen as the source of truth. Collapsing to
`persons.municipalityLinks` as the *single* source — atomic client `writeBatch`
for join/leave, a minimal trigger (or callable) kept only for admin-initiated
removal cleanup — would remove both. See
[docs/plans/ideas/residence-single-source-refactor.md](../plans/ideas/residence-single-source-refactor.md).
Revisit if the projection ever drifts under load, or if the account/non-account
edit split (`MembershipBarrioList` vs `ResidenceLinksEditor`) becomes a
maintenance burden.
