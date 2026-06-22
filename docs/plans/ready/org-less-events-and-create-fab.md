# Org-less events + context-aware create FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any active village member create an event without an organization, and add a context-aware floating action button on the explore tab that routes to event- or news-creation by active tab.

**Architecture:** Make the event's `organizationId`/`organizationName` nullable (model + service), gate org-less creation on village membership in `firestore.rules` (org events keep the `isOrgMember` gate; status stays `published` — no approval queue), let the creator edit/delete their own org-less event, surface a "Sin organización" choice in the create form, and add a reusable `Fab` mounted on the explore tab that pushes `/event/new` on the "eventos" tab and `/news/new` on the "noticias" tab (the news create screen already exists).

**Tech Stack:** TypeScript, Zod (`packages/shared`), Firestore security rules, `@firebase/rules-unit-testing` + vitest, Expo / React Native (`apps/mobile`), expo-router, NativeWind.

## Global Constraints

- `@cultuvilla/shared` is the import alias for `packages/shared`.
- Events publish immediately (`status: 'published'`); there is **no** `pending`/approval state for events. Do not add one.
- Moderation of org-less events is post-hoc via delete (creator / village admin / app admin).
- News creation already exists end-to-end — do **not** create any news model/service/rules/screen. The FAB only links to `/news/new`.
- Mobile web-compat: never put visual styles on `className` of an `Animated.*` component — use `style`. The build must render on https://villa-events.web.app.
- Single locale catalog: `packages/i18n/messages/es.json`. Use the `i18n-add-string` skill when adding strings.
- Rules deploys go through the `firestore-deploy` skill (dev only).

## File Structure

- **Modify** `packages/shared/src/models/event/EventDataModel.ts` — `organizationId`/`organizationName` become nullable in schema + `EventDataInput`.
- **Modify** `packages/shared/src/services/eventService.ts` — `createEvent` passes null org fields through (type follows the model).
- **Modify** `firestore.rules` — `isValidEventCreate` relaxes org-field type checks; `events` create/update/delete gates handle the org-less branch; `isEventOrganizer` guards the null-org case.
- **Modify** `packages/i18n/messages/es.json` — add `event.noOrganization`.
- **Modify** `apps/mobile/app/event/new.tsx` — village member always sees the form; "Sin organización" selectable and default; org-request buttons demoted to a footer hint.
- **Create** `apps/mobile/components/primitives/Fab.tsx` — reusable floating action button.
- **Modify** `apps/mobile/components/primitives/index.ts` — export `Fab`.
- **Modify** `apps/mobile/app/(tabs)/index.tsx` — mount the `Fab`, context-aware by `activeTab`.
- **Create** `packages/shared/test/e2e/eventOrglessRules.test.ts` — rules e2e for the new branches.
- **Modify** `packages/shared/test/models/event/EventDataModel.test.ts` — null-org model coverage.

---

### Task 1: Make the event model's organization fields nullable

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts:21-22,46,68-69`
- Test: `packages/shared/test/models/event/EventDataModel.test.ts`

**Interfaces:**
- Produces: `EventDataSchema.organizationId: string | null`, `EventDataSchema.organizationName: string | null`; `EventDataInput.organizationId: string | null`, `EventDataInput.organizationName: string | null`. `buildEventData` passes both straight through (already does).

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/test/models/event/EventDataModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEventData, EventDataSchema } from '../../../src/models/event/EventDataModel';
import { buildLocationData } from '../../../src/models/core/LocationDataModel';

describe('EventDataModel — org-less events', () => {
  const base = {
    title: 'Fiesta', description: 'desc', startDate: new Date('2026-07-01'),
    location: buildLocationData({ type: 'text', text: null }),
    createdBy: 'u1', municipalityId: 'm1', municipalityName: 'Villa',
    municipalityCoordinates: null,
  };

  it('buildEventData keeps a null organizationId/Name', () => {
    const e = buildEventData({ ...base, organizationId: null, organizationName: null });
    expect(e.organizationId).toBeNull();
    expect(e.organizationName).toBeNull();
  });

  it('EventDataSchema accepts null org fields', () => {
    const e = buildEventData({ ...base, organizationId: null, organizationName: null });
    expect(() => EventDataSchema.parse(e)).not.toThrow();
  });

  it('EventDataSchema still accepts a string organizationId', () => {
    const e = buildEventData({ ...base, organizationId: 'org1', organizationName: 'Peña' });
    expect(EventDataSchema.parse(e).organizationId).toBe('org1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: FAIL — `buildEventData`/`EventDataInput` reject `null` (type error) or schema parse throws on null.

- [ ] **Step 3: Make the org fields nullable**

In `EventDataModel.ts`, change the schema fields (lines 21-22):

```ts
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
```

And in `EventDataInput` (lines 45-46):

```ts
  organizationId: string | null;
  organizationName: string | null;
