# Settings screen: account lifecycle (change email + delete account)

## Goal

Add a Settings screen with the two account-lifecycle actions that actually matter for a passwordless app: **change email** and **delete account** (RGPD/GDPR right-to-erasure).

## Status

- **Updated:** 2026-07-09
- **Stage:** Task 1 (org member `userId` field) — starting
- **Branch:** repo `feat/settings-account-lifecycle` (worktree under `.claude/worktrees/settings-account/`)
- **Done:** design + implementation plan written
- **Next:** Task 1 — add `userId` to `OrgMemberDataModel` + dev backfill
- **Blockers:** none
- **Handoff:** subagent-driven execution; each task is one commit, RED→GREEN. Dev backfill (Task 1) and dev deploy (Task 12) require dev credentials — run manually, don't push before `pnpm check` is green.

## Context

Cultuvilla auth is **passwordless** — Google OAuth + email magic-link only ([AuthContext.tsx](../../../apps/mobile/lib/auth/AuthContext.tsx)). There are no passwords, so classic "forgot password" recovery does not exist and cannot be built. The real recovery lever for a magic-link user who loses access to their inbox is **changing the account email**, which today is unimplemented.

Current state:
- There is **no** Settings route. The de-facto account hub is [UserMenuModal.tsx](../../../apps/mobile/components/feature/UserMenuModal.tsx), which already has a **disabled "Ajustes" row** (`comingSoon: true`) waiting for this screen.
- The `menu.*` i18n strings (`menu.settings`, `menu.editProfile`, `menu.signOut`, …) already exist in [es.json](../../../packages/i18n/messages/es.json).
- No `authService` exists — auth lives entirely in `AuthContext.tsx`. Account-lifecycle Firebase primitives (`verifyBeforeUpdateEmail`, `deleteUser`, re-auth) are not imported anywhere.
- `users/{uid}.email` is already **client-writable** via Firestore rules (`isValidUserUpdateKeys` permits `email`), but with **no** `request.auth.token.email` cross-check — a user can currently set an arbitrary email string on their own doc. This spec tightens that.

**Out of scope (deliberately deferred):** notification preferences (no push infra exists), language selector (es-only today), legal/support links (existing stubs). The Settings hub is built so these drop in later without restructuring.

## Decisions (settled during brainstorming)

