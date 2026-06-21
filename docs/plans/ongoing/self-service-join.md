# Self-Service Join Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the organizer-gated request-and-approve join flow with direct self-service membership: any authenticated user can add themselves to an **active** village, fronted by a lean "this is your village" confirmation. Retire the request/approve machinery.

**Architecture:** Self-join is enforced in **Firestore rules**, not a new callable — the only guards (target community active, role pinned to `user`, owner-only) are rule-expressible, and the mobile village screen already writes the member doc directly via `addVillageMember`. We make that write legal for the owner, wire the confirmation, route discovery to the village landing, and delete the now-dead request/approve callables, rules, screens, models, and tests.

**Tech Stack:** TypeScript monorepo (pnpm). `packages/shared` (Zod models + Firestore refs/converters + services, vitest). `functions/` (Firebase Cloud Functions v2, vitest emulator harness). `apps/mobile` (Expo / React Native + expo-router, NativeWind, `useT()` i18n). Rules tested with `@firebase/rules-unit-testing` under `packages/shared/test/e2e/`.

## Global Constraints

- **Out of scope (Phase 2):** activating dormant villages without an organizer ("start a village"), nullable `community.adminUserId`, wiki-phase member editing of village info, contextual organizer hooks. This plan only opens joining of **already-active** villages and retires request-approve. The `requestOrganizeVillage` / `respondToOrganizerRequest` organizer flow is **untouched**.
- **Self-join guard set (the complete server-side contract):** caller is the doc owner; target municipality has `communityActive == true`; created member has `role == 'user'`, `userId == <doc id>`, `trustedNewsAuthor == false`. Already-a-member is handled by Firestore `create` semantics (create fails when the doc exists).
- **Invite tokens** (`inviteTokens`, `acceptInvite`) are a separate deferred concern — do not touch them.
- **Logging:** any new/edited `functions/src/**` log must use `logger.info(msg, { handler, ...fields })` (see `cloud-function-logging` skill). This plan only *removes* function code, so no new logs.
- **i18n:** user-facing strings live in `packages/i18n/messages/es.json` and are read via `useT()` dot-paths. No hardcoded Spanish in mobile components.
- **Member doc shape** (`VillageMemberDataSchema`): `{ userId: string, role: 'admin'|'user', joinedAt: Date, profileAnswers: {}, profileCompletedAt: Date|null, trustedNewsAuthor: boolean }`.

---

## File Structure

**Modify:**
- `firestore.rules` — add `isCommunityActive()` helper; widen `members` create to allow owner self-join; delete `joinRequests` rule blocks (nested + two collection-group list blocks).
- `apps/mobile/app/village/[villageId]/index.tsx` — add the self-declared confirmation before `addVillageMember`.
- `apps/mobile/components/feature/VillageDiscovery.tsx` — drop `getMyJoinRequests`/pending state; route taps on active villages to the village landing instead of the request-join screen.
- `apps/mobile/app/village/[villageId]/admin/_layout.tsx` (+ any admin hub link) — remove the "join requests" route/link.
- `functions/src/index.ts` — remove the two join-request callable exports.
- `packages/i18n/messages/es.json` — remove `requests.join.*` and `requests.admin.*`; add `village.joinConfirm.*`.
- `packages/shared/test/e2e/villageMemberRules.test.ts` — add self-join create cases.
- `docs/business-rules.md` — rewrite §3.1 join rules.

**Delete:**
- `functions/src/village/requestJoinVillage.ts`, `functions/src/village/respondToJoinRequest.ts`
- `functions/src/__tests__/handlers/requestJoinVillage.test.ts`, `functions/src/__tests__/handlers/respondToJoinRequest.test.ts`
- `apps/mobile/app/discover/request-join/[municipalityId].tsx`
- `apps/mobile/app/village/[villageId]/admin/requests.tsx`
- `packages/shared/src/services/joinRequestService.ts`
- `packages/shared/src/models/municipality/JoinRequestDataModel.ts`
- `packages/shared/src/firebase/converters/joinRequestConverter.admin.ts`, `joinRequestConverter.client.ts`
- `packages/shared/test/e2e/joinRequestRules.test.ts`
- join-request refs in `packages/shared/src/firebase/refs/admin.ts` and `refs/client.ts`, plus any re-exports of the model/converter.

---

## Task 1: Rules — allow owner self-join on active villages

