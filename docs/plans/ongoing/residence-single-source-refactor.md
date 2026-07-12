# Residence single source of truth — drop the barrio projection

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also read the `touch-service`, `guardrail-enforcement`, and `firebase-admin-dev` skills before the service/rules/backfill steps.

**Goal:** Make `persons.municipalityLinks` the single source of truth for barrio
residency for **all** persons (account and non-account alike), eliminating the
duplicated `member.barrioId` field and shrinking the `syncMemberBarrioToResidence`
projection trigger to the one branch that genuinely needs server privilege.

## Status

- **Updated:** 2026-07-09
- **Stage:** dev + beta deployed and migrated. Only the routine `beta → prod` code promotion remains (prod is empty — no backfill).
- **Branch:** merged to `develop` via PR #73 (`dc36986`); promoted to `beta` via PR #75 v0.3.0 (`a401f30`).
- **Done:** All code + docs shipped. CI fully green (incl. emulator suite). **Dev** deployed + migrated (16 member `barrioId` cleared; `check:dev-conformance` PASS). **Beta** deployed + migrated 2026-07-09 (1 member cleared, residence verified intact).
- **Next:** ride the next `beta → prod` promotion (code only; prod empty, no backfill). Then retire this plan (rationale already in `docs/decisions/per-village-barrio-membership.md`).
- **Blockers:** none. Validation decision resolved (accept unvalidated; shared callable is the named upgrade path).
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
- **Change barrio** (own profile, `MembershipVillageEditor`): a single `persons`
  write (read-modify-write, replacing the matching `municipalityLinks` entry via
  `buildResidenceLinks`).
- **Self-leave**: batch { delete `members/{uid}`, remove the matching
  `municipalityLinks` entry }. This now exists — `leaveVillage`
  (`villageMemberService`) implements the batch and is called from
  `MembershipVillageEditor`'s leave-confirmation flow.

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
- ~~**Building the self-leave UI.**~~ Done — `MembershipVillageEditor` wires the
  atomic self-leave batch via `leaveVillage`.
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
- [x] Route every residence-link write through `buildResidenceLinks` (client
      `joinVillage`/`updateResidenceBarrio`; server `residenceProjection` helper).
- [x] Make `joinVillage` an atomic `writeBatch` { member create, person link upsert };
      drop `barrioId`. `addVillageMember` removed (only caller was `joinVillage`).
- [x] Remove `updateVillageMemberBarrio`; add `personService.updateResidenceBarrio`.
- [x] Drop `barrioId` from `VillageMemberData` (schema/Input/builder), `UserMembership`,
      and `getUserMemberships`.
- [x] Vitest: join-batches-both-writes + no-`barrioId`-on-membership +
      `updateResidenceBarrio` upsert/clear/no-op (7 tests, green).
- [x] **(added)** `startVillage` + `respondToOrganizerRequest` project the residence
      link via the shared `residenceProjection` helper (create-side paths the plan
      missed); stale `barrioId: null` member seeds removed from functions tests.

### Stage 3 — Mobile: unify the edit surfaces
- [x] `MembershipBarrioList` reads the barrio from the person's `municipalityLinks`
      and writes via `updateResidenceBarrio` (person doc), not the member.
- [x] `JoinVillageModal` / `VillageDiscovery` / `VillageHomeBody` consume batched join
      — no change needed, `joinVillage`'s signature was preserved (batching is internal).
- [x] Drop `updateVillageMemberBarrio` from `complete-profile.tsx` → `updateResidenceBarrio`
      (also fixes the existing-person branch, which previously relied on the trigger).
- [x] `pnpm app:typecheck` green; jest green (81 tests). Stale `barrioId` member mock
      removed from `event/new.test.tsx`.

### Stage 4 — Migration + rules tightening (per env: dev → beta → prod)
- [x] Write `scripts/backfill-drop-member-barrio.mjs` (reconcile-then-delete,
      idempotent, project-id guard). Reconciles a missing person link from
      `member.barrioId` before deleting the field, so no residence is lost.
- [x] Tighten `firestore.rules` members owner-update `hasOnly` to drop `barrioId`;
      rewrite the `villageMemberRules` e2e tests (owner-can't-write-barrioId
      regression + admin non-role example switched off the dead field).
- [ ] **Post-deploy (NOT pre-merge):** run `pnpm check:dev-conformance`, then the
      backfill on dev, then conformance again. **Ordering matters** — the *old*
      deployed converter requires `barrioId`, so deleting it before the new code
      ships would crash old dev clients. Deploy first, backfill second.
- [ ] Deploy rules + functions to dev — CI auto-deploys on merge to `develop`
      (`firestore-deploy` skill for manual). Beta/prod ride CI + backfill at
      promotion time.

## Rollout status

| Step | Dev | Beta | Prod |
| --- | --- | --- | --- |
| Code + rules merged/deployed | ✅ | ✅ | ⬜ |
| `backfill-drop-member-barrio` run (post-deploy) | ✅ | ✅ | ✅ n/a |
| `check:dev-conformance` clean after backfill | ✅ | — | — |

Prod is **empty** (0 members, 0 persons) — no backfill needed there, ever. Beta
migrated 2026-07-09 after the v0.3.0 promotion deployed: 1 village member's
`barrioId` cleared, 0 person links needed reconciling (the sync trigger had kept
`municipalityLinks` current), residence verified intact. The only remaining step
is the routine `beta → prod` code promotion (no migration — prod is empty).

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked. **Deploy before backfill**
in every env (old converter requires `barrioId`).

### Stage 5 — Wrap-up
- [x] Update `_services-map.md` and CHANGELOG `[Unreleased]`; refreshed
      `docs/decisions/per-village-barrio-membership.md` to the single-source design.
- [x] Runnable CI gates green: `check:no-raw-firestore-refs`, `check:no-test-login-leak`,
      `typecheck` (shared/functions/i18n/mobile), `lint` (shared/functions), `build`.
      **`pnpm test` (emulator suite) pending a user run** — agent can't boot emulators.
- [ ] Open PR targeting `develop`; wait for CI (full `pnpm test`) + user merge.
- [ ] On merge: run the backfill (post-deploy, per env) per the Rollout table; then
      retire this plan (the durable rationale already lives in
      `docs/decisions/per-village-barrio-membership.md`).

## Notes for the implementer

- **Migration is safer than it looks:** `VillageMemberDataSchema` is a plain
  `z.object` (not `.strict()`), so dropping `barrioId` from the schema silently
  strips leftover values on read. No ordering hazard, no crash — but still delete the
  field per Delete > deprecate.
- **The exact-object array-contains match is the sharpest edge.** If a person
  disappears from a barrio list after this ships, the first suspect is a link written
  without `buildResidenceLinks`.
