# Membership, roles & audit trail

**Goal:** Make "founder vs admin" coherent across villages and organizations, move role transitions server-side, and record them in one auditable event log.

## Status

- **Updated:** 2026-07-04
- **Stage:** Phase 0 ✅ + Phase 1 ✅ done; Phase 2 (village audited role transitions) next.
- **Branch:** `feat/membership-roles-audit` (worktree `.claude/worktrees/membership-roles-audit`, based on `origin/develop`)
- **Done:**
  - Phase 0: `community.adminUserId` → `organizerId` across shared model + functions + mobile + seed scripts; `VillageFormSchema.adminUserId` renamed too. Backfill script `scripts/backfill-organizer-id.mjs` written (NOT yet run — rollout step). Shared vitest (501) + full typecheck + lint + mobile jest (275) green.
  - Phase 1: `membershipEvents` top-level collection — model, client/admin converters, typed refs, read-only `membershipEventService`, services-map row, rules block (admin read, all client writes denied), composite index (`municipalityId ASC, at DESC`), model unit test, rules e2e test. Shared build/typecheck/tests + no-raw-refs guard green.
- **Next:** Phase 2 — `functions/src/helpers/membershipAudit.ts` (`writeMembershipEvent`), `changeVillageMemberRole` callable + emulator test, `setVillageMemberRole` client wrapper, emit events at organizer approval, tighten village-member rules so `role` is function-owned (behavior change — see Blockers).
- **Blockers:** Phase 2.4 tightens `municipalities/{id}/members` rules so `role` can no longer be written client-side (create pinned to `role:'user'`; update forbids `role`). Confirm no mobile flow relies on a client-side admin-role member write before landing (grep found none). Emulator suites (`pnpm test:rules`, `pnpm test:functions`) must be run by the user.
- **Handoff:** Base checkout is on `main` (from recent promotion PRs) — do NOT switch it; all work is in the worktree on `feat/membership-roles-audit`. Emulator-booting suites are agent-forbidden; use per-package vitest for agent-side verification. Dev backfills autonomous (villa-events); beta/prod off-limits. After any shared-model edit, `pnpm --filter @cultuvilla/shared build` before functions typecheck (functions resolve shared via built `.d.ts`). Functions deps: `npm ci` in `functions/` (separate from root `pnpm install`).

## Rollout status

| Step | Dev | Beta | Prod |
|---|---|---|---|
| Phase 0 rename code | ⬜ | ⬜ | ⬜ |
| Phase 0 organizerId backfill | ⬜ | ⬜ | ⬜ |
| Phase 1 membershipEvents rules+index deployed | ⬜ | ⬜ | ⬜ |
| Phase 2 changeVillageMemberRole deployed | ⬜ | ⬜ | ⬜ |
| Phase 3 org migration deployed | ⬜ | ⬜ | ⬜ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked (note inline)

## Context

Villages and organizations are the same abstraction — a *membership group* (members with roles, one founder, a request→approval lifecycle) — but were implemented as two parallel subsystems that drifted:

| Concept | Organizations | Villages |
|---|---|---|
| Founder | `requestedBy: string` (plain, non-null) | `community.adminUserId: string \| null` — **overloaded**: founder + wiki-state signal + singleton latch, and **misnamed** (reads like "the admin", but authority is the role flag and there can be many admins) |
| Non-admin role | `'member'` | `'user'` |
| Promote to admin | `setOrgMemberRole()` — client write, **no callers today** | nothing — raw rules-gated client write |
| Audit of who-did-what | none | none |

Neither entity can have a *trustworthy* audit trail today because role changes are client-side writes: a client allowed to flip `role: 'admin'` can't be trusted to also honestly append "promoted by X at time T". Audit trails are only credible when written **server-side, atomically, by code the user can't bypass**. Wanting audit therefore forces role transitions behind Cloud Function callables — and once that exists for villages, it's exactly what orgs need. Build it once, for "a membership group", not twice.

The confusion that started this: `community.adminUserId` designates the *organizer* (founding admin) but grants no capability of its own (it appears nowhere in `firestore.rules`). All authority is `role == 'admin'` via `isVillageAdmin`. The organizer field only (1) latches "one organizer per village" and (2) signals the wiki phase (`null` ⇒ any member edits basic info, per `updateVillageInfo`).

## Design / approach

**The two `members` subcollections stay separate** — village members carry censo `profileAnswers`, `barrioId`, `trustedNewsAuthor` that org members don't. What unifies is the layer above storage: shared audit substrate + a server-side, audited role-transition path, instantiated for both scopes.

