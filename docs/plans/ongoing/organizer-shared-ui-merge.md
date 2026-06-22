# Organizer / villager shared-UI merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. This is one mega-plan covering the whole feature; work it phase by phase, top to bottom.

**Goal:** Delete the separate `/village/[villageId]/admin/` area and fold every organizer task onto the shared village screens, so a user's **role changes a screen's behaviour** rather than which screen they see — villagers propose/consume, organizers commit/approve/author.

**Architecture:** Three interaction patterns. (1) **Propose-pending** — everyone can add; a villager's add lands as `pending` and is visible to all, an organizer's commits live, organizers approve/reject, proposers edit/withdraw their own pending (Places, Barrios, Organizations). (2) **Role-mode** — same screen, role picks capability, no proposals (Census: author vs answer; Community header: edit vs view). (3) **Shared view + drill-in console** — one shared detail screen, organizer gets light inline affordances plus a dedicated management route (Events). Enforcement lives in `firestore.rules` (mirroring `occupationProposals` / `organizations`), not just the UI.

**Tech Stack:** TypeScript, Zod, Firebase Web SDK, `@firebase/rules-unit-testing` + Firestore emulator, Vitest (shared) / Jest + @testing-library/react-native (mobile), Expo Router, NativeWind.

## Status

- **Updated:** 2026-06-22
- **Stage:** ALL 8 phases implemented on the branch. Not yet deployed to dev or merged. Rules for places/barrios + events still need `firestore-deploy` to dev; the two event callables (`addWalkInRegistration`, plus the extended `registerToEvent`) need a functions deploy.
- **Final verification (all green):** shared unit 385, mobile 114, rules e2e 149, functions 81; shared/functions/mobile/i18n typecheck clean; `pnpm lint` clean.
- **Events decisions (per user):** built everything at once — no v1/v2 defer. Phones live in an organizer-only `events/{id}/registrationContacts/{regId}` subcollection (written by callables, read-gated by `isEventOrganizer`). Walk-ins are organizer-created registrations with empty `userId`/`personId` via the `addWalkInRegistration` callable. `draft` status dropped (legacy coerces to `published` on read via `z.preprocess`).
- **Phase 3 note:** `OrganizationsManager` added (villager proposes peña/asociación → pending; organizer auto-approves via `requestOrganization`+`approveOrganization`). Org rules forbid member edit/withdraw, so proposers get no such affordance. Member-level `/village/[id]/organizations` now the shared manager; `/admin/organizations` is a wrapper. Tab routes everyone to the shared screen. **Pending-visibility (final, unified across all propose-pending domains):** approved items are public; a pending item is visible only to its **proposer** and to **organizers**; rejected items are hidden from lists. Implemented as one shared UI filter `apps/mobile/lib/proposals.ts#isProposalVisible(status, ownerId, {canManage, uid})`, applied in `PlacesManager`/`BarriosManager`/`OrganizationsManager` and the village tab. This is UI filtering only — data isn't sensitive (rules allow public reads); the point is not to flood the community with unreviewed content while letting proposers track their own.
- **Branch:** repo `worktree-organizer-shared-ui-merge` (worktree `.claude/worktrees/organizer-shared-ui-merge`). Not merged to main.
- **Done:** Phase 1 — model/services/rules (green: model/unit 382, rules e2e 143, integration 11). Phase 2 — `useEntityCapabilities` hook, `ProposableListItem`+`PendingBadge`, `PlacesManager`/`BarriosManager`, member-accessible `/village/[id]/places|barrios` routes, admin screens reduced to wrappers, village tab routes everyone + shows pending badges. New mobile tests green (4 suites: hook, item, both managers). Commits `751ee5e`,`1e0f527`,`fdb6a38`,`c343443`,`75ce648`,`32d8136`.
- **Next:** Deploy rules + functions to dev (`firestore-deploy`), then verify on device and merge the branch. (8.2 was a no-op: requests/invite-tokens screens were already absent from the admin group.)
- **Blockers:** none — the two event open questions are resolved (see Events decisions above).
- **Pre-existing breakage — FIXED:** mobile typecheck (`getOrgMemberCount` was imported but never defined → added it to `orgMemberService`) and 3 `village.test.tsx` cases (the test didn't mock `eventService`/`orgMemberService`). Mobile suite now 99/99, typecheck exit 0.
- **Handoff:** emulator tests from repo root (`pnpm test:integration`, `pnpm test:rules`). Worktree setup needed `npm --prefix functions install` + `pnpm --filter @cultuvilla/shared build` before the emulator harness builds functions. Mobile tests: `pnpm app:test`. Mobile has no lint script (only shared+functions are linted); commit subjects must be lowercase (commitlint rejects PascalCase). Rules NOT deployed to dev yet.

## Rollout status

| # | Phase | Code | Tests | Rules→dev | Merged |
|---|---|---|---|---|---|
| 1 | Places & Barrios — backend (model/rules/service) | ✅ | ✅ | ⬜ | ⬜ |
| 2 | Capability hook + propose-pending UI + merge Places/Barrios screens | ✅ | ✅ | — | ⬜ |
| 3 | Organizations adopt the shared primitives | ✅ | ✅ | — | ⬜ |
| 4 | Census role-mode merge (author vs answer) | ✅ | ✅ | — | ⬜ |
| 5 | Community-header role-mode merge (edit vs view) | ✅ | ✅ | — | ⬜ |
| 6 | Events v1 — shared detail + organize console (edit/cancel/roster/delete) | ✅ | ✅ | ⬜ | ⬜ |
| 7 | Events v2 — check-in, walk-in, organizer-gated phones | ✅ | ✅ | ⬜ | ⬜ |
| 8 | Delete the village `/admin/` route group | ✅ | ✅ | — | ⬜ |

Legend: ⬜ pending · ✅ done · — n/a

## Global Constraints

- Package manager `pnpm`. Emulator-backed tests run from **repo root**: `pnpm test:integration`, `pnpm test:rules`. Model/unit: `pnpm shared:test`. Mobile: `pnpm app:test`. Lint: `pnpm shared:lint`.
- Proposal status enum is exactly `['pending','approved','rejected']`. New nullable fields use `.nullable().default(null)`; `status` uses `.default('approved')` so legacy docs read as approved (no migration).
- "Organizer" = `isVillageAdmin(municipalityId) || isAppAdmin()` everywhere **except events**, where it is `isOrgMember(event.organizationId) || isVillageAdmin || isAppAdmin`.
- Model build helpers stamp `new Date()`; service `update` calls use `serverTimestamp()` (updateDoc bypasses the converter).
- i18n: every user-facing string via `useT()` / message catalogs (`i18n-add-string` skill). No hardcoded Spanish outside dev-only admin surfaces.
- Mobile-web compat: no `className` on `Animated.*`; branch `Alert.alert` per `Platform.OS`; avoid `Modal`/`Picker` (use chip rows) — see `mobile-web-compat` skill.
- Rules/services for new collections follow `add-firestore-collection` + `guardrail-enforcement`.

## Out of scope (separate plans)

- **Direct join** (remove join-request approval) → `docs/plans/ideas/self-service-membership.md` + `feat+self-service-membership` worktree.
- **Single invite link** (retire multi-token) → greenfield, own plan.
- **Villager-proposed edits to existing approved items** — v1 proposals are new-items-only; editing an approved place/barrio stays organizer-only-direct.
- **Member role management / removing members**.

---

## Phase 1 — Places & Barrios backend foundation ✅ DONE

Shipped in commits `751ee5e`, `1e0f527`, `fdb6a38`. Full TDD detail is in those commits; summary:

- [x] `ProposalStatusSchema` + `status`/`proposedBy`/`approvedBy`/`decidedAt` on `PlaceDataSchema` & `BarrioDataSchema`; `build*Data` default `pending`; legacy docs read as `approved`/`null`. (`MunicipalityDataModel.ts`, test `municipalityProposals.test.ts`)
- [x] Services `proposePlace`/`proposeBarrio` (pending, carry `proposedBy`), `approvePlace`/`approveBarrio` (→approved + `serverTimestamp`), `rejectPlace`/`rejectBarrio` (→rejected, `approvedBy:null`); `createPlace`/`createBarrio` route through builders (organizer direct → approved). (`municipalityService.ts`, test `municipalityProposalsIntegration.test.ts`)
- [x] `firestore.rules`: `isValidPlaceProposalCreate` / `isValidBarrioProposalCreate`; both match blocks allow member-pending create (own uid), organizer/app-admin direct create, organizer status transitions, proposer self edit/withdraw while pending. (tests `placeProposalRules.test.ts`, `barrioProposalRules.test.ts`)

---

## Phase 2 — Capability hook + propose-pending UI + merge Places/Barrios screens

**Goal:** Villagers and organizers use the same Places and Barrios screens on the shared village surface; the screen reveals role-appropriate affordances; the `/admin/places` and `/admin/barrios` routes are retired.

**Files:**
- Create: `apps/mobile/lib/auth/useEntityCapabilities.ts` — `{ canManage, canApprove, uid, loading }` for a municipality (composes `useAuth` + `useIsAppAdmin` + `isVillageAdmin`, mirroring the `admin/_layout.tsx` pattern).
- Create: `apps/mobile/components/feature/proposable/PendingBadge.tsx`, `ProposableListItem.tsx` (renders item + role-driven actions: organizer → approve/reject + edit/delete; proposer → edit/withdraw; others → read-only with pending badge), `ProposeForm.tsx` (the add form, labelled "propose" vs "add" by capability).
- Create: shared screen components `apps/mobile/components/feature/PlacesManager.tsx`, `BarriosManager.tsx` (the merged list+form, parameterised by capabilities), reused on the public village surface.
- Modify: the village screen(s) under `apps/mobile/app/village/[villageId]/` to mount `PlacesManager`/`BarriosManager` for everyone (was organizer-only under `/admin/`).
- Modify: `apps/mobile/app/village/[villageId]/admin/places.tsx`, `admin/barrios.tsx` — reduce to thin wrappers over the shared managers (deleted entirely in Phase 8).
- Tests: `apps/mobile/lib/auth/__tests__/useEntityCapabilities.test.tsx`; `apps/mobile/components/feature/__tests__/ProposableListItem.test.tsx` (role → action visibility); `PlacesManager.test.tsx` / `BarriosManager.test.tsx` (villager add calls `proposePlace`; organizer add calls `createPlace`; organizer sees approve on a pending row).

**Tasks (write tests first; mock services with the `LiveAvatar.test.tsx` jest-mock pattern):**

- [x] **2.1 `useEntityCapabilities` hook** — test: app-admin → `canManage/canApprove true`; village admin → true; plain member → false; unauth → false, `loading` resolves. Implement composing the three auth sources. Commit.
- [x] **2.2 `ProposableListItem` + `PendingBadge`** — test: organizer sees Approve/Reject on a `pending` item and Edit/Delete on approved; proposer of a pending item sees Edit/Withdraw; a stranger sees only the pending badge, no actions. Implement presentational component driven by `{ capabilities, item, onApprove, onReject, onEdit, onDelete }`. Commit.
- [x] **2.3 `ProposeForm`** — test: button label is `propose` when `!canManage`, `add` when `canManage`; submit fires the injected handler with trimmed fields. Implement. Commit.
- [x] **2.4 `PlacesManager`** — test: villager submit → `proposePlace(villageId, {...,proposedBy:uid})`; organizer submit → `createPlace`; tapping Approve on a pending row → `approvePlace(villageId,id,uid)`; list shows pending + approved, consumer-only contexts filter to approved. Implement using the primitives + `getPlaces`. Commit.
- [x] **2.5 `BarriosManager`** — same contract for barrios (`proposeBarrio`/`createBarrio`/`approveBarrio`). Implement. Commit.
- [x] **2.6 Mount on the shared village surface** — render `PlacesManager`/`BarriosManager` for all roles on the village screen; remove the organizer-gating that hid them. Point the legacy `/admin/places`/`/admin/barrios` at the shared managers. `pnpm app:test` + `pnpm shared:typecheck` green. Commit.

---

## Phase 3 — Organizations adopt the shared primitives

**Goal:** the Organizations surface uses the same propose-pending primitives. Data model + rules already fit (status/requestedBy/approvedBy/decidedAt exist; members already create peña/asociación as pending; `approveOrganization`/`rejectOrganization` exist).

**Files:** Create `apps/mobile/components/feature/OrganizationsManager.tsx` over the primitives; mount on the shared village surface; reduce `admin/organizations.tsx` to a wrapper. Tests: villager create → `requestOrganization` (pending); organizer approve → `approveOrganization`; ayuntamiento still goes through `requestAyuntamiento` (singleton), not the generic form.

**Tasks:**
- [x] **3.1** `OrganizationsManager` test + impl (reuse `ProposableListItem`; map approve→`approveOrganization`, reject→`rejectOrganization`, propose→`requestOrganization`). Keep the ayuntamiento carve-out. Commit.
- [x] **3.2** Mount on shared surface; wrapper for `admin/organizations.tsx`. `pnpm app:test` green. Commit.

---

## Phase 4 — Census role-mode merge

**Goal:** one census entry; villager fills/edits their own answers, organizer authors the schema. No proposals, no model change.

**Files:** Create a shared `CensusScreen`/`CensusManager` that branches on `useEntityCapabilities().canManage`: villager → existing answer form (member self-update of `profileAnswers` already allowed); organizer → schema editor calling `updateCensoSchema` (already routes through the `updateCenso` function). Reduce `admin/censo.tsx` to a wrapper; surface the answer form on the member-facing village/profile surface. Tests: villager sees answer fields and saves answers; organizer sees the schema editor and calls `updateCensoSchema`.

**Tasks:**
- [x] **4.1** Shared census component test (role → mode) + impl. Commit.
- [x] **4.2** Mount answer-mode on the member surface; wrapper for `admin/censo.tsx`. `pnpm app:test` green. Commit.

---

## Phase 5 — Community-header role-mode merge

**Goal:** one village header; villager views escudo/cover/description/coordinates, organizer edits them in place. Rules already allow `isVillageAdmin` updates. Kills the duplicate Edit entry points (village-tab pencil + admin hero).

**Files:** Create/adjust the shared village header component with inline edit affordances gated by `canManage` (escudo via `uploadMunicipalityImage`+`updateMunicipality`; cover/description via `updateCommunity`; coordinates via `updateMunicipality` with the existing lat/lng validation). Remove the village-tab pencil deep-link and the admin hero Edit. Reduce `admin/community.tsx` to a wrapper. Tests: organizer sees edit controls and the right service calls fire; villager sees read-only header.

**Tasks:**
- [x] **5.1** Shared header edit-mode test + impl (gated by `canManage`). Commit.
- [x] **5.2** Remove the two duplicate Edit entry points; wrapper for `admin/community.tsx`. `pnpm app:test` green. Commit.

---

## Phase 6 — Events v1 (shared detail + organize console)

**Goal:** event detail screen stays shared (public attendee/waitlist list, instant register). Organizer (= owning-org member OR village/app admin) gets inline edit pencils + a cancel control + an "Organize this event" entry → a dedicated `/event/[eventId]/organize` console with the roster, edit, cancel/complete, and remove-registration. **Drop the `draft` status** (create → `published`).

**Files:**
- Modify `EventDataModel` status enum → `['published','cancelled','completed']`; event-create defaults `published`; update `isValidEventCreate` (drop `draft`). Update `event/new.tsx` to create `published`.
- Modify registration `delete` rule: extend from self-only to `isOrgMember(event org) || isVillageAdmin || isAppAdmin` (organizer removes a registration).
- Create `apps/mobile/lib/events/useEventOrganizer.ts` — resolves organizer status via `getOrgMembershipsByUserInMunicipality(uid, municipalityId, [organizationId])` + admin checks.
- Modify `event/[eventId].tsx` — show inline edit pencils + cancel + "Organize" entry when organizer; render the public attendee list.
- Create `apps/mobile/app/event/[eventId]/organize.tsx` — the console (roster from `events/{id}/registrations`, `updateEvent`, cancel/complete, remove-registration).
- Tests: model/rules tests for the dropped draft + extended registration delete (rules e2e); `useEventOrganizer` unit test; console renders roster + organizer-only actions.

**Tasks:**
- [x] **6.1** Drop `draft`: model enum + `isValidEventCreate` + `event/new.tsx`; model/unit + a rules e2e asserting a member can't create non-published… (decide create constraints). Commit.
- [x] **6.2** Registration `delete` rule extension + e2e test (organizer can delete a registration; a non-organizer non-owner cannot). Commit.
- [x] **6.3** `useEventOrganizer` test + impl. Commit.
- [x] **6.4** Event detail inline affordances (edit pencils, cancel, Organize entry) gated by organizer. `pnpm app:test`. Commit.
- [x] **6.5** `/event/[eventId]/organize` console: roster + edit + cancel/complete + remove-registration. `pnpm app:test`. Commit.

---

## Phase 7 — Events v2 (check-in, walk-in, organizer-gated phones)

**RESOLVE FIRST (open questions):**
- **Phone capture location.** Registrations have no phone field today. Firestore rules are document-level → cannot hide one field of a public doc. Plan: phone lives in a separately-gated `events/{eventId}/registrationContacts/{regId}` doc, readable only by `isOrgMember(...) || isVillageAdmin || isAppAdmin`. Confirm where/when the phone is collected (registration time when `telephoneRequired`).
- **Walk-in shape.** A registration created by an organizer for someone without an auth account — sentinel/null `userId`. Confirm impact on the roster query, the `registerToEvent` capacity/waitlist logic, and `onRegistrationDeleted` waitlist promotion.

**Files (after resolution):** registration model gains `checkedInAt: Date | null`; new `registrationContacts` subcollection + rules + service; walk-in path in `registerToEvent` (or a sibling callable); console UI for check-in toggle, walk-in add, phone column.

**Tasks (outline — detail when Phase 6 lands and the two questions are answered):**
- [x] **7.1** `registrationContacts` subcollection + organizer-only read rules + e2e tests.
- [x] **7.2** `checkedInAt` model field + check-in service/callable + console toggle.
- [x] **7.3** Walk-in registration path + capacity/waitlist coverage + console add.

---

## Phase 8 — Delete the `/admin/` route group

**Goal:** remove the parallel admin area entirely now that every task lives on the shared surface.

**Files:** delete `apps/mobile/app/village/[villageId]/admin/` (`_layout.tsx`, `index.tsx`, `places.tsx`, `barrios.tsx`, `organizations.tsx`, `community.tsx`, `censo.tsx`, plus the now-outdated `requests.tsx` and `invite-tokens.tsx` — coordinate with the out-of-scope join/invite plans before removing those two). Remove the "open admin" / settings entry points that pointed here. Update any deep links / navigation.

**Tasks:**
- [x] **8.1** Remove the admin routes superseded by Phases 2–6 and their entry points; ensure no dangling `router.push('/.../admin...')`. `pnpm app:test` + `pnpm shared:typecheck` green. Commit.
- [x] **8.2** Reconcile `requests.tsx` / `invite-tokens.tsx` with the join/invite plans (delete only if those plans have removed the need). Commit.

---

## Retirement

When the whole branch merges: distil durable rationale (the three interaction patterns; why proposals live in-collection with `.default` legacy-compat; the document-level phone-privacy constraint) into `docs/decisions/organizer-shared-ui-merge.md`, then delete this plan file.
