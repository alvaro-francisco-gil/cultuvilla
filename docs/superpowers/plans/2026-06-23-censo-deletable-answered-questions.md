# Censo: Deletable Answered Questions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a village admin delete a censo question even after members have answered it; deleting erases that field's answers across all members. Mutating an answered question stays blocked.

**Architecture:** One change to the server transition policy (`validateTransition` stops blocking removal of answered fields) plus answer cleanup in the `updateCenso` callable (atomic batch: write new schema + delete the removed keys from member docs). The builder UI gains a trash button on answered questions, gated behind a confirmation that names how many members answered.

**Tech Stack:** TypeScript. `functions/` (Firebase Cloud Functions v2, vitest + firebase emulator). `packages/shared` (vitest). `apps/mobile` (Expo/React Native, jest + @testing-library/react-native). i18n in `packages/i18n/messages/es.json`.

## Global Constraints

- Direct push to `main` is allowed; no PR/branch needed.
- Commit subjects lowercase (commitlint). End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Mobile consumes `@cultuvilla/shared` from built `dist/` — run `pnpm shared:build` after any shared `src` change before the app or functions pick it up.
- No silent fallbacks; surface errors. Services are the only Firebase ingress in the client.
- ACCENT orange `#bb5d3a`; olive `#566047`. `Alert` is a no-op on web — use `showConfirm` from `apps/mobile/lib/dialogs.ts` for confirmations.
- Dev Firebase project is `villa-events`; deploy only to dev (`pnpm deploy:functions:dev`). Never beta/prod.

---

### Task 1: Allow removing an answered field in `validateTransition`

**Files:**
- Modify: `functions/src/helpers/profileFormValidation.ts` (the `if (!nextField)` branch inside `validateTransition`)
- Test: `functions/src/__tests__/helpers/profileFormValidation.test.ts:134` (existing "rejects removing a field that members have already answered")

**Interfaces:**
- Consumes: existing `validateTransition(prev: PrevField[], next: ProfileFormField[], used: UsedValuesByKey): void`.
- Produces: same signature; behavior change — removing an answered field no longer throws. Type-change, source-change, duplicate-key, and in-use-option-removal still throw.

- [ ] **Step 1: Flip the failing test**

In `functions/src/__tests__/helpers/profileFormValidation.test.ts`, replace the existing test at ~line 134:

```ts
  it('allows removing a field even when members have already answered it', () => {
    const prev: PrevField[] = [{ source: 'predefined', key: 'barrio' }];
    const used: UsedValuesByKey = { barrio: new Set(['centro']) };
    // Removal is now permitted; updateCenso erases the orphaned answers.
    expect(() => { validateTransition(prev, [], used); }).not.toThrow();
  });
```

Keep the existing "rejects changing the type", "rejects changing the source", "rejects removing a select option that members have already chosen", and "allows removing a select option that no member has chosen" tests unchanged.

- [ ] **Step 2: Run the test, verify it FAILS**

Run (from repo root): `pnpm functions:test`
(The default functions config runs the pure helper tests — no emulator — and excludes `handlers/`.)
Expected: FAIL — the old code still throws `failed-precondition` on the answered-field removal, so `.not.toThrow()` fails.

- [ ] **Step 3: Remove the throw**

In `validateTransition`, the `if (!nextField)` block currently reads:

```ts
    if (!nextField) {
      const hasAnswers = prevField.key in used && used[prevField.key].size > 0;
      if (hasAnswers) {
        throw new HttpsError(
          'failed-precondition',
          `No se puede eliminar el campo "${prevField.key}" porque ya hay miembros que han respondido.`,
        );
      }
      continue;
    }
```

Replace it with:

```ts
    if (!nextField) {
      // Removal is always allowed. If the field had answers, updateCenso
      // erases them from member docs in the same batch (see updateCenso.ts).
      continue;
    }
```

- [ ] **Step 4: Run the validation tests, verify PASS**

Run (from repo root): `pnpm functions:test`
Expected: PASS — all `validateTransition` and `ensureValidFieldShape` tests green.

- [ ] **Step 5: Commit**

