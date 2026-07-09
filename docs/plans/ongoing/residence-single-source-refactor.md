# Residence single source of truth — drop the barrio projection

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also read the `touch-service`, `guardrail-enforcement`, and `firebase-admin-dev` skills before the service/rules/backfill steps.

**Goal:** Make `persons.municipalityLinks` the single source of truth for barrio
residency for **all** persons (account and non-account alike), eliminating the
duplicated `member.barrioId` field and shrinking the `syncMemberBarrioToResidence`
projection trigger to the one branch that genuinely needs server privilege.

## Status

- **Updated:** 2026-07-09
- **Stage:** Stage 2 — shared single source + atomic join
- **Branch:** `refactor/residence-single-source` (worktree `.claude/worktrees/residence-single-source`)
- **Done:** Stage 1 — acceptInvite projects the residence link (new + existing user); trigger reduced to delete-only (`onDocumentDeleted`); trigger test rewritten; new acceptInvite test added. Functions typecheck + lint green.
- **Next:** drop `barrioId` from `VillageMemberData` + `UserMembership`; make `joinVillage` an atomic batch via `buildResidenceLinks`; remove `updateVillageMemberBarrio`, add change-barrio person-write path; vitest.
- **Blockers:** `pnpm test:functions` must be run by the user (agent can't boot emulators). Validation decision resolved (accept unvalidated; shared callable is the named upgrade path).
- **Handoff:** Work happens in the worktree — session cwd is the primary checkout, so use absolute worktree paths. `pnpm test`/emulator suites are off-limits to the agent; rely on `pnpm typecheck` + non-emulator vitest, and hand emulator/functions test runs to the user. Every residence-link write MUST go through `buildResidenceLinks` (exact `{municipalityId,barrioId}` shape for the array-contains query).

## Context

Barrio residency shipped with membership as the source of truth for
account-holders and a Cloud Function projecting it into the person's
`municipalityLinks` (the query surface). See
[docs/decisions/per-village-barrio-membership.md](../../decisions/per-village-barrio-membership.md)
for the full rationale and the member-vs-resident distinction, and
[docs/decisions/village-censo.md](../../decisions/village-censo.md) for why the
residents list matters.

That design has two costs that are **self-inflicted by the duplication**, not
required by the product:

- `member.barrioId` is a near-pure duplicate. Its value is read only by the trigger,
  by `MembershipBarrioList` (the edit UI), and by `getUserMemberships`
  (`UserMembership.barrioId`) — and **no consumer of `getUserMemberships` actually
  reads `.barrioId`**. So it is behaviourally dead weight outside the edit screen.
- Editing barrio is eventually-consistent: the client writes the membership doc, a
  trigger later writes the person. Two copies, one lag.

A reanalysis of the rules and write paths (verified against current code) found:

- Account-holders **can already** write their own `persons` doc directly — the
  `persons` update rule allows `resource.data.userId == request.auth.uid`
  ([firestore.rules:757](../../../firestore.rules)) with no field-level restriction.
  No rule change is needed to let them edit `municipalityLinks`.
- Non-account persons **already** write `municipalityLinks` directly, unvalidated
  (via `ResidenceLinksEditor` → `updatePerson`). So the trigger's barrio-approved
  validation only covers half the system today; dropping it **equalizes** rather
  than newly weakens.
- The trigger has **two** privileged jobs, not one (the original analysis missed the
  create side):
  1. **Delete-cleanup:** when a village **admin** removes a member, the ex-member's
     residence link must be cleaned, and the admin cannot write another user's
     person doc.
  2. **Invite-accept create:** `acceptInvite` creates a membership server-side and,
     for new users, a person doc via `buildPersonData` — which does **not** seed
     `municipalityLinks`. Today the invited member gets their residence link only
     because the trigger's upsert branch fires on member-create. Drop that branch
     without compensating and **invited members become residents-of-nowhere** —
     silently absent from `getPersonsByBarrio`.

## Design / approach

### Single source of truth

Delete `member.barrioId` from `VillageMemberData`, its builder, its `Input`, and its
`UserMembership` projection. Barrio residency lives **only** in
`persons.municipalityLinks`. Unify the two edit surfaces (`MembershipBarrioList` for
account-holders, `ResidenceLinksEditor` for non-account) around one write path
against the person doc.

### All link writes go through `buildResidenceLinks`

`getPersonsByBarrio` is an **exact whole-object `array-contains`** match —
`where('municipalityLinks', 'array-contains', { municipalityId, barrioId })`
([personService.ts:60](../../../packages/shared/src/services/personService.ts)). A
stored element with an extra key or a wrong `null` **silently vanishes** from the
residents list. Today the trigger is the single constructor of this shape; moving
writes client-side spreads that invariant across every write site. **Invariant:**
every residence-link write — client or server — constructs the entry via
`buildResidenceLinks` ([PersonDataModel.ts:109](../../../packages/shared/src/models/person/PersonDataModel.ts)),
so the array-contains shape can never drift. This is the load-bearing safeguard of
the whole refactor.

### Join / change-barrio / self-leave become atomic client batches

All three docs are client-writable by the owner, so these become a single Firestore
`writeBatch` — atomic, no eventual-consistency window (strictly better than the
trigger):

- **Join** (`JoinVillageModal` → `joinVillage`): batch { create `members/{uid}`
  (no `barrioId`), upsert the `buildResidenceLinks` entry into the caller's
  `persons.municipalityLinks` }. The caller's person doc must exist at join time —
  true for onboarding (created in the same flow) and for any later village join.
  Use `set(..., { merge: true })` semantics or a read-modify-write so a missing doc
  doesn't fail the batch.
- **Change barrio** (own profile, `MembershipBarrioList`): a single `persons` write
  (read-modify-write, replacing the matching `municipalityLinks` entry via
  `buildResidenceLinks`).
- **Self-leave**: batch { delete `members/{uid}`, remove the matching
  `municipalityLinks` entry }. (No self-leave UI exists today — `removeVillageMember`
  has no caller — so this is forward-looking; wire the batch when the leave flow
  lands.)

### The two server-privileged cases

Both keep admin-SDK code because the acting party cannot write the target person doc
client-side:

1. **Admin-remove → minimal delete-only trigger.** Reduce
   `syncMemberBarrioToResidence` to *only* the delete branch: when a membership doc
   is deleted, remove the matching `municipalityLinks` entry from the linked person.
   Drop all upsert + barrio-approval-validation code. This double-fires harmlessly on
   self-leave (the entry is already gone → idempotent JSON-equality skip already in
   the trigger).
2. **Invite-accept → project inside `acceptInvite`.** In the same transaction that
   creates the membership, write the person's `municipalityLinks` via
   `buildResidenceLinks(municipalityId, null)` (invites join at whole-village level —
   `barrioId: null`). This replaces the create-side projection the trigger used to
   do.

### Validation — accept unvalidated, name the upgrade path

Dropping the trigger drops its barrio-approved validation. **Decision: accept
unvalidated client writes** (parity with the already-unvalidated non-account path,
and consistent with the direct-client-write self-service model in
[docs/decisions/self-service-membership.md](../../decisions/self-service-membership.md)).
The honest client can only pick approved barrios from the picker; only a malicious
client can write a bad/foreign link, and the blast radius is cosmetic pollution of
one residents list, reversible.

**Upgrade path (revisit-when):** if the censo ever needs to be trustworthy by
construction, the honest home is a **single shared validating callable used by
*both* account and non-account writes** — not a projection trigger, and not rules
(an array can't be element-validated in rules). Do not add per-path validation; it
only re-introduces the asymmetry this refactor removes.

## Out of scope

- **A validating callable now.** Deferred to the upgrade path above.
- **Building the self-leave UI.** The atomic self-leave batch is specified but only
  wired if/when a leave flow is added.
- **Non-barrio census fields.** `profileAnswers` / `profileCompletedAt` stay on the
  membership doc, untouched.

## File Structure

**Modify:**

- `packages/shared/src/models/municipality/VillageMemberDataModel.ts` — drop
  `barrioId` from schema, `Input`, and `buildVillageMemberData`.
- `packages/shared/src/services/villageMemberService.ts` — remove
  `updateVillageMemberBarrio`; drop `barrioId` from `addVillageMember` / `joinVillage`
  / `UserMembership` / `getUserMemberships`; make `joinVillage` an atomic batch that
  also writes the person link.
- `packages/shared/src/services/personService.ts` — helper for the change-barrio /
  self-leave person write if one doesn't already fit (route through
  `buildResidenceLinks`).
- `functions/src/village/syncMemberBarrioToResidence.ts` — reduce to delete-only.
- `functions/src/village/acceptInvite.ts` — write `municipalityLinks` via
  `buildResidenceLinks` in the create transaction.
- `apps/mobile/components/feature/MembershipBarrioList.tsx` — write the person doc
  instead of `updateVillageMemberBarrio`.
- `apps/mobile/components/feature/JoinVillageModal.tsx` /
  `apps/mobile/components/feature/VillageDiscovery.tsx` /
  `apps/mobile/components/feature/VillageHomeBody.tsx` — consume the batched
  `joinVillage`.
- `apps/mobile/app/(onboarding)/complete-profile.tsx` — drop the
  `updateVillageMemberBarrio` call (the person link is already written via
  `buildResidenceLinks`).
- `firestore.rules` — tighten the members owner-update `hasOnly` to drop `barrioId`
  (only after the field is gone).
- `packages/shared/src/services/_services-map.md` — reflect the removed
  `updateVillageMemberBarrio` and the batched join.

**Create:**

- `scripts/backfill-drop-member-barrio.mjs` — idempotent, per-env: verify each
  `member.barrioId` is already reflected in the person's `municipalityLinks`, then
  `FieldValue.delete()` the field. Mirror `scripts/backfill-village-member-barrio.mjs`
  in reverse.

**Delete:** none (the trigger shrinks, it isn't removed).

**Tests to update/add:**

- `functions/src/__tests__/handlers/syncMemberBarrioToResidence.test.ts` — rewrite
  for delete-only behaviour.
- `acceptInvite` test — assert the person link is written on invite-accept.
- `packages/shared/test/` (vitest) — `joinVillage` batches both writes with the
  correct `buildResidenceLinks` shape; `getUserMemberships` no longer carries
  `barrioId`.

## Tasks

### Stage 1 — Server: preserve both privileged paths
- [x] Add `municipalityLinks` projection (via `buildResidenceLinks(id, null)`) to the
      `acceptInvite` create transaction. (New user: via `buildPersonData`; existing
      user: read-in-tx + upsert.)
- [x] Add an `acceptInvite` test asserting the residence link is written (new +
      existing user, plus already-member no-dupe). New file — none existed before.
- [x] Reduce `syncMemberBarrioToResidence` to delete-only (`onDocumentDeleted`).
- [x] Rewrite `syncMemberBarrioToResidence.test.ts` for delete-only.
- [ ] `pnpm test:functions` green. — **needs the user to run** (emulator suite;
      agent is not permitted to boot emulators). Typecheck + lint pass.

### Stage 2 — Shared: single source + atomic join
- [ ] Route every residence-link write through `buildResidenceLinks` (audit call
      sites).
- [ ] Make `joinVillage` an atomic `writeBatch` { member create, person link upsert };
      drop `barrioId` from `addVillageMember` / `joinVillage`.
- [ ] Remove `updateVillageMemberBarrio`; add the change-barrio person-write path.
- [ ] Drop `barrioId` from `VillageMemberData` (schema/Input/builder), `UserMembership`,
      and `getUserMemberships`.
- [ ] Vitest: join-batches-both-writes + no-`barrioId`-on-membership.

### Stage 3 — Mobile: unify the edit surfaces
- [ ] `MembershipBarrioList` writes the person doc (change-barrio path), not the member.
- [ ] `JoinVillageModal` / `VillageDiscovery` / `VillageHomeBody` consume batched join.
- [ ] Drop `updateVillageMemberBarrio` from `complete-profile.tsx`.
- [ ] `pnpm app:typecheck` + `pnpm app:test` green.

### Stage 4 — Migration + rules tightening (per env: dev → beta → prod)
- [ ] Write `scripts/backfill-drop-member-barrio.mjs` (verify-then-delete, idempotent,
      project-id guard).
- [ ] Run `pnpm check:dev-conformance` before; run backfill on dev; run conformance
      after. (Non-strict converter means leftover `barrioId` is stripped on read — no
      crash window — but delete it per Delete > deprecate.)
- [ ] Tighten `firestore.rules` members owner-update `hasOnly` to drop `barrioId`;
      update the rules test.
- [ ] Deploy rules + functions to dev (see `firestore-deploy` skill). Beta/prod ride
      CI + explicit backfill at promotion time.

### Stage 5 — Wrap-up
- [ ] Update `_services-map.md` and CHANGELOG `[Unreleased]`.
- [ ] `pnpm check` green; open PR targeting `develop`.
- [ ] On merge: retire this plan; extract the member-vs-resident consolidation into
      `docs/decisions/` (or fold into the existing
      `per-village-barrio-membership.md`).

## Notes for the implementer

- **Migration is safer than it looks:** `VillageMemberDataSchema` is a plain
  `z.object` (not `.strict()`), so dropping `barrioId` from the schema silently
  strips leftover values on read. No ordering hazard, no crash — but still delete the
  field per Delete > deprecate.
- **The exact-object array-contains match is the sharpest edge.** If a person
  disappears from a barrio list after this ships, the first suspect is a link written
  without `buildResidenceLinks`.