```

`buildEventData` lines 68-69 already do `organizationId: input.organizationId` / `organizationName: input.organizationName` — no change needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm check`
Expected: no type errors. (If `createEvent` in the service errors here, it's fixed in Task 2 — that's expected; you may run `pnpm check` again after Task 2.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/models/event/EventDataModel.ts packages/shared/test/models/event/EventDataModel.test.ts
git commit -m "feat(shared): allow null organization on the event model"
```

---

### Task 2: Service accepts null org fields

**Files:**
- Modify: `packages/shared/src/services/eventService.ts:80-81`

**Interfaces:**
- Consumes: `EventDataInput` (Task 1).
- Produces: `createEvent(input)` writes `organizationId`/`organizationName` as `string | null` (no coalescing).

Use the `touch-service` skill before editing the service.

- [ ] **Step 1: Confirm the type gap**

Run: `pnpm check`
Expected: FAIL at `eventService.ts:80-81` if Task 1's nullable input now conflicts with the local `EventData` assembly — or PASS if the assignment already widens cleanly. Either way, verify the next step holds.

- [ ] **Step 2: Pass org fields through without coalescing**

In `createEvent` (lines 80-81), confirm/ensure:

```ts
    organizationId: input.organizationId,
    organizationName: input.organizationName,
```

These already pass through directly; no `?? ''` is added. No other service change is required — `createEvent` writes `setDoc(newRef, event)` and a null value is a valid Firestore value.

- [ ] **Step 3: Typecheck + full shared tests**

Run: `pnpm check && pnpm --filter @cultuvilla/shared test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/eventService.ts
git commit -m "feat(shared): createEvent accepts a null organization"
```

---

### Task 3: Firestore rules — org-less create/update/delete

**Files:**
- Modify: `firestore.rules:35-41` (`isEventOrganizer`), `firestore.rules:363-364` (`isValidEventCreate`), `firestore.rules:594-603` (`events` gates)
- Test: `packages/shared/test/e2e/eventOrglessRules.test.ts` (create)

**Interfaces:**
- Consumes: existing helpers `isAuthenticated()`, `isVillageMember(municipalityId)`, `isOrgMember(orgId)`, `isOwner(userId)`, `isVillageAdmin(municipalityId)`, `isAppAdmin()`, `isStringOrNull(v)`.
- Produces: `events` create allowed for a village member when `organizationId == null`; update/delete allowed for the creator.

- [ ] **Step 1: Write the failing rules test**

Create `packages/shared/test/e2e/eventOrglessRules.test.ts`:

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serverTimestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;
const M = 'm1';
const ORG = 'org1';

// A full, schema-valid org-less event payload (mirrors isValidEventCreate keys).
function orglessEvent(createdBy: string) {
  return {
    title: 'Fiesta', description: 'desc', startDate: new Date('2026-07-01'),
    endDate: null, location: { type: 'text', text: null },
    imageURL: null, maxAttendees: null, telephoneRequired: false,
    status: 'published', organizationId: null, organizationName: null,
    createdBy, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    municipalityId: M, municipalityName: 'Villa',
    municipalityCoverImage: null, municipalityCoordinates: null,
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `municipalities/${M}/members/member`), { role: 'member', joinedAt: new Date() });
    await setDoc(doc(db, `municipalities/${M}/members/villageboss`), { role: 'admin', joinedAt: new Date() });
    // Pre-existing org-less event owned by `member`, for update/delete checks.
    await setDoc(doc(db, `events/owned`), { ...orglessEvent('member'), createdAt: new Date(), updatedAt: new Date(), startDate: new Date('2026-07-01') });
  });
}

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});
beforeEach(async () => { await env.clearFirestore(); await seed(); });
afterAll(async () => { await env.cleanup(); });

describe('firestore.rules — org-less events', () => {
  it('a village member can create an org-less event', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertSucceeds(setDoc(doc(m, `events/new1`), orglessEvent('member')));
  });

  it('a non-member cannot create an org-less event', async () => {
    const s = env.authenticatedContext('stranger').firestore();
    await assertFails(setDoc(doc(s, `events/new2`), orglessEvent('stranger')));
  });

  it('the creator can update their own org-less event', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertSucceeds(updateDoc(doc(m, `events/owned`), { title: 'Nueva' }));
  });

  it('the creator can delete their own org-less event', async () => {
    const m = env.authenticatedContext('member').firestore();
    await assertSucceeds(deleteDoc(doc(m, `events/owned`)));
  });

  it('a stranger cannot delete an org-less event', async () => {
    const s = env.authenticatedContext('stranger').firestore();
    await assertFails(deleteDoc(doc(s, `events/owned`)));
  });

  it('a village admin can delete an org-less event', async () => {
    const vb = env.authenticatedContext('villageboss').firestore();
    await assertSucceeds(deleteDoc(doc(vb, `events/owned`)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- eventOrglessRules`
Expected: FAIL — current rules require `isOrgMember(organizationId)` (null org) and reject the org-less create; `isString(d.organizationId)` also rejects null.

- [ ] **Step 3: Relax `isValidEventCreate`**

In `firestore.rules` lines 363-364, change:

```
          && isStringOrNull(d.organizationId)
          && isStringOrNull(d.organizationName)
```

- [ ] **Step 4: Update the `events` create/update/delete gates**

Replace lines 594-603 with:

```
      allow create: if isAuthenticated()
        && isValidEventCreate(request.resource.data)
        && request.resource.data.municipalityId is string
        && (
          request.resource.data.organizationId == null
            ? isVillageMember(request.resource.data.municipalityId)
            : isOrgMember(request.resource.data.organizationId)
        );
      allow update: if isOwner(resource.data.createdBy)
        || (resource.data.organizationId != null && isOrgMember(resource.data.organizationId))
        || isVillageAdmin(resource.data.municipalityId)
        || isAppAdmin();
      allow delete: if isOwner(resource.data.createdBy)
        || (resource.data.organizationId != null && isOrgMember(resource.data.organizationId))
        || isVillageAdmin(resource.data.municipalityId)
        || isAppAdmin();
```

- [ ] **Step 5: Guard `isEventOrganizer` against a null org**

In `firestore.rules` lines 35-41, replace the body so a null `organizationId` doesn't reach `isOrgMember` with an empty path segment:

```
    function isEventOrganizer(eventId) {
      return isAuthenticated() && (
        isAppAdmin()
        || (get(/databases/$(database)/documents/events/$(eventId)).data.organizationId != null
            && isOrgMember(get(/databases/$(database)/documents/events/$(eventId)).data.organizationId))
        || isVillageAdmin(get(/databases/$(database)/documents/events/$(eventId)).data.municipalityId)
      );
    }
```

- [ ] **Step 6: Run the new test + the existing event rules tests**

Run: `pnpm --filter @cultuvilla/shared test -- eventOrglessRules eventOrganizerRules registrationRules`
Expected: PASS (existing org-based event rules unchanged).

- [ ] **Step 7: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/eventOrglessRules.test.ts
git commit -m "feat(rules): allow village members to create/manage org-less events"
```

---

### Task 4: i18n — "Sin organización" string

**Files:**
- Modify: `packages/i18n/messages/es.json` (event namespace, near line 351)

Use the `i18n-add-string` skill.

**Interfaces:**
- Produces: `t('event.noOrganization')` → "Sin organización".

- [ ] **Step 1: Add the key**

In `packages/i18n/messages/es.json`, in the `event` object after `"organizationLabel"`, add:

```json
    "noOrganization": "Sin organización",
```

- [ ] **Step 2: Validate catalog**

Run: `pnpm check`
Expected: PASS (valid JSON, no i18n type/lint failure).

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(event): add noOrganization label"
```

---

### Task 5: Create form allows org-less events

**Files:**
- Modify: `apps/mobile/app/event/new.tsx:112-150,188-244`

**Interfaces:**
- Consumes: `t('event.noOrganization')` (Task 4); `createEvent` with null org (Tasks 1-2).
- Produces: form submits `organizationId: selectedOrg?.id ?? null`, `organizationName: selectedOrg?.name ?? null`.

This is a UI change; verify via the running app (see Task 8). No unit test harness exists for these screens.

- [ ] **Step 1: Default the selection to "no org" and relax `canSubmit`**

Replace lines 112-115:

```tsx
  const selectedOrg = memberOrgs.find((o) => o.id === selectedOrgId) ?? null;
  const canSubmit =
    !!municipalityId && !!user && title.trim().length > 0 &&
    description.trim().length > 0 && !!startDate;
```

And change the post-load default (line 98) so "Sin organización" is the initial choice:

```tsx
        setSelectedOrgId(null);
```

- [ ] **Step 2: Submit null org when none selected**

In the `submit` callable, replace the guard + org fields (lines 119, 129-130):

```tsx
      if (!municipalityId || !user || !startDate) return;
```
```tsx
        organizationId: selectedOrg?.id ?? null,
        organizationName: selectedOrg?.name ?? null,
```

- [ ] **Step 3: Always render the form for an active-village user; show the org selector with a "Sin organización" option**

Delete the `memberOrgs.length === 0` early-return block (lines 188-213). In the form body, replace the `memberOrgs.length > 1` selector block (lines 229-244) with a selector that always renders and includes the no-org choice plus the organizer hint:

```tsx
          <Text tone="muted">{t('event.organizationLabel')}</Text>
          <VStack gap={2}>
            <Button
              variant={selectedOrgId === null ? 'primary' : 'secondary'}
              onPress={() => setSelectedOrgId(null)}
            >
              {t('event.noOrganization')}
            </Button>
            {memberOrgs.map((o) => (
              <Button
                key={o.id}
                variant={selectedOrgId === o.id ? 'primary' : 'secondary'}
                onPress={() => setSelectedOrgId(o.id)}
              >
                {o.name}
              </Button>
            ))}
          </VStack>
          {memberOrgs.length === 0 && (
            <Button
              variant="secondary"
              onPress={() => router.push(`/discover/organize/${municipalityId}` as never)}
            >
              {t('event.eligibility.requestOrganizer')}
            </Button>
          )}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/event/new.tsx
git commit -m "feat(mobile): allow creating an event without an organization"
```

---

### Task 6: Reusable Fab primitive

**Files:**
- Create: `apps/mobile/components/primitives/Fab.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`
- Test: `apps/mobile/components/primitives/__tests__/Fab.test.tsx`

**Interfaces:**
- Produces: `Fab` — props `{ onPress: () => void; label?: string; testID?: string }`, a bottom-right circular `Pressable` with a "+" glyph.

Consult the `mobile-web-compat` skill: this component must render on web; keep all positioning/visual styles on `style`, not on an `Animated` `className`.

- [ ] **Step 1: Write the failing render test**

Create `apps/mobile/components/primitives/__tests__/Fab.test.tsx`. Mirror the harness already used by sibling tests in this folder (open one to copy its render/fireEvent imports), asserting:

```tsx
// Renders, exposes its testID, and fires onPress when tapped.
import { render, fireEvent } from '@testing-library/react-native';
import { Fab } from '../Fab';

it('fires onPress when pressed', () => {
  const onPress = jest.fn?.() ?? (() => {});
  // Use the same mock fn util the sibling tests use (vi.fn() if vitest).
});
```

Match the test runner/imports of the existing `__tests__` files exactly (do not assume jest vs vitest — copy a neighbor).

- [ ] **Step 2: Run test to verify it fails**

Run the mobile test command used by a sibling test in `apps/mobile/components/primitives/__tests__/`.
Expected: FAIL — `../Fab` does not exist.

- [ ] **Step 3: Implement the Fab**

Create `apps/mobile/components/primitives/Fab.tsx`:

```tsx
import { Pressable, Text } from 'react-native';

export type FabProps = {
  onPress: () => void;
  label?: string;
  testID?: string;
};

/**
 * Bottom-right floating action button. Positioning/visual styles live on
 * `style` (never `className`) so the button renders on the RN-Web build.
 */
export function Fab({ onPress, label = '+', testID }: FabProps) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      style={{
        position: 'absolute',
        right: 20,
        bottom: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#1f6feb',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        zIndex: 20,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 28, lineHeight: 30 }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Export it**

In `apps/mobile/components/primitives/index.ts`, add `export { Fab } from './Fab';` (and `export type { FabProps }` if the file re-exports types).

- [ ] **Step 5: Run test to verify it passes + typecheck**

Run the sibling test command, then `pnpm check`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/primitives/Fab.tsx apps/mobile/components/primitives/index.ts apps/mobile/components/primitives/__tests__/Fab.test.tsx
git commit -m "feat(mobile): add reusable Fab primitive"
```

---

### Task 7: Mount the context-aware FAB on the explore tab

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx:478-514` (add the Fab), import area

**Interfaces:**
- Consumes: `Fab` (Task 6); `activeTab` state (already `'eventos' | 'noticias'`, line 82); `router` from `expo-router`.

- [ ] **Step 1: Import `Fab` and `router`**

Add `Fab` to the existing primitives import, and ensure `router` is imported from `expo-router` (the file already navigates elsewhere — reuse the existing import; add `router` if absent).

- [ ] **Step 2: Render the Fab inside the root `Screen`**

Inside the returned `<Screen ...>` (after the `</View>` that closes the pager wrapper at line 514, before the `FilterSheet`s), add:

```tsx
      <Fab
        testID="create-fab"
        onPress={() =>
          router.push(activeTab === 'noticias' ? '/news/new' : '/event/new')
        }
      />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(tabs)/index.tsx"
git commit -m "feat(mobile): context-aware create FAB on the explore tab"
```

---

### Task 8: Verify in the running app + deploy rules

**Files:** none (verification + deploy).

- [ ] **Step 1: Full check**

Run: `pnpm check && pnpm --filter @cultuvilla/shared test`
Expected: all green.

- [ ] **Step 2: Run the app and exercise the flows**

Use the `drive-android-avd` skill (or the web build). Verify:
- FAB visible bottom-right on the explore tab.
- On "eventos" tab → FAB opens `/event/new`; on "noticias" tab → opens `/news/new`.
- As a user who belongs to no org: the event form shows, "Sin organización" preselected, and submitting creates a published event that appears in the feed.
- As an org member: org choices still appear; creating under an org still works.

- [ ] **Step 3: Deploy rules to dev**

Use the `firestore-deploy` skill to deploy `firestore.rules` to the dev project (`villa-events`). Do not deploy beta/prod.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
git add -A && git commit -m "chore: verification fixups for org-less events + create FAB"
```

---

## Self-Review notes

- **Spec coverage:** Part A (model T1, service T2, rules T3, form T5) and Part B (Fab T6, mount T7) both covered; news untouched (FAB links to existing `/news/new`); testing via T1/T3 unit+e2e and T8 manual. ✅
- **Type consistency:** `organizationId`/`organizationName` are `string | null` consistently across model, input, service, and form submit (`?? null`). Rules use `== null` / `!= null` branches matching the nullable field. `Fab` prop names (`onPress`, `label`, `testID`) consistent between T6 and T7.
- **Placeholders:** none — all code steps carry concrete code. The only deliberate "copy a neighbor" instruction is the mobile test runner detection in T6, because this repo's `apps/mobile` test harness (jest vs vitest) must match siblings exactly; the executor confirms by opening an existing `__tests__` file.