```bash
git add functions/src/helpers/profileFormValidation.ts functions/src/__tests__/helpers/profileFormValidation.test.ts
git commit -m "feat(functions): allow removing an answered censo field

Removal is no longer blocked when members have answered; updateCenso
erases the orphaned answers in the same write (next task).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Erase orphaned answers in `updateCenso`

**Files:**
- Modify: `functions/src/census/updateCenso.ts` (the `collectUsedValues` helper and the handler body after `validateTransition`)
- Test: `functions/src/__tests__/handlers/updateCenso.test.ts` (CREATE)

**Interfaces:**
- Consumes: `validateTransition` (Task 1); admin refs `municipalityDoc`, `municipalityMemberDoc`, `municipalityMembersCollection`; `FieldValue.delete()`.
- Produces: `updateCenso` callable that, on a successful transition, deletes `profileAnswers.<key>` for every removed key that had answers, atomically with the schema write. Return shape unchanged: `{ ok: true, fieldCount: number }`.

- [ ] **Step 1: Write the failing emulator test**

Create `functions/src/__tests__/handlers/updateCenso.test.ts`. Mirror the harness in `functions/src/__tests__/handlers/respondToOrganizerRequest.test.ts` (factory, `resetEmulators`, `ft.wrap`, `ft.cleanup`).

```ts
// Handler test for the updateCenso callable.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as admin from 'firebase-admin';
import functionsTestFactory from 'firebase-functions-test';
import { resetEmulators } from '../helpers/firestoreEmulator';
import { updateCenso } from '../../census/updateCenso';

const ft = functionsTestFactory({ projectId: process.env.GCLOUD_PROJECT || 'cultuvilla-test' });

const MID = 'mun-1';
const ADMIN_ID = 'admin-1';
const MEMBER_ID = 'member-1';

async function seedCensoMunicipality(fields: unknown[]): Promise<void> {
  const now = new Date();
  await admin.firestore().doc(`municipalities/${MID}`).set({
    name: 'Villarriba', nameLower: 'villarriba', province: 'Madrid',
    comunidadAutonoma: 'Madrid', codigoINE: '28000', coordinates: null,
    createdAt: now, escudoUrl: null, escudoThumbUrl: null, communityActive: true,
    community: { adminUserId: ADMIN_ID, description: 'x', activatedAt: now,
      profileForm: { fields, updatedAt: now } },
  });
}

async function seedMember(uid: string, role: 'user' | 'admin', profileAnswers: Record<string, unknown>): Promise<void> {
  await admin.firestore().doc(`municipalities/${MID}/members/${uid}`).set({
    userId: uid, role, joinedAt: new Date(), profileAnswers,
    profileCompletedAt: null, trustedNewsAuthor: false,
  });
}

async function call(uid: string, fields: unknown[]): Promise<unknown> {
  const wrapped = ft.wrap(updateCenso as unknown as Parameters<typeof ft.wrap>[0]);
  return wrapped({ data: { municipalityId: MID, fields }, auth: { uid } } as unknown as Parameters<typeof wrapped>[0]);
}