**Files:**
- Modify: `firestore.rules` (helpers block near line 12-32; `members` match at 437-448)
- Test: `packages/shared/test/e2e/villageMemberRules.test.ts`

**Interfaces:**
- Produces: a new rules helper `isCommunityActive(municipalityId)`; a widened `members` create rule. Consumed by the mobile client (Task 4) calling `addVillageMember` as the owner.

- [ ] **Step 1: Write the failing rules tests**

Add to `packages/shared/test/e2e/villageMemberRules.test.ts`. First add a seed helper for an active municipality (place near `seedAliceMemberships`):

```ts
async function seedActiveMunicipality(id = 'mActive') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${id}`), { name: 'Activo', communityActive: true });
  });
}

async function seedInactiveMunicipality(id = 'mInactive') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${id}`), { name: 'Inactivo', communityActive: false });
  });
}

function memberDocData() {
  return {
    userId: ALICE,
    role: 'user',
    joinedAt: NOW,
    profileAnswers: {},
    profileCompletedAt: null,
    trustedNewsAuthor: false,
  };
}
```

Then add a new `describe` block:

```ts
describe('firestore.rules — self-join membership create', () => {
  it('owner can self-join an active village as role user', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('owner cannot self-join an inactive village', async () => {
    await seedInactiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mInactive/members/alice'), memberDocData()),
    );
  });

  it('owner cannot self-join as role admin', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        role: 'admin',
      }),
    );
  });

  it('owner cannot self-grant trustedNewsAuthor on join', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), {
        ...memberDocData(),
        trustedNewsAuthor: true,
      }),
    );
  });

  it('user cannot create a membership doc for someone else', async () => {
    await seedActiveMunicipality();
    const db = env.authenticatedContext('mallory').firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });

  it('anonymous user cannot self-join', async () => {
    await seedActiveMunicipality();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'municipalities/mActive/members/alice'), memberDocData()),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:rules`
Expected: the new "owner can self-join an active village" case FAILS (current rule only allows village admin / app admin to create), confirming the gap.

- [ ] **Step 3: Add the `isCommunityActive` helper**

In `firestore.rules`, after `isVillageMember` (around line 20), add:

```
    function isCommunityActive(municipalityId) {
      return exists(/databases/$(database)/documents/municipalities/$(municipalityId))
        && get(/databases/$(database)/documents/municipalities/$(municipalityId)).data.communityActive == true;
    }
```

- [ ] **Step 4: Widen the `members` create rule**

Replace the `allow create` line in the `match /members/{userId}` block (line 439):

```
        allow create: if isVillageAdmin(municipalityId) || isAppAdmin();
```

with:

```
        allow create: if isVillageAdmin(municipalityId)
                       || isAppAdmin()
                       || (
                            isOwner(userId)
                            && isCommunityActive(municipalityId)
                            && request.resource.data.userId == userId
                            && request.resource.data.role == 'user'
                            && request.resource.data.trustedNewsAuthor == false
                          );
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:rules`
Expected: all `villageMemberRules.test.ts` cases PASS, including the six new self-join cases. Other rules suites unaffected.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/villageMemberRules.test.ts
git commit -m "feat(rules): allow owner self-join on active villages"
```

---

## Task 2: Mobile — self-declared join confirmation

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/index.tsx` (handler `onJoin`, ~lines 58-70)
- Modify: `packages/i18n/messages/es.json` (`village` namespace)

**Interfaces:**
- Consumes: `addVillageMember(municipalityId, uid)` from `@cultuvilla/shared/services/villageMemberService` (already imported); the Platform-branched confirm pattern already used in `VillageDiscovery.tsx`.
- Produces: i18n keys `village.joinConfirm.title`, `village.joinConfirm.body`, `village.joinConfirm.confirm`, `village.joinConfirm.cancel`.

- [ ] **Step 1: Add the confirmation copy to the catalog**

In `packages/i18n/messages/es.json`, inside the `village` object (next to `join`/`signInToJoin`), add:

```json
    "joinConfirm": {
      "title": "Unirte a este pueblo",
      "body": "Unirte significa que consideras este tu pueblo. No verifica que vivas aquí.",
      "confirm": "Unirme",
      "cancel": "Cancelar"
    },
```

- [ ] **Step 2: Gate `onJoin` behind a confirmation**

In `apps/mobile/app/village/[villageId]/index.tsx`, ensure `Alert` and `Platform` are imported from `react-native`. Replace the body of `onJoin` so it confirms first (mirrors the web-safe pattern in `VillageDiscovery.tsx` — `Alert.alert` is a no-op on RN-Web 0.21, so fall back to `window.confirm`):

