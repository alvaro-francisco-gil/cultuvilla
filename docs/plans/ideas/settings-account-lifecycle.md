# Settings screen: account lifecycle (change email + delete account)

## Goal

Add a Settings screen with the two account-lifecycle actions that actually matter for a passwordless app: **change email** and **delete account** (RGPD/GDPR right-to-erasure).

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

## Open questions

- **Dependent personas on delete:** the spec deletes personas the user created (`createdBy == uid && userId == null`) along with their registrations. Confirm this is the intended erasure boundary vs. keeping/anonymizing them (they're household members, not community content). *Proposed default: delete them — they exist only as this user's household.*
- **Google-linked accounts:** for a Google-provider user, changing the *account email* is really re-linking the Google identity — `verifyBeforeUpdateEmail` behaves differently. Confirm change-email is offered only to password/magic-link (email-provider) accounts, and Google users are told to manage their email in their Google account. *Proposed default: gate change-email on the user having an `emailLink`/`password` provider; hide/disable it for Google-only accounts.*
- **`organizerRequests` on delete:** delete outright (proposed) vs. anonymize the requester field to preserve the audit trail? *Proposed default: delete — they're the deleting user's own PII-bearing requests, and `membershipEvents` already carries the durable audit.*