describe('updateCenso — removing an answered question', () => {
  beforeAll(async () => { await resetEmulators(); });
  beforeEach(async () => { await resetEmulators(); });
  afterAll(() => { ft.cleanup(); });

  it('erases the removed field from member answers and keeps the others', async () => {
    const fieldA = { source: 'custom', key: 'color', label: 'Color', type: 'text', required: false };
    const fieldB = { source: 'custom', key: 'edad', label: 'Edad', type: 'number', required: false };
    await seedCensoMunicipality([fieldA, fieldB]);
    await seedMember(ADMIN_ID, 'admin', {});
    await seedMember(MEMBER_ID, 'user', { color: 'rojo', edad: 30 });

    // Remove fieldA (color); keep fieldB (edad).
    await call(ADMIN_ID, [fieldB]);

    const mun = await admin.firestore().doc(`municipalities/${MID}`).get();
    const savedFields = mun.data()?.community?.profileForm?.fields as { key: string }[];
    expect(savedFields.map((f) => f.key)).toEqual(['edad']);

    const member = await admin.firestore().doc(`municipalities/${MID}/members/${MEMBER_ID}`).get();
    const answers = member.data()?.profileAnswers as Record<string, unknown>;
    expect(answers.color).toBeUndefined();
    expect(answers.edad).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS**

Run (from repo root): `pnpm test:functions`
(This boots the Firestore + Auth emulators and runs the integration config, which includes `handlers/`. The new file runs alongside the other handler tests.)
Expected: FAIL — current handler writes the new schema but leaves `member.profileAnswers.color` in place, so `answers.color` is still `'rojo'`.

- [ ] **Step 3: Make `collectUsedValues` also return member ids per key**

In `functions/src/census/updateCenso.ts`, change `collectUsedValues` to return both the value sets and the member ids that hold each key:

```ts
interface MemberScan {
  used: UsedValuesByKey;
  memberIdsByKey: Record<string, string[]>;
}

async function scanMembers(municipalityId: string): Promise<MemberScan> {
  const used: UsedValuesByKey = {};
  const memberIdsByKey: Record<string, string[]> = {};
  const membersSnap = await municipalityMembersCollection(db, municipalityId).get();
  for (const m of membersSnap.docs) {
    const answers = m.data().profileAnswers ?? {};
    for (const [k, v] of Object.entries(answers)) {
      const existing = used[k] as Set<string | number | boolean> | undefined;
      const bucket = existing ?? new Set<string | number | boolean>();
      if (!existing) used[k] = bucket;
      const hasValue = Array.isArray(v) ? v.length > 0 : v !== '';
      if (Array.isArray(v)) {
        for (const item of v) if (typeof item === 'string') bucket.add(item);
      } else if (v !== '') {
        bucket.add(v as string | number | boolean);
      }
      if (hasValue) {
        const ids = memberIdsByKey[k] ?? [];
        if (ids.length === 0) memberIdsByKey[k] = ids;
        ids.push(m.id);
      }
    }
  }
  return { used, memberIdsByKey };
}
```

Delete the old `collectUsedValues` function. (`UsedValuesByKey` is already imported.)

- [ ] **Step 4: Use the scan and write an atomic batch in the handler**

Replace the handler tail (from `const used = await collectUsedValues(...)` through the `await municipalityRef.update(...)` call) with:

```ts
    const { used, memberIdsByKey } = await scanMembers(municipalityId);
    validateTransition(prevFields, fields, used);

    const nextKeys = new Set(fields.map((f) => f.key));
    const removedAnsweredKeys = prevFields
      .map((f) => f.key)
      .filter((k) => !nextKeys.has(k) && (used[k]?.size ?? 0) > 0);

    const batch = db.batch();
    // .update(ref, fieldPath, value) form: serverTimestamp on the nested
    // updatedAt is fine because batch.update bypasses the converter.
    batch.update(municipalityRef, 'community.profileForm', {
      fields,
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const key of removedAnsweredKeys) {
      for (const uid of memberIdsByKey[key] ?? []) {
        batch.update(municipalityMemberDoc(db, municipalityId, uid), `profileAnswers.${key}`, FieldValue.delete());
      }
    }
    await batch.commit();

    return { ok: true, fieldCount: fields.length };
```

- [ ] **Step 5: Run the emulator suite, verify it PASSES**

Run (from repo root): `pnpm test:functions`
Expected: PASS — `answers.color` undefined, `answers.edad` === 30, schema is `['edad']`; all other handler tests still green.

- [ ] **Step 6: Run the pure helper suite too (no regressions)**

Run (from repo root): `pnpm functions:test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/src/census/updateCenso.ts functions/src/__tests__/handlers/updateCenso.test.ts
git commit -m "feat(functions): erase orphaned answers when a censo question is removed

updateCenso now scans members for the keys they hold, and in one atomic
batch writes the new schema and deletes profileAnswers.<key> for every
removed question that had answers.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `answeredCountByKey` helper in shared

**Files:**
- Modify: `packages/shared/src/services/membershipProfileService.ts` (add export next to `collectUsedValues`)
- Test: `packages/shared/test/services/membershipProfileService.test.ts` (CREATE if absent; otherwise append)

**Interfaces:**
- Consumes: `ProfileAnswers` type (already imported in the file).
- Produces: `export function answeredCountByKey(members: { profileAnswers: ProfileAnswers }[]): Record<string, number>` — count of members holding a non-empty answer per key.

- [ ] **Step 1: Write the failing test**

Create/append `packages/shared/test/services/membershipProfileService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { answeredCountByKey } from '../../src/services/membershipProfileService';

describe('answeredCountByKey', () => {
  it('counts members with a non-empty answer per key, ignoring empties', () => {
    const members = [
      { profileAnswers: { color: 'rojo', edad: 30 } },
      { profileAnswers: { color: 'azul', tags: [] as string[] } },
      { profileAnswers: { color: '', tags: ['a'] } },
    ];
    expect(answeredCountByKey(members)).toEqual({ color: 2, edad: 1, tags: 1 });
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run (from repo root): `pnpm shared:test`
Expected: FAIL — `answeredCountByKey` is not exported.

- [ ] **Step 3: Implement the helper**

Add to `packages/shared/src/services/membershipProfileService.ts`:

```ts
/**
 * Counts, per field key, how many members hold a non-empty answer. Empty
 * strings and empty arrays do not count. Used to warn the admin how many
 * answers a question deletion will erase.
 */
export function answeredCountByKey(
  members: { profileAnswers: ProfileAnswers }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of members) {
    for (const [k, v] of Object.entries(m.profileAnswers)) {
      const has = Array.isArray(v) ? v.length > 0 : v !== '' && v !== undefined && v !== null;
      if (has) out[k] = (out[k] ?? 0) + 1;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run it, verify it PASSES, then rebuild shared**

Run (from repo root): `pnpm shared:test`
Expected: PASS.
Then: `pnpm shared:build` (from repo root) so the mobile app sees the new export.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/membershipProfileService.ts packages/shared/test/services/membershipProfileService.test.ts
git commit -m "feat(shared): answeredCountByKey helper for censo delete warning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Builder UI — delete answered questions with confirmation

**Files:**
- Modify: `packages/i18n/messages/es.json` (add `censo.builder.deleteAnsweredTitle`, `censo.builder.deleteAnsweredBody`)
- Modify: `apps/mobile/components/feature/CensoSchemaEditor.tsx` (compute `answeredCountByKey`, pass per-question count to `QuestionCard`)
- Modify: `apps/mobile/components/feature/censo/QuestionCard.tsx` (always render trash button; confirm when answered)
- Test: `apps/mobile/components/feature/censo/__tests__/QuestionCard.test.tsx` (CREATE if absent; otherwise append)

**Interfaces:**
- Consumes: `answeredCountByKey` (Task 3) from `@cultuvilla/shared/services/membershipProfileService`; `showConfirm` from `apps/mobile/lib/dialogs.ts`; existing `QuestionCard` props.
- Produces: `QuestionCard` gains a required prop `answeredCount: number`. When `answeredCount > 0`, the trash press calls `showConfirm(...)` before `onRemove`; otherwise calls `onRemove` directly.

- [ ] **Step 1: Add the i18n strings**

In `packages/i18n/messages/es.json`, under `censo.builder`, add:

```json
    "deleteAnsweredTitle": "Eliminar pregunta",
    "deleteAnsweredBody": "{count, plural, one {# vecino ha respondido} other {# vecinos han respondido}} esta pregunta. Si la eliminas, se borrarán sus respuestas.",
```

Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`

- [ ] **Step 2: Write the failing component test**

Append to (or create) `apps/mobile/components/feature/censo/__tests__/QuestionCard.test.tsx`. Mock `showConfirm` and assert that for an answered question the trash press routes through it, and `onRemove` fires when the confirm callback runs.

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { QuestionCard } from '../QuestionCard';
import * as dialogs from '../../../../lib/dialogs';

jest.mock('../../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));

const baseField = { source: 'custom', key: 'color', label: 'Color', type: 'text', required: false } as const;

function renderCard(answeredCount: number, onRemove = jest.fn()) {
  const utils = render(
    <QuestionCard
      field={baseField}
      index={0}
      dispatch={jest.fn()}
      locked={answeredCount > 0}
      answeredCount={answeredCount}
      active
      onActivate={jest.fn()}
      onMove={jest.fn()}
      onRemove={onRemove}
    />,
  );
  return { ...utils, onRemove };
}

it('confirms before removing an answered question', () => {
  const spy = jest.spyOn(dialogs, 'showConfirm').mockImplementation((_t, _m, onConfirm) => onConfirm());
  const { getByLabelText, onRemove } = renderCard(3);
  fireEvent.press(getByLabelText('common.delete'));
  expect(spy).toHaveBeenCalled();
  expect(onRemove).toHaveBeenCalled();
  spy.mockRestore();
});

it('removes an unanswered question without confirmation', () => {
  const spy = jest.spyOn(dialogs, 'showConfirm');
  const { getByLabelText, onRemove } = renderCard(0);
  fireEvent.press(getByLabelText('common.delete'));
  expect(spy).not.toHaveBeenCalled();
  expect(onRemove).toHaveBeenCalled();
  spy.mockRestore();
});
```

- [ ] **Step 3: Run it, verify it FAILS**

Run: `cd apps/mobile && npx jest components/feature/censo/__tests__/QuestionCard.test.tsx`
Expected: FAIL — `QuestionCard` has no `answeredCount` prop and a locked card renders only the "En uso" label (no `common.delete` button), so `getByLabelText('common.delete')` throws.

- [ ] **Step 4: Update `QuestionCard`**

In `apps/mobile/components/feature/censo/QuestionCard.tsx`:

1. Add imports at the top:

```tsx
import { showConfirm } from '../../../lib/dialogs';
```

2. Add `answeredCount` to the destructured props and the prop type (alongside `locked`):

```tsx
  answeredCount,
```
```tsx
  answeredCount: number;
```

3. Add a delete handler inside the component (above the `return`):

```tsx
  function handleRemove() {
    if (answeredCount > 0) {
      showConfirm(
        t('censo.builder.deleteAnsweredTitle'),
        t('censo.builder.deleteAnsweredBody', { count: answeredCount }),
        onRemove,
        { confirmText: t('common.delete') },
      );
      return;
    }
    onRemove();
  }
```

4. In the footer, replace the locked/trash conditional so the trash button is **always** shown, and the "En uso" label sits beside it only when locked:

```tsx
              {locked ? (
                <Text variant="bodySm" className="text-orange-600">{t('censo.builder.locked')}</Text>
              ) : null}
              <Pressable
                onPress={handleRemove}
                accessibilityLabel={t('common.delete')}
                className="p-1"
              >
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
              </Pressable>
```

- [ ] **Step 5: Run the component test, verify it PASSES**

Run: `cd apps/mobile && npx jest components/feature/censo/__tests__/QuestionCard.test.tsx`
Expected: PASS.

- [ ] **Step 6: Wire `answeredCount` from the editor**

In `apps/mobile/components/feature/CensoSchemaEditor.tsx`:

1. Add to imports:

```tsx
import { collectUsedValues, answeredCountByKey } from '@cultuvilla/shared/services/membershipProfileService';
```
(merge with the existing `collectUsedValues` import — don't duplicate the line.)

2. In the load effect, after computing `used`, also store counts in state. Add state near the others:

```tsx
  const [answeredCounts, setAnsweredCounts] = useState<Record<string, number>>({});
```

3. Inside the effect's `(async () => { ... })`, after `setLocked(...)`:

```tsx
      setAnsweredCounts(answeredCountByKey(members));
```

4. Pass the count to each card in the `.map`:

```tsx
            answeredCount={answeredCounts[f.key] ?? 0}
```

- [ ] **Step 7: Typecheck mobile**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (the pre-existing `app/_layout.tsx(58,...)` typed-routes error may remain — ignore only that one).

- [ ] **Step 8: Run the censo jest suite (no regressions)**

Run: `cd apps/mobile && npx jest censo`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/i18n/messages/es.json apps/mobile/components/feature/CensoSchemaEditor.tsx apps/mobile/components/feature/censo/QuestionCard.tsx apps/mobile/components/feature/censo/__tests__/QuestionCard.test.tsx
git commit -m "feat(mobile): delete answered censo questions with confirmation

Answered questions now show a trash button; deleting one warns how many
vecinos answered before erasing. Editor passes answeredCountByKey to each card.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Deploy to dev and verify end-to-end

**Files:** none (deploy + manual verification).

- [ ] **Step 1: Confirm dev target and diff**

Run: `firebase use` → expect `villa-events`.
Run: `git diff --stat HEAD~4 -- functions/` to confirm only the intended function files changed.

- [ ] **Step 2: Rebuild shared and deploy the function**

Run: `pnpm shared:build && pnpm deploy:functions:dev`
Expected: `updateCenso` reports "Successful update operation."

- [ ] **Step 3: Manual device verification (hand to user)**

The user runs Metro (`cd apps/mobile && npx expo start --lan -c`) and on the censo builder for a village where a member has answered:
1. Confirm an answered question now shows a trash icon (plus "En uso").
2. Tap it → a confirmation names the count → confirm → save.
3. Reopen the censo: the question is gone, and the member's other answers are intact (cross-check in Firestore console if needed).

- [ ] **Step 4: Update memory progress note (optional)**

If tracking censo progress in `MEMORY.md`, note that answered-question deletion with answer cleanup shipped on 2026-06-23.

---

## Self-Review

**Spec coverage:**
- Relax `validateTransition` removal block → Task 1. ✅
- `updateCenso` atomic schema write + member answer deletion → Task 2. ✅
- Keep type-change / in-use-option blocks → Task 1 (tests retained). ✅
- Client `answeredCountByKey` → Task 3. ✅
- Builder trash button on answered + confirm → Task 4. ✅
- i18n strings → Task 4 Step 1. ✅
- Tests: validation flip (T1), updateCenso emulator (T2), helper unit (T3), component (T4). ✅
- Deploy to dev → Task 5. ✅

**Placeholder scan:** none — every code step shows full content.

**Type consistency:** `answeredCountByKey(members)` signature identical in Task 3 (definition) and Task 4 (consumer); `QuestionCard` gains `answeredCount: number` defined and consumed consistently; `scanMembers` returns `{ used, memberIdsByKey }` used directly in the Task 2 handler.