### 1. Honest founder pointer (village)

Rename `community.adminUserId` → `community.organizerId` (still `string | null`; `null` = wiki phase). It becomes the village twin of org `requestedBy`: pure attribution, never mistaken for authority. Authority stays the `role` flag for both entities. The wiki-phase state keeps deriving from `organizerId == null` (village-only; orgs have no wiki phase).

Org `requestedBy` is left as-is — renaming it for symmetry is churn with no clarity payoff, and orgs legitimately can't be founder-less (a village community can, during the wiki phase).

### 2. Shared audit substrate: top-level `membershipEvents`

A first-class top-level collection scoped by `municipalityId` (matches AGENTS.md invariant #3), append-only, **function-owned** (no client writes ever):

```ts
{
  scopeType: 'village' | 'org',
  scopeId: string,          // municipalityId (village) | orgId (org)
  municipalityId: string,   // village: == scopeId; org: the org's municipalityId
  actorUserId: string,      // who performed it (admin uid, or the approving super-admin)
  targetUserId: string,     // whose membership changed
  action: 'added' | 'removed' | 'role_changed' | 'organizer_set',
  fromRole: string | null,  // set on role_changed
  toRole: string | null,    // set on role_changed / added
  at: Timestamp,
}
```

- **Read:** `isVillageAdmin(municipalityId) || (scopeType=='org' && isOrgAdmin(scopeId)) || isAppAdmin()`. Scoping by `municipalityId` lets a village admin see all membership activity in their village — *including* role changes inside its orgs — for free, and gives super-admins a global view.
- **Write/update/delete:** `false` — only the Admin SDK inside callables/triggers writes here.
- Composite index: `municipalityId ASC, at DESC` (village activity feed). Add `scopeType ASC, scopeId ASC, at DESC` if a per-group history view lands.

### 3. Server-side, audited role transitions

New callables that check authority, mutate the role, and write the event in one transaction:

- **Village:** `changeVillageMemberRole({ municipalityId, targetUserId, role })` — authority `isVillageAdmin(caller) || app-admin`; writes `role_changed`. Guard: refuse to demote the current `organizerId` holder below admin (must transfer organizer first — out of scope for cut 1; just reject with a clear message).
- **Org (cut 2):** `changeOrgMemberRole({ orgId, targetUserId, role })` — mirror, authority `isOrgAdmin(caller) || app-admin`.

Client services (`setVillageMemberRole`, `setOrgMemberRole`) become thin `httpsCallable` wrappers (mirroring `respondToOrganizerRequest`), replacing direct `updateDoc`. **This is the answer to "how new admins are created": a single, audited callable per scope.**

Existing seed points also emit events (so the log is complete from day one): organizer approval → `organizer_set` + `added`/`role_changed`; org approval seeding `requestedBy` as admin → `added`; join-request approval → `added`.

### 4. Rules tightening (role becomes function-owned)

- **Village members:** keep the self-join create (owner, `role == 'user'`); **remove** the admin/app-admin ability to write `role` from the client (they now go through the callable). Removal stays client-gated for now (audited in cut 2).
- **Org members (cut 2):** same shape. Must preserve the two existing client paths — self-join `addOrgMember(orgId, uid)` (role `'member'`) and org-creation admin seed (`organizationService.ts:135`, `addOrgMember(..., 'admin')`), the latter moving server-side into the org-approval/creation flow.

## Phasing (village-first)

Village-first: it's what prompted this, it's low-risk (no client writes `role:'admin'` on villages today), and it proves the substrate before touching the working org flow. Org migration is a committed fast-follow in the same plan.

## Out of scope (deliberately)

- **Aligning role vocabulary** (`'user'` ↔ `'member'`) — cosmetic, extra backfill, defer.
- **Transfer-organizer flow** — cut 1 only *guards* against demoting the organizer; the transfer callable is a follow-up.
- **Audit read UI** — the collection + rules ship; a mobile "activity" screen is separate.
- **System-wide removal auditing** beyond making the collection ready for it.
- **Org self-join via `addOrgMember`** (`o/[orgId].tsx:63`): whether org joins should all go through `requestJoinOrganization` is a separate question; this plan preserves the existing direct self-join.

## File Structure

**Phase 0 — rename (village clarity)**
- Modify: `packages/shared/src/models/municipality/MunicipalityDataModel.ts` — `adminUserId` → `organizerId` in `VillageCommunitySchema`, `buildVillageCommunity`, `ActivateCommunityInput`.
- Modify: `packages/shared/src/services/municipalityService.ts` — the dotted-path setter.
- Modify: `functions/src/village/startVillage.ts`, `respondToOrganizerRequest.ts`, `updateVillageInfo.ts`, `requestOrganizeVillage.ts` — field name + comments.
- Modify: `apps/mobile/components/feature/VillageHomeBody.tsx:122-123` — the `noOrganizer` read.
- Modify: matching `functions/src/__tests__/**` + `packages/shared/test/**` fixtures.
- Create: `scripts/backfill-organizer-id.mjs` — copy `community.adminUserId` → `community.organizerId`, drop old key, on dev docs missing it.

**Phase 1 — `membershipEvents` substrate** (follows `add-firestore-collection` skill)
- Create: `packages/shared/src/models/membership/MembershipEventDataModel.ts` — Zod schema + builder.
- Create: `packages/shared/src/firebase/converters/membershipEventConverter.admin.ts` + `.client.ts`.
- Modify: `packages/shared/src/firebase/refs/admin.ts` + `refs/client.ts` — typed collection/doc refs.
- Create: `packages/shared/src/services/membershipEventService.ts` — client reads only (`getMembershipEvents(municipalityId)`).
- Modify: `packages/shared/src/services/index.ts`, `models/index.ts` — re-exports.
- Modify: `firestore.rules` — `membershipEvents` block (admin read, no client write) + shape helper.
- Modify: `firestore.indexes.json` — `municipalityId ASC, at DESC`.
- Modify: `packages/shared/src/services/_services-map.md`.
- Create: `packages/shared/test/membership/membershipEventModel.test.ts` + rules test under `packages/shared/test/e2e/`.

**Phase 2 — village audited role transitions**
- Create: `functions/src/village/changeVillageMemberRole.ts` — the callable.
- Create: `functions/src/helpers/membershipAudit.ts` — shared `writeMembershipEvent(tx, {...})` used by all writers.
- Modify: `functions/src/index.ts` — export the callable.
- Modify: `functions/src/village/respondToOrganizerRequest.ts` — emit `organizer_set` + member event.
- Modify: `packages/shared/src/services/villageMemberService.ts` — `setVillageMemberRole` becomes an `httpsCallable` wrapper; keep `addVillageMember`/`joinVillage` (self-join, role `'user'`).
- Modify: `firestore.rules` — village members: drop admin/app-admin client `role` writes.
- Create: `functions/src/__tests__/handlers/changeVillageMemberRole.test.ts`.

**Phase 3 — org migration onto substrate**
- Create: `functions/src/organizations/changeOrgMemberRole.ts` + export.
- Modify: `functions/src/organizations/respondToJoinRequest.ts`, org-approval — emit events; move the `organizationService.ts:135` client admin-seed server-side.
- Modify: `packages/shared/src/services/orgMemberService.ts` — `setOrgMemberRole` → callable wrapper.
- Modify: `firestore.rules` — org members: same tightening, preserve self-join create.
- Create: `functions/src/__tests__/handlers/changeOrgMemberRole.test.ts`.

**Phase 4 — docs**
- Modify: `AGENTS.md` — request-types/roles clarification (organizer vs admin; how admins are created).
- Create: `docs/decisions/membership-roles-and-audit.md` — on retire.

## Tasks

Each phase ends green (`pnpm check`) and is independently verifiable. Rules/index/function deploys to dev use the `firestore-deploy` skill; dev backfills are autonomous per AGENTS.md.

### Task 0.1: Rename `adminUserId` → `organizerId` in the model (RED/GREEN)
- [ ] Update `packages/shared/test/**` expectations referencing `adminUserId` to `organizerId`; run vitest → RED.
- [ ] Rename the field in `MunicipalityDataModel.ts` (schema key, builder, `ActivateCommunityInput.adminUserId?` → `organizerId?`).
- [ ] `pnpm --filter @cultuvilla/shared test` → GREEN.
- [ ] Commit `refactor(village): rename community.adminUserId → organizerId`.

### Task 0.2: Propagate rename through functions + mobile
- [ ] Update the 4 functions files + their `__tests__` fixtures; run functions tests → GREEN (user runs emulator suite).
- [ ] Update `VillageHomeBody.tsx` (`village.community?.organizerId == null`); `pnpm app:typecheck` → GREEN.
- [ ] `pnpm check` → GREEN. Commit.

### Task 0.3: Dev backfill
- [ ] Write `scripts/backfill-organizer-id.mjs` (mirror `scripts/backfill-municipality-namelower.mjs`): project-id guard, patch `municipalities` docs where `community != null && community.organizerId` unset → set from `community.adminUserId`, `FieldValue.delete()` the old key.
- [ ] Run it against dev; `pnpm check:dev-conformance` clean. Commit the script.

### Task 1.1: `MembershipEventData` model (RED/GREEN)
- [ ] Test in `packages/shared/test/membership/membershipEventModel.test.ts`: `buildMembershipEventData({...})` round-trips through the Zod schema; rejects unknown `action`. → RED.
- [ ] Write `MembershipEventDataModel.ts` with the schema in the design + `buildMembershipEventData`. → GREEN. Commit.

### Task 1.2: Converters + typed refs
- [ ] Add `.admin`/`.client` converters via `makeConverter`; add `membershipEventsCollection`/`membershipEventDoc` refs (admin + client). Re-export from `models/index.ts`.
- [ ] `pnpm --filter @cultuvilla/shared typecheck` GREEN. Commit.

### Task 1.3: Client read service + services-map
- [ ] `membershipEventService.getMembershipEvents(municipalityId)` — ordered `at desc`, converter-typed.
- [ ] Add row to `_services-map.md`. Commit.

### Task 1.4: Rules + index + rules test
- [ ] Add `membershipEvents` rules block: `allow read: if isVillageAdmin(resource.data.municipalityId) || (resource.data.scopeType == 'org' && isOrgAdmin(resource.data.scopeId)) || isAppAdmin();` write/update/delete `false`.
- [ ] Add composite index `municipalityId ASC, at DESC` to `firestore.indexes.json`.
- [ ] Rules test under `packages/shared/test/e2e/`: village admin can read own-village events; non-admin denied; any client create denied.
- [ ] `pnpm check` GREEN. Deploy rules+indexes to dev (`firestore-deploy`). Commit.

### Task 2.1: Shared `writeMembershipEvent` helper
- [ ] `functions/src/helpers/membershipAudit.ts`: `writeMembershipEvent(tx, db, event)` that `tx.set`s a new `membershipEventDoc` with `at: FieldValue.serverTimestamp()`. Unit-test the field mapping.
- [ ] Commit.

### Task 2.2: `changeVillageMemberRole` callable (RED/GREEN)
- [ ] Test `functions/src/__tests__/handlers/changeVillageMemberRole.test.ts`: (a) village admin promotes user→admin, member role updated + `role_changed` event written; (b) non-admin caller → `permission-denied`; (c) demoting the `organizerId` holder → `failed-precondition`. → RED.
- [ ] Implement the callable (authority check via member/admin docs like `updateVillageInfo`; transaction: read organizer, guard, update role, `writeMembershipEvent`). Export from `index.ts`. → GREEN. Commit.

### Task 2.3: Client wrapper + emit events at organizer approval
- [ ] `villageMemberService.setVillageMemberRole` → `httpsCallable('changeVillageMemberRole')`.
- [ ] In `respondToOrganizerRequest.ts`, `writeMembershipEvent` (`organizer_set`, plus `added`/`role_changed` for the seeded admin) inside the existing transaction. Update its test.
- [ ] `pnpm check` GREEN. Commit.

### Task 2.4: Tighten village member rules
- [ ] In `firestore.rules` `municipalities/{id}/members`: remove the admin/app-admin `role`-write allowance; keep owner self-join (`role == 'user'`) + owner profile/barrio update + delete. Update rules test to assert a client `role: 'admin'` update is denied.
- [ ] `pnpm check` GREEN. Deploy dev. Commit.

### Task 3.1: `changeOrgMemberRole` callable (RED/GREEN)
- [ ] Test mirroring 2.2 (org admin promotes; non-admin denied). → RED → implement → GREEN. Export. Commit.

### Task 3.2: Org seed points emit events + move client admin-seed server-side
- [ ] `respondToJoinRequest.ts`: `writeMembershipEvent('added')`. Org-approval path: seed `requestedBy` as admin server-side + `added` event; remove the client `addOrgMember(..., 'admin')` at `organizationService.ts:135`.
- [ ] `orgMemberService.setOrgMemberRole` → callable wrapper. Preserve the self-join `addOrgMember(orgId, uid)` (role `'member'`) client path.
- [ ] Update org rules to make `role` function-owned, preserving self-join create. Update tests.
- [ ] `pnpm check` GREEN. Deploy dev. Commit.

### Task 4.1: Docs
- [ ] AGENTS.md: under the request-types section, add the organizer-vs-admin clarification and "new admins are created via `changeVillageMemberRole`/`changeOrgMemberRole` (audited)". Note the `membershipEvents` collection.
- [ ] `pnpm check` GREEN. Commit.