```tsx
const onJoin = () => {
  if (!user || !villageId) {
    router.push('/(auth)/login' as never);
    return;
  }
  const title = t('village.joinConfirm.title');
  const body = t('village.joinConfirm.body');
  const doJoin = async () => {
    setJoining(true);
    try {
      await addVillageMember(villageId as string, user.uid);
      setIsMember(true);
    } finally {
      setJoining(false);
    }
  };
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
      void doJoin();
    }
    return;
  }
  Alert.alert(title, body, [
    { text: t('village.joinConfirm.cancel'), style: 'cancel' },
    { text: t('village.joinConfirm.confirm'), onPress: () => void doJoin() },
  ]);
};
```

(The button's `onPress={onJoin}` stays as-is; `onJoin` is no longer `async`.)

- [ ] **Step 3: Typecheck and run mobile tests**

Run: `pnpm app:typecheck && pnpm app:test`
Expected: PASS (no type errors; existing mobile tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/village/[villageId]/index.tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): self-declared confirmation before joining a village"
```

---

## Task 3: Mobile — route discovery to the village landing; drop pending state

**Files:**
- Modify: `apps/mobile/components/feature/VillageDiscovery.tsx`

**Interfaces:**
- Consumes: `router` from expo-router; `item.communityActive`. No longer consumes `getMyJoinRequests`.
- Produces: tapping an **active** village navigates to `/village/[villageId]` (where the Task 2 join button lives). Inactive-village behavior (organizer prompt) is unchanged.

- [ ] **Step 1: Remove the join-request import and pending state**

Delete the `import { getMyJoinRequests } from '@cultuvilla/shared/services/joinRequestService'` line and any `useEffect`/state that loads pending requests (the block around lines 33-39 and the `isPending` flag derived from it). Remove the `requests.status.pending` label usage in the rendered card.

- [ ] **Step 2: Point active-village taps at the village landing**

Replace `joinTarget` and its use in `onPress` so an active village navigates to the landing screen rather than the request-join route:

```tsx
const villageTarget: Href = {
  pathname: '/village/[villageId]',
  params: { villageId: item.id },
};
// ...inside onPress:
if (isActive) {
  router.push(villageTarget);
  return;
}
```

Delete the now-unused `joinTarget` constant. Keep `organizerTarget` and the inactive-village `Alert`/`window.confirm` branch exactly as-is.

- [ ] **Step 3: Typecheck and run mobile tests**

Run: `pnpm app:typecheck && pnpm app:test`
Expected: PASS. No remaining references to `getMyJoinRequests`, `joinTarget`, or `requests.status.pending` in this file.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/feature/VillageDiscovery.tsx
git commit -m "feat(mobile): discovery routes to village landing for self-join"
```

---

## Task 4: Retire the request-and-approve Cloud Functions

**Files:**
- Delete: `functions/src/village/requestJoinVillage.ts`, `functions/src/village/respondToJoinRequest.ts`
- Delete: `functions/src/__tests__/handlers/requestJoinVillage.test.ts`, `functions/src/__tests__/handlers/respondToJoinRequest.test.ts`
- Modify: `functions/src/index.ts` (remove two exports)
- Modify: `functions/src/helpers/notifyRequests.ts` (remove now-unused join-request notifier helpers, only if unused elsewhere)

**Interfaces:**
- Produces: the `requestJoinVillage` and `respondToJoinRequest` callables no longer exist. Nothing in `packages/shared` or `apps/mobile` may reference them after Task 5.

- [ ] **Step 1: Delete the handlers and their tests**

```bash
git rm functions/src/village/requestJoinVillage.ts \
       functions/src/village/respondToJoinRequest.ts \
       functions/src/__tests__/handlers/requestJoinVillage.test.ts \
       functions/src/__tests__/handlers/respondToJoinRequest.test.ts
```

- [ ] **Step 2: Remove the exports from the functions index**

In `functions/src/index.ts`, delete these two lines:

```ts
export { requestJoinVillage } from './village/requestJoinVillage';
export { respondToJoinRequest } from './village/respondToJoinRequest';
```

- [ ] **Step 3: Prune now-dead notify helpers**

Check usage:

```bash
grep -rn "notifyJoinRequestCreated\|notifyJoinRequestResolved\|listVillageAdminRecipients" functions/src
```

For each helper that now has zero references outside its own definition, delete it from `functions/src/helpers/notifyRequests.ts` (and its now-unused imports). Leave anything still referenced (e.g. by the organizer-request notifiers) intact.

- [ ] **Step 4: Build and test functions**

Run: `pnpm functions:typecheck && pnpm functions:test`
Expected: PASS — compiles with the two handlers gone, no dangling imports, remaining handler tests green.

- [ ] **Step 5: Commit**

```bash
git add -A functions
git commit -m "chore(functions): retire requestJoinVillage/respondToJoinRequest callables"
```

---

## Task 5: Retire the join-request service, model, converters, refs, and rules

**Files:**
- Delete: `packages/shared/src/services/joinRequestService.ts`
- Delete: `packages/shared/src/models/municipality/JoinRequestDataModel.ts`
- Delete: `packages/shared/src/firebase/converters/joinRequestConverter.admin.ts`, `joinRequestConverter.client.ts`
- Delete: `packages/shared/test/e2e/joinRequestRules.test.ts`
- Modify: `packages/shared/src/firebase/refs/admin.ts`, `refs/client.ts` (remove join-request refs + converter imports)
- Modify: any barrel/index that re-exports the model/converter/service (find via grep)
- Modify: `firestore.rules` (remove `joinRequests` blocks)

**Interfaces:**
- Produces: no `JoinRequestData`, `joinRequestConverter*`, `municipalityJoinRequest*` ref, or `joinRequestService` symbols remain anywhere. `pnpm shared:build` succeeds.

- [ ] **Step 1: Find every reference**

```bash
grep -rn "joinRequest\|JoinRequest\|municipalityJoinRequest" packages/shared/src functions/src apps/mobile | grep -v "test/e2e/joinRequestRules"
```

Use this list to drive the deletions/edits below — every hit must be resolved.

- [ ] **Step 2: Delete the dead files**

```bash
git rm packages/shared/src/services/joinRequestService.ts \
       packages/shared/src/models/municipality/JoinRequestDataModel.ts \
       packages/shared/src/firebase/converters/joinRequestConverter.admin.ts \
       packages/shared/src/firebase/converters/joinRequestConverter.client.ts \
       packages/shared/test/e2e/joinRequestRules.test.ts
```

- [ ] **Step 3: Remove refs and re-exports**

In `packages/shared/src/firebase/refs/admin.ts` and `refs/client.ts`, delete the `municipalityJoinRequestsCollection` / `municipalityJoinRequestDoc` definitions and the `joinRequestConverter.*` imports. In the municipality models barrel (e.g. `packages/shared/src/models/municipality/index.ts`) and any services/converters index, remove the `JoinRequestDataModel` / `joinRequestConverter` / `joinRequestService` re-exports surfaced by Step 1.

- [ ] **Step 4: Remove the `joinRequests` rules blocks**

In `firestore.rules` delete: the nested `match /joinRequests/{userId} { ... }` block (inside `municipalities/{municipalityId}`, ~lines 458-469); the collection-group self-list block `match /{path=**}/joinRequests/{userId}` near line 477; and the duplicate one near line 576.

- [ ] **Step 5: Build, typecheck, and test**

Run: `pnpm shared:build && pnpm shared:typecheck && pnpm shared:test`
Expected: PASS — no unresolved imports. Confirm the grep from Step 1 now returns nothing.

Run: `pnpm test:rules`
Expected: PASS — `joinRequestRules.test.ts` is gone; remaining rules suites green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(shared,rules): remove join-request model, service, converters, refs, rules"
```

---

## Task 6: Retire the request-join + admin-requests mobile screens and i18n

**Files:**
- Delete: `apps/mobile/app/discover/request-join/[municipalityId].tsx`
- Delete: `apps/mobile/app/village/[villageId]/admin/requests.tsx`
- Modify: `apps/mobile/app/village/[villageId]/admin/_layout.tsx` and any admin hub screen linking to `admin/requests` (remove the entry)
- Modify: `packages/i18n/messages/es.json` (remove `requests.join.*`, `requests.admin.*`; remove `requests.status.*` only if now unused)

**Interfaces:**
- Produces: no route or link references `request-join` or `admin/requests`. `requests.join` / `requests.admin` keys are gone. `requests.organizer` and `requests.status` (if still referenced) remain.

- [ ] **Step 1: Find links to the removed routes and the status key**

```bash
grep -rn "request-join\|admin/requests\|requests.join\|requests.admin\|requests.status" apps/mobile
```

- [ ] **Step 2: Delete the screens**

```bash
git rm "apps/mobile/app/discover/request-join/[municipalityId].tsx" \
       "apps/mobile/app/village/[villageId]/admin/requests.tsx"
```

- [ ] **Step 3: Remove the layout/hub link**

In `apps/mobile/app/village/[villageId]/admin/_layout.tsx` (and any admin index/hub from Step 1), delete the `<Stack.Screen name="requests" .../>` entry and any navigation link/list item that pushes to `admin/requests`.

- [ ] **Step 4: Prune i18n keys**

In `packages/i18n/messages/es.json`, remove the `requests.join` and `requests.admin` objects. If Step 1 showed no remaining `requests.status` usage (it was only the discovery pending label removed in Task 3), remove `requests.status` too; otherwise keep it.

- [ ] **Step 5: Typecheck, test, and verify no dangling references**

Run: `pnpm app:typecheck && pnpm app:test && pnpm i18n:typecheck`
Expected: PASS. Re-run the Step 1 grep — only intentional survivors (e.g. `requests.organizer`) remain.

- [ ] **Step 6: Commit**

```bash
git add -A apps packages/i18n
git commit -m "chore(mobile,i18n): remove request-join + admin-requests screens"
```

---

## Task 7: Update business rules doc

**Files:**
- Modify: `docs/business-rules.md` (§3.1 "Unirse")

**Interfaces:** documentation only — no code.

- [ ] **Step 1: Rewrite §3.1**

Replace the "Solicitar ingreso — el usuario lo solicita; un administrador del pueblo aprueba…" bullet so it describes self-service join. Keep the invite-token and organize-a-village bullets. New text for bullet 1:

```markdown
1. **Unirse directamente** — cualquier usuario autenticado se añade como
   miembro (`role: user`) de un pueblo con **comunidad activa**, sin aprobación.
   La pertenencia se crea al instante; la app muestra antes una confirmación que
   deja claro que unirse es una **autodeclaración** ("este es mi pueblo") y **no
   verifica residencia**. La salvaguarda (comunidad activa, `role: user`, propio
   uid) se aplica en las reglas de Firestore. No existe la cola de solicitudes de
   ingreso.
```

Update §3.2 (Modelo de confianza) so it no longer says membership is established "por aprobación del administrador" — it is now established by self-declaration on an active community (admin approval is gone; residency is still unverified).

- [ ] **Step 2: Commit**

```bash
git add docs/business-rules.md
git commit -m "docs: business rules — self-service join replaces request-approve"
```

---

## Task 8: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the whole check matrix**

Run: `pnpm typecheck`
Expected: PASS across shared, functions, i18n, mobile.

Run: `pnpm shared:test && pnpm functions:test && pnpm app:test`
Expected: PASS (with the deleted handler/rules tests gone).

Run: `pnpm test:rules`
Expected: PASS, including the new self-join cases.

Run: `grep -rn "joinRequest\|JoinRequest\|request-join\|requestJoinVillage\|respondToJoinRequest\|requests.join\|requests.admin" packages functions apps`
Expected: no output (all dead references gone).

- [ ] **Step 2: Move the plan to retired / decisions per repo policy**

Per `managing-plans-lifecycle`, once shipped the plan leaves `docs/plans/ongoing/`. Distil rationale into `docs/decisions/self-service-join.md` and delete this plan file (do as a final commit after review).

---

## Self-Review

**Spec coverage (Phase-1 scope):** self-join replacing request-approve ✓ (Tasks 1-2); lean self-declared confirmation ✓ (Task 2); organizer expel/no-blocklist — unchanged behavior, no task needed ✓; retire request-approve callables/rules/screens/models ✓ (Tasks 4-6); docs ✓ (Task 7). Decoupled activation, nullable `adminUserId`, wiki editing, and organizer hooks are explicitly deferred to Phase 2 (Global Constraints).

**Placeholder scan:** none — every code step has concrete content; greps stand in only where the exact dead-reference set must be discovered at edit time, which is appropriate for a deletion sweep.

**Type consistency:** member doc shape matches `VillageMemberDataSchema` in all of rules test, confirmation handler (delegates to existing `addVillageMember`), and rules. `isCommunityActive` is defined in Task 1 and referenced only there. No new cross-task function signatures introduced.