1. **Delete policy = anonymize, keep content.** Hard-delete the account + personal data (person profile, memberships, registrations); **keep** authored news/events, reattributed to a "Usuario eliminado" sentinel. RGPD-compliant: personal data erased, public community history preserved.
2. **Sole-admin = block.** If the user is the *only* admin of any village or organization, refuse deletion and list the blocking communities; they must promote a successor first. Authority is the `role: 'admin'` flag, never the founder pointer.
3. **Re-auth:** change-email requires magic-link re-auth (Firebase forces `requires-recent-login`); delete uses a **typed "ELIMINAR" confirmation** (server-side Admin-SDK delete sidesteps the recent-login requirement; magic-link re-auth is too heavy for this account's stakes).

## Design / approach

### A. Settings stack + entry point

New routes under `apps/mobile/app/settings/`:
- `settings/index.tsx` — hub. Shows read-only `email` + `displayName` at top, then an **Account (Cuenta)** section with rows → *Change email* and *Delete account*. Composed from primitives (`Screen`, `Card`, `Pressable`, `Text`).
- `settings/change-email.tsx`
- `settings/delete-account.tsx`

Wire the disabled "Ajustes" row in `UserMenuModal.tsx` to `router.push('/settings')` (drop `comingSoon`). Respect bottom safe-area insets on any bottom-anchored controls.

### B. Change-email flow

Firebase `verifyBeforeUpdateEmail(user, newEmail)` emails a confirmation link to the **new** address; the Auth email only changes when the user clicks it.

1. User enters new email → attempt `verifyBeforeUpdateEmail`.
2. On `auth/requires-recent-login`: run **magic-link re-auth** to the *current* email. Mirror the existing pending-email pattern in `AuthContext.tsx` (`sendSignInLinkToEmail` + `AsyncStorage` key `cultuvilla.pendingEmailSignIn`), but with a **distinct re-auth intent** (new AsyncStorage key, e.g. `cultuvilla.pendingReauth`, storing `{ purpose: 'change-email', newEmail }`). On return, `EmailAuthProvider.credentialWithLink(currentEmail, url)` → `reauthenticateWithCredential` → replay `verifyBeforeUpdateEmail(newEmail)`.
3. User clicks the link in the **new** inbox → Firebase Auth email updates.
4. **Firestore sync:** on next app resume / `onAuthStateChanged`, if `getAuth().currentUser.email !== profile.email`, patch `users/{uid}.email`.

Layer work:
- **AuthContext**: add `changeEmail(newEmail)`, the re-auth intent seam (`sendReauthLink`/`completeReauth`/`readPendingReauth`), and the resume-time email-sync detection. AuthContext is the sanctioned Firebase-auth boundary, so these Firebase-SDK calls belong here (not a screen).
- **userService**: extend `patchUserProfile`'s allowed type to include `email` (currently `telephone | activeMunicipalityId | personId`).
- **firestore.rules**: tighten `isValidUserUpdateKeys` / add a guard so that when the update touches `email`, `request.resource.data.email == request.auth.token.email`. Prevents spoofing an arbitrary email onto the user doc; makes the client sync safe. (guardrail-enforcement: rules layer.)

### C. Delete-account flow

Two callables in `functions/` (follow the `changeVillageMemberRole.ts` convention: `onCall` + `HttpsError` + `logger.info(msg, { handler, ... })`, Spanish user messages, all reads before writes in a transaction).

**`checkAccountDeletable`** (read-only, runs on screen open) → returns `{ blockers: Array<{ scopeType: 'village'|'org', scopeId, name }> }`:
- Enumerate the user's memberships and find any where they are the **sole admin**.
- Village members carry a `userId` field → `collectionGroup('members').where('userId','==',uid)` filtered to `parent.parent.parent.id === 'municipalities'` (existing index).
- **Org members currently have NO `userId` field** → this check can't find them today. **Required sub-change:** add `userId` to `OrgMemberDataModel` (aligning it with `VillageMemberDataModel`; AGENTS.md already frames villages/orgs as the same membership abstraction), have the member-write paths set it, backfill dev (`villa-events`) via an idempotent `scripts/backfill-org-member-userid.mjs`, and reuse the same `collectionGroup('members').where('userId','==',uid)` query filtered to `parent.parent.parent.id === 'organizations'`. The existing `members.userId` collection-group index covers both.
- For each admin membership, count other admins in that group; if zero others → it's a blocker.

**`deleteAccount`** (performs erasure; re-checks blockers server-side and throws `failed-precondition` if any remain):
- **Anonymize** authored community content — set `createdBy` to the sentinel `DELETED_USER_UID` (a shared constant) and pull the uid from `organizerUserIds[]`, on both `news` (`createdBy` + `organizerUserIds`) and `events` (same). News/event author display resolves the sentinel to "Usuario eliminado". (No `authorName` field exists to overwrite.)
- **Hard-delete personal data:**
  - `users/{uid}` doc (Admin SDK bypasses the `allow delete: if false` rule).
  - Self `persons` doc (`userId == uid`) **and** dependent personas the user created (`createdBy == uid && userId == null` — household members that exist only under this account), cascading each person's registrations.
  - Village memberships (`municipalities/*/members/{uid}`) and org memberships (`organizations/*/members/{uid}`).
  - Registrations (`collectionGroup('registrations').where('userId','==',uid)`).
  - `users/{uid}/notifications/*` (subcollection).
  - `organizerRequests.where('userId','==',uid)`.
- **Null dangling pointers:** any `municipalities/*.community.organizerId == uid` → set to `null` (founder pointer, no authority; must not dangle).
- **Preserve** the `membershipEvents/` append-only audit log (security-audit exemption), and **emit** `action: 'removed'` events for each membership removed (via `writeMembershipEvent`).
- Finally `admin.auth().deleteUser(uid)`.
- Client: on success, tear down like `signOut` (Firestore listeners, pending intents) and route to the signed-out state.

Given the fan-out size, `deleteAccount` batches deletes (chunked ≤500 writes/batch) rather than a single transaction; the sole-admin re-check reads happen first.

### D. i18n

Add a `settings` namespace to `es.json` (or extend `menu.*`) for the new screen labels, change-email steps, delete confirmation ("Escribe ELIMINAR para confirmar"), blocker messages, and error strings. Route all user-facing strings through `useT()`.

### E. Indexes

- Reuse existing collection-group indexes: `members.userId`, `registrations.userId`.
- Add single-field / composite indexes if the anonymize step queries `news`/`events` by `createdBy` and by `array-contains organizerUserIds` (declare in `firestore.indexes.json` in the same change as the query).

## File structure (create / modify)

**Create**
- `apps/mobile/app/settings/index.tsx`, `change-email.tsx`, `delete-account.tsx`
- `functions/src/account/checkAccountDeletable.ts`, `functions/src/account/deleteAccount.ts`
- `scripts/backfill-org-member-userid.mjs`
- shared constant `DELETED_USER_UID` (e.g. `packages/shared/src/models/user/`)

**Modify**
- `apps/mobile/lib/auth/AuthContext.tsx` — `changeEmail`, re-auth intent seam, resume-time email sync
- `apps/mobile/components/feature/UserMenuModal.tsx` — wire "Ajustes" row
- `packages/shared/src/services/userService.ts` — allow `email` in `patchUserProfile`
- `packages/shared/src/models/organization/OrgMemberDataModel.ts` — add `userId`
- org member write path(s) — set `userId` on create
- `firestore.rules` — email == token.email guard; (org member `userId` write allowance if needed)
- `firestore.indexes.json` — any new news/events author-query indexes
- `functions/src/index.ts` — export the two callables
- `packages/i18n/messages/es.json` — `settings` strings
- `packages/shared/src/services/_services-map.md`, `CHANGELOG.md` — docs

## Resolved decisions (formerly open questions)

- **Dependent personas on delete:** delete personas the user created (`createdBy == uid && userId == null`) along with their registrations — they exist only as this user's household.
- **Google-linked accounts:** change-email is gated on the user having an `emailLink`/`password` provider (`getAuth().currentUser.providerData`). Google-only accounts see the row disabled with a hint to manage their email in their Google account.
- **`organizerRequests` on delete:** deleted outright — they're the deleting user's own PII-bearing requests, and `membershipEvents` carries the durable audit.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Settings screen with change-email (magic-link re-auth) and delete-account (RGPD erasure with sole-admin block + content anonymization).

**Architecture:** Firebase-auth-lifecycle calls live in `AuthContext.tsx` (the sanctioned auth boundary); the destructive server fan-out lives in two `onCall` functions; Firestore rules enforce the email/token cross-check; the mobile UI is three screens under `app/settings/`.

**Tech Stack:** Expo/RN + Expo Router, Firebase Auth + Firestore, Cloud Functions v2 (`onCall`), Zod models, vitest (shared) / jest (mobile) / functions emulator tests.

## Global Constraints

- Strict TypeScript, no `any`, no `@ts-nocheck`. Narrow `unknown` at boundaries.
- No `firebase/*` imports in screens — route through services / AuthContext (the only auth-boundary exemption).
- Cloud Functions: never `console.*` — use `logger.info(msg, { handler, ... })` with a `handler` field. Spanish `HttpsError` messages.
- All reads before writes in transactions; batch deletes chunked ≤500 writes.
- User-facing strings go through `useT()`; add to `packages/i18n/messages/es.json`.
- Backfill dev (`villa-events`) in the same change when a model field is added; verify with `pnpm check:dev-conformance`.
- Conventional commits; run `pnpm check` before pushing.

---

### Task 1: Add `userId` to org member docs (+ dev backfill)

**Files:**
- Modify: `packages/shared/src/models/organization/OrgMemberDataModel.ts`
- Modify: org member create path(s) (grep `organizations/${...}/members`; the org-detail FAB client write + any function seeding a member)
- Create: `scripts/backfill-org-member-userid.mjs`
- Test: `packages/shared/test/models/orgMember.test.ts`

**Interfaces:**
- Produces: `OrgMemberData.userId: string` (== member doc id), enabling `collectionGroup('members').where('userId','==',uid)` to return org memberships filtered by `parent.parent.parent.id === 'organizations'`.

- [ ] **Step 1:** Write a failing vitest asserting `OrgMemberDataSchema.parse({...})` requires `userId: string` and round-trips through the converter.
- [ ] **Step 2:** Run it, confirm FAIL (`userId` unknown/allowed).
- [ ] **Step 3:** Add `userId: z.string()` to `OrgMemberDataSchema`; update the model builder/input type.
- [ ] **Step 4:** Set `userId` at every member-write site (the self-join FAB write sets `userId: uid`; approval seeding sets the founder uid).
- [ ] **Step 5:** Run vitest, confirm PASS.
- [ ] **Step 6:** Write `scripts/backfill-org-member-userid.mjs` mirroring `scripts/backfill-municipality-namelower.mjs`: project-id guard, iterate all `organizations/*/members/*`, set `userId = doc.id` only where missing. Run it against dev, then `pnpm check:dev-conformance`.
- [ ] **Step 7:** Commit `feat(shared): add userId to org member docs + dev backfill`.

---

### Task 2: Firestore rules — email must match verified token

**Files:**
- Modify: `firestore.rules` (`isValidUserUpdateKeys` region, ~lines 128-133; org member create rule if `userId` needs allowing)
- Test: `packages/shared/test/e2e/users.rules.test.ts` (`@firebase/rules-unit-testing`)

**Interfaces:**
- Produces: a rule where updating `users/{uid}` with `email` in the affected keys is allowed only if `request.resource.data.email == request.auth.token.email`.

- [ ] **Step 1:** Write failing rules test: authed user updating own doc `email` to a value ≠ token email is DENIED; updating to == token email is ALLOWED; updating only `telephone` still ALLOWED.
- [ ] **Step 2:** Run rules test (emulator harness), confirm the deny case currently FAILS (today it's allowed).
- [ ] **Step 3:** Add to the user update rule: `(!affected.hasAny(['email']) || request.resource.data.email == request.auth.token.email)`. Keep the org-member create rule permitting `userId == request.auth.uid` (self-join).
- [ ] **Step 4:** Run rules test, confirm PASS.
- [ ] **Step 5:** Commit `fix(rules): user doc email must equal verified auth token`.

---

### Task 3: `patchUserProfile` accepts `email`

**Files:**
- Modify: `packages/shared/src/services/userService.ts:60-70`
- Test: `packages/shared/test/services/userService.test.ts`

**Interfaces:**
- Produces: `patchUserProfile(uid, { email })` valid (type widened to `'email' | 'telephone' | 'activeMunicipalityId' | 'personId'`).

- [ ] **Step 1:** Write failing test: `patchUserProfile` type/call accepts `{ email: string }` (mock `updateDoc`, assert it's forwarded).
- [ ] **Step 2:** Run, confirm FAIL (type rejects `email`).
- [ ] **Step 3:** Add `'email'` to the `Pick<...>` in the signature.
- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit `feat(shared): allow email in patchUserProfile`.

---

### Task 4: `DELETED_USER_UID` sentinel constant

**Files:**
- Create/Modify: `packages/shared/src/models/user/deletedUser.ts` exporting `export const DELETED_USER_UID = 'deleted-user'`; re-export from the models index.
- Test: `packages/shared/test/models/deletedUser.test.ts`

**Interfaces:**
- Produces: `DELETED_USER_UID` imported by the delete callable (anonymization target) and by author-display resolution.

- [ ] **Step 1:** Write trivial test asserting the constant value + that author-name resolution maps it to the i18n key `settings.deletedUser` / "Usuario eliminado".
- [ ] **Step 2..4:** Add constant + wire the display resolution (wherever `createdBy` → display name is resolved for news/events); run test PASS.
- [ ] **Step 5:** Commit `feat(shared): add DELETED_USER_UID sentinel`.

---

### Task 5: AuthContext — `changeEmail`, re-auth intent, email sync

**Files:**
- Modify: `apps/mobile/lib/auth/AuthContext.tsx`
- Test: `apps/mobile/__tests__/auth/changeEmail.test.tsx` (jest, mock firebase/auth)

**Interfaces:**
- Consumes: `patchUserProfile` (Task 3).
- Produces on the context value:
  - `changeEmail(newEmail: string): Promise<void>` — calls `verifyBeforeUpdateEmail`; on `auth/requires-recent-login` stores a re-auth intent `{ purpose: 'change-email', newEmail }` under `cultuvilla.pendingReauth` and calls `sendSignInLinkToEmail(currentEmail)`, then throws a typed `ReauthRequiredError`.
  - `completeReauth(url: string): Promise<void>` — `EmailAuthProvider.credentialWithLink(email, url)` → `reauthenticateWithCredential`; if intent purpose is `change-email`, replays `verifyBeforeUpdateEmail(newEmail)`, clears the intent.
  - `readPendingReauth(): Promise<{ purpose: string; newEmail?: string } | null>`
  - `emailProvider: 'password' | 'google.com' | ...` derived from `currentUser.providerData` (for the Google gate).
  - resume-time sync: in the existing auth-state effect, if `currentUser.email !== profile.email`, call `patchUserProfile(uid, { email: currentUser.email })`.

- [ ] **Step 1:** Write failing jest test: calling `changeEmail('new@x.com')` invokes `verifyBeforeUpdateEmail`; when it rejects `auth/requires-recent-login`, a pending-reauth intent is persisted and `sendSignInLinkToEmail` is called with the current email.
- [ ] **Step 2:** Run, confirm FAIL (methods absent).
- [ ] **Step 3:** Implement the methods + intent seam (new AsyncStorage key `cultuvilla.pendingReauth`; mirror `PENDING_EMAIL_KEY` handling). Add resume-time email sync in the auth effect. Extend the context type + provider value.
- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit `feat(mobile): AuthContext change-email + re-auth intent + email sync`.

---

### Task 6: `checkAccountDeletable` callable

**Files:**
- Create: `functions/src/account/checkAccountDeletable.ts`
- Modify: `functions/src/index.ts` (export)
- Test: `functions/src/account/__tests__/checkAccountDeletable.test.ts` (emulator)

**Interfaces:**
- Consumes: `OrgMemberData.userId` (Task 1).
- Produces: `onCall` returning `{ blockers: Array<{ scopeType: 'village' | 'org'; scopeId: string; name: string }> }`. Enumerates the caller's admin memberships (village via `collectionGroup('members').where('userId','==',uid)` filtered to `municipalities`; org via same query filtered to `organizations`), and for each counts other admins; zero others ⇒ blocker.

- [ ] **Step 1:** Write failing emulator test: seed a village with the caller as sole admin ⇒ one village blocker; add a second admin ⇒ no blocker; repeat for org.
- [ ] **Step 2:** Run, confirm FAIL (function undefined).
- [ ] **Step 3:** Implement per `changeVillageMemberRole.ts` conventions (auth guard, `logger.info` with `handler: 'checkAccountDeletable'`). Resolve `name` from the village `community.villageName` / org `name`.
- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit `feat(functions): checkAccountDeletable callable`.

---

### Task 7: `deleteAccount` callable

**Files:**
- Create: `functions/src/account/deleteAccount.ts`
- Modify: `functions/src/index.ts` (export)
- Test: `functions/src/account/__tests__/deleteAccount.test.ts` (emulator)

**Interfaces:**
- Consumes: `DELETED_USER_UID` (Task 4), the blocker logic (Task 6, factored into a shared helper `functions/src/account/blockers.ts`), `writeMembershipEvent` (`functions/src/helpers/membershipAudit.ts`).
- Produces: `onCall` performing, in order — re-check blockers (throw `failed-precondition` if any); anonymize `news`/`events` (`createdBy → DELETED_USER_UID`, pull uid from `organizerUserIds`); delete self+dependent `persons` and their registrations; delete village + org memberships (emit `removed` membershipEvents); delete `collectionGroup('registrations').where('userId','==',uid)`; delete `users/{uid}/notifications/*`; delete `organizerRequests.where('userId','==',uid)`; null `community.organizerId` where `== uid`; delete `users/{uid}`; `admin.auth().deleteUser(uid)`. Returns `{ ok: true }`.

- [ ] **Step 1:** Write failing emulator test: seed a user with a person, a village membership (with a co-admin so not blocked), an authored news post, a registration, a notification; call `deleteAccount`; assert the news `createdBy === DELETED_USER_UID`, person/membership/registration/notification gone, auth user gone, and a `removed` membershipEvent written.
- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Implement with chunked batches (≤500), `logger.info` `handler: 'deleteAccount'`. Factor blocker logic into `blockers.ts` shared with Task 6.
- [ ] **Step 4:** Add a second test: sole-admin ⇒ throws `failed-precondition`, nothing deleted.
- [ ] **Step 5:** Run both, confirm PASS.
- [ ] **Step 6:** Commit `feat(functions): deleteAccount callable (RGPD erasure)`.

---

### Task 8: i18n `settings` strings

**Files:**
- Modify: `packages/i18n/messages/es.json`

- [ ] **Step 1:** Add a `settings` namespace: title, section labels, `changeEmail.*` (label, newEmailPlaceholder, reauthNotice, sentToNewEmail, googleDisabledHint), `deleteAccount.*` (label, warning, confirmPrompt "Escribe ELIMINAR para confirmar", confirmWord "ELIMINAR", blockerVillage, blockerOrg, success), `deletedUser` ("Usuario eliminado"), and error strings. Keep dotted-path friendly.
- [ ] **Step 2:** `pnpm typecheck` (i18n) passes.
- [ ] **Step 3:** Commit `feat(i18n): settings/account-lifecycle strings`.

---

### Task 9: Settings hub screen + wire entry point

**Files:**
- Create: `apps/mobile/app/settings/index.tsx`
- Modify: `apps/mobile/components/feature/UserMenuModal.tsx` (Ajustes row → `router.push('/settings')`, drop `comingSoon`)
- Test: `apps/mobile/__tests__/screens/settings.test.tsx`

**Interfaces:**
- Consumes: AuthContext (`profile.email`, `profile.displayName`, `emailProvider`).
- Produces: rows navigating to `/settings/change-email` and `/settings/delete-account`; change-email row disabled with hint when `emailProvider === 'google.com'`.

- [ ] **Step 1:** Write failing test: renders email + displayName read-only; shows two rows; the Ajustes row in UserMenuModal navigates to `/settings`.
- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Build the screen from primitives (`Screen`, `Card`, `Pressable`, `Text`); wire UserMenuModal.
- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit `feat(mobile): settings hub screen + entry point`.

---

### Task 10: Change-email screen

**Files:**
- Create: `apps/mobile/app/settings/change-email.tsx`
- Test: `apps/mobile/__tests__/screens/changeEmail.test.tsx`

**Interfaces:**
- Consumes: `changeEmail`, `completeReauth`, `readPendingReauth` (Task 5).
- Produces: email input → submit → success notice ("revisa tu nuevo correo"); on `ReauthRequiredError` shows the re-auth-link-sent notice; on deep-link return with a pending `change-email` intent, calls `completeReauth(url)`.

- [ ] **Step 1:** Write failing test: submitting a new email calls `changeEmail`; success shows the confirmation notice; `ReauthRequiredError` shows the re-auth notice.
- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Build the screen (`Input`, `Button`, validation, `useT()`). Handle the deep-link return path (reuse the app's email-link handling entry).
- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit `feat(mobile): change-email screen`.

---

### Task 11: Delete-account screen

**Files:**
- Create: `apps/mobile/app/settings/delete-account.tsx`
- Create: `packages/shared/src/services/accountService.ts` (thin wrappers over the two callables via `httpsCallable`)
- Modify: `packages/shared/src/services/_services-map.md`
- Test: `apps/mobile/__tests__/screens/deleteAccount.test.tsx`; `packages/shared/test/services/accountService.test.ts`

**Interfaces:**
- Consumes: `checkAccountDeletable`, `deleteAccount` (Tasks 6-7), `signOut` teardown.
- Produces: `accountService.checkAccountDeletable()` / `deleteAccount()`; screen shows blockers (disables the button), requires typing "ELIMINAR", then calls `deleteAccount` and routes to signed-out state.

- [ ] **Step 1:** Write failing tests: `accountService` calls the right callables; screen with blockers disables the button; typing the confirm word enables it; confirming calls `deleteAccount` and triggers sign-out.
- [ ] **Step 2:** Run, confirm FAIL.
- [ ] **Step 3:** Add `accountService`, build the screen (safe-area insets on the bottom confirm button), update the services map.
- [ ] **Step 4:** Run, confirm PASS.
- [ ] **Step 5:** Commit `feat(mobile): delete-account screen + accountService`.

---

### Task 12: Final gate + docs

- [ ] **Step 1:** Update `CHANGELOG.md` under `## [Unreleased]` (Settings: change email + delete account).
- [ ] **Step 2:** Run `pnpm check` (lint + typecheck + test + build) and `pnpm app:typecheck`; fix anything red.
- [ ] **Step 3:** Deploy rules + indexes + functions to dev via the `firestore-deploy` skill (dev only).
- [ ] **Step 4:** Commit `docs: changelog for settings account-lifecycle`.
