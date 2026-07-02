# Residence single source of truth — drop the barrio projection

## Goal

Make `persons.municipalityLinks` the single source of truth for barrio residency
for **all** persons (account and non-account alike), eliminating the duplicated
`member.barrioId` field and the `syncMemberBarrioToResidence` projection trigger's
upsert/validation path — keeping only the one piece that genuinely needs server
privilege.

## Context

Barrio residency shipped with membership as the source of truth for
account-holders and a Cloud Function projecting it into the person's
`municipalityLinks` (the query surface). See
[docs/decisions/per-village-barrio-membership.md](../../decisions/per-village-barrio-membership.md)
for the full rationale and the member-vs-resident distinction.

That design has two costs that are **self-inflicted by the duplication**, not
required by the product:

- `member.barrioId` is a pure duplicate — its only readers are the edit UI and the
  trigger itself. Nothing else consumes it.
- Editing barrio is eventually-consistent: the client writes the membership doc,
  a trigger later writes the person. Two copies, one lag.

A reanalysis of the rules and write paths found:

- Account-holders **can already** write their own `persons` doc directly
  (`persons` update rule allows `resource.data.userId == request.auth.uid`) — no
  rule change needed to let them edit `municipalityLinks`.
- Non-account persons **already** write `municipalityLinks` directly, unvalidated
  (`ResidenceLinksEditor`). So the trigger's barrio-approved validation only
  covers half the system; dropping it *equalizes* rather than newly weakens.
- The only job that truly needs admin privilege is the trigger's **delete
  branch**: when a village **admin** removes a member, the ex-member's residence
  link must be cleaned, and the admin cannot write another user's person doc.

## Design / approach

### Single source of truth

Delete `member.barrioId` from `VillageMemberData` and its builder/converter.
Barrio residency lives **only** in `persons.municipalityLinks`. Unify the two edit
surfaces (`MembershipBarrioList` for account-holders, `ResidenceLinksEditor` for
non-account) around one write path against the person doc.

### Join / leave become atomic client batches

Both the membership doc and the person doc are client-writable by the owner, so
join and self-leave become a single Firestore `writeBatch` — atomic, no
eventual-consistency window (strictly better than the trigger today):

- **Join** (`JoinVillageModal` → new `joinVillage`): batch { create
  `members/{uid}`, upsert `{municipalityId, barrioId}` into the caller's
  `persons.municipalityLinks` }.
- **Change barrio** (own profile): a single `persons` write (read-modify-write or
  `arrayRemove`+`arrayUnion` on the known entry).
- **Self-leave**: batch { delete `members/{uid}`, remove the matching
  `municipalityLinks` entry }.

### The one server-privileged case

When a **village admin** removes a member (or `acceptInvite`/admin SDK mutates
membership on someone's behalf), the ex-member's residence link still needs
cleanup by a privileged context. Pick one:

1. **Keep a minimal trigger** — same `syncMemberBarrioToResidence`, but reduced to
   *only* the delete branch (remove the `municipalityLinks` entry when a membership
   is deleted by anyone). Drops all the upsert + validation code.
2. **Self-healing reconcile** — no server code; when a user opens their residence
   editor, reconcile `municipalityLinks` against their current memberships and drop
   orphans. Cost: a user briefly shows as a resident of a village they were removed
   from (cosmetic, low stakes).
3. **Removal callable** — move `removeVillageMember` (admin path) into a callable
   that cleans both docs with the admin SDK. No net function reduction, but
   synchronous.

Lean **option 1** — it keeps the guarantee, deletes the duplication and the
eventual-consistency edit path, and shrinks the trigger to its load-bearing core.

### Validation

Barrio-approved validation moves off the (now-removed) account-holder trigger
path. Since the non-account path never validated, parity says accept unvalidated
client writes. If validation is later deemed worth it, the honest home is a
**shared validating callable** used by *both* account and non-account writes — not
a projection trigger, and not rules (an array can't be element-validated in rules).

## Open questions

- **Which cleanup option** (minimal trigger / self-heal / callable) — decide before
  promoting to `ready/`. Recommendation: option 1.
- **Backfill / migration:** `member.barrioId` currently holds live values on dev
  (and beta/prod). Before dropping the field, confirm every `member.barrioId` is
  already reflected in the corresponding `persons.municipalityLinks` (the trigger
  should guarantee this), then remove the field. Needs a per-env conformance check
  + backfill, mirroring `scripts/backfill-village-member-barrio.mjs` in reverse.
- **Member-write rule for `barrioId`:** once the field is gone, tighten the
  `members` update rule (currently allows `hasOnly(['profileAnswers',
  'profileCompletedAt', 'barrioId'])`) to drop `barrioId`.
- **`complete-profile.tsx` onboarding** currently calls `updateVillageMemberBarrio`
  for the first village — reroute it to the person write path.
