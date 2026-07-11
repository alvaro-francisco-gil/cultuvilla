# Event Payment Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer flag an event as one where payment is collected, and keep a per-attendee "paid" register (a checkbox) in the organizer's roster.

**Architecture:** Mirror the existing check-in feature end to end. A new `requiresPayment: boolean` on the event (parallel to `telephoneRequired`) plus a new `paidAt: Date | null` on the registration (parallel to `checkedInAt`). A `setRegistrationPaid` service (parallel to `setRegistrationCheckIn`). Organizer-only enforcement is added at the Firestore-rules layer: any registration write touching `paidAt` requires the event organizer (the self branch is not enough for that field).

**Tech Stack:** TypeScript (strict), Zod models in `packages/shared`, Firestore + rules, Expo/React Native + NativeWind mobile UI, vitest (models/services) + `@firebase/rules-unit-testing` (rules) + jest (mobile).

## Global Constraints

- Strict TypeScript everywhere; no `any`, no `@ts-nocheck`, no `as any`.
- Components/screens/hooks must not import `firebase/*` directly — go through services in `packages/shared/src/services/`.
- New user-facing strings go through i18n (`packages/i18n/messages/es.json`) and the `useT()` adapter; no hardcoded Spanish in shipped UI.
- New schema field on an existing collection → give it a converter-safe default AND backfill dev (`villa-events`) in the same change; verify with `pnpm check:dev-conformance`.
- Icons use `iconSizes.sm | md | lg`; compose primitives (`HStack`, `Text`, `Pressable`) before raw `<View>`.
- Conventional commits, header ≤ 100 chars. Work happens in the chosen mode (worktree or direct-to-develop) decided before Task 1.
- Run `pnpm check` before declaring the feature done / opening a PR.

## File Structure

- `packages/shared/src/models/event/EventDataModel.ts` — add `requiresPayment` to schema, input, builder.
- `packages/shared/src/models/event/EventFormSchema.ts` — add `requiresPayment` to the form schema.
- `packages/shared/src/models/event/RegistrationDataModel.ts` — add `paidAt` to schema, input, builder.
- `packages/shared/src/services/registrationService.ts` — add `setRegistrationPaid`.
- `firestore.rules` — add `requiresPayment` to `isValidEventCreate`; add the `paidAt` organizer-only guard to the registration `update` rule.
- `apps/mobile/app/event/new.tsx` — `requiresPayment` state + switch + thread into create/update.
- `apps/mobile/app/event/[eventId].tsx` — pass `requiresPayment` to `EventAttendees`.
- `apps/mobile/components/feature/EventAttendees.tsx` — paid checkbox per row when `requiresPayment`.
- `packages/i18n/messages/es.json` — `event.requiresPayment`, `event.paid`.
- `scripts/backfill-event-requirespayment.mjs` — idempotent dev backfill.
- Tests: `RegistrationDataModel.test.ts`, `EventDataModel.test.ts`, `registrationService.test.ts`, a new/extended rules test, and fixture updates in event-create rules tests.

Tasks are ordered so each ends on a green, committable deliverable. Data-model tasks (1–2) land before the service (3), rules (4), backfill (5), and UI (6–7).

---

### Task 1: Add `paidAt` to the registration model

**Files:**
- Modify: `packages/shared/src/models/event/RegistrationDataModel.ts`
- Test: `packages/shared/test/models/event/RegistrationDataModel.test.ts`

**Interfaces:**
- Produces: `RegistrationData.paidAt: Date | null`; `RegistrationDataInput.paidAt?: Date | null`; `buildRegistrationData(...).paidAt` defaults to `null`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/shared/test/models/event/RegistrationDataModel.test.ts`:

```ts
  it('defaults paidAt to null when the field is absent (converter-safe)', () => {
    const { checkedInAt: _c, ...rest } = validRegistration;
    const parsed = RegistrationDataSchema.parse({ ...rest, checkedInAt: null });
    expect(parsed.paidAt).toBeNull();
  });

  it('accepts an explicit paidAt date', () => {
    const paidAt = new Date('2026-06-16T10:00:00Z');
    const parsed = RegistrationDataSchema.parse({ ...validRegistration, paidAt });
    expect(parsed.paidAt).toEqual(paidAt);
  });
```

And in the `buildRegistrationData` describe block:

```ts
  it('defaults paidAt to null when omitted', () => {
    const built = buildRegistrationData({
      userId: 'u', personId: 'p', name: 'n', status: 'confirmed', position: 1,
    });
    expect(built.paidAt).toBeNull();
    expect(() => RegistrationDataSchema.parse(built)).not.toThrow();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @cultuvilla/shared test -- RegistrationDataModel`
Expected: FAIL — `paidAt` is `undefined` / property does not exist.

- [ ] **Step 3: Add the field to schema, input, and builder**

In `RegistrationDataSchema` (after the `checkedInAt` line):

```ts
  // Set by an organizer when the attendee has paid (events with
  // requiresPayment). `.default(null)`: registrations created before this field
  // existed have no paidAt key, so reads normalize the absent field to null
  // instead of throwing the strict converter.
  paidAt: z.date().nullable().default(null),
```

In `RegistrationDataInput` (after `checkedInAt?: Date | null;`):

```ts
  paidAt?: Date | null;
```

In `buildRegistrationData` return (after `checkedInAt: input.checkedInAt ?? null,`):

```ts
    paidAt: input.paidAt ?? null,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- RegistrationDataModel`
Expected: PASS (all cases, including the two existing ones).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/event/RegistrationDataModel.ts \
        packages/shared/test/models/event/RegistrationDataModel.test.ts
git commit -m "feat(shared): add paidAt to registration model"
```

---

### Task 2: Add `requiresPayment` to the event model and form schema

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts`
- Modify: `packages/shared/src/models/event/EventFormSchema.ts`
- Test: `packages/shared/test/models/event/EventDataModel.test.ts`

**Interfaces:**
- Produces: `EventData.requiresPayment: boolean`; `EventDataInput.requiresPayment?: boolean`; `buildEventData(...).requiresPayment` defaults to `false`. `EventFormValues.requiresPayment: boolean` (form default `false`).

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/test/models/event/EventDataModel.test.ts` (inside the `buildEventData` describe block — reuse the file's existing valid input helper; the snippet below assumes a `baseEventInput` object like the file already uses to call `buildEventData`):

```ts
  it('defaults requiresPayment to false when omitted', () => {
    const built = buildEventData(baseEventInput);
    expect(built.requiresPayment).toBe(false);
    expect(() => EventDataSchema.parse(built)).not.toThrow();
  });

  it('preserves requiresPayment: true', () => {
    const built = buildEventData({ ...baseEventInput, requiresPayment: true });
    expect(built.requiresPayment).toBe(true);
  });
```

> If the test file names its input object differently (e.g. `validInput`), use that name instead — do not introduce a second fixture.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel`
Expected: FAIL — `requiresPayment` is `undefined`.

- [ ] **Step 3: Add the field to `EventDataModel.ts`**

In `EventDataSchema` (after the `telephoneRequired: z.boolean(),` line):

```ts
  // True when money is collected for the event; the organizer marks who paid
  // per-attendee via registration.paidAt. `.default(false)` so reads of event
  // docs created before this field parse instead of throwing the strict
  // converter (also backfilled in dev; see scripts/backfill-event-requirespayment.mjs).
  requiresPayment: z.boolean().default(false),
```

In `EventDataInput` (after `telephoneRequired?: boolean;`):

```ts
  requiresPayment?: boolean;
```

In `buildEventData` return (after `telephoneRequired: input.telephoneRequired ?? false,`):

```ts
    requiresPayment: input.requiresPayment ?? false,
```

- [ ] **Step 4: Add the field to `EventFormSchema.ts`**

In `EventFormSchema` object (after `telephoneRequired: z.boolean().default(false),`):

```ts
    requiresPayment: z.boolean().default(false),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- EventDataModel EventFormSchema`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/models/event/EventDataModel.ts \
        packages/shared/src/models/event/EventFormSchema.ts \
        packages/shared/test/models/event/EventDataModel.test.ts
git commit -m "feat(shared): add requiresPayment to event model + form schema"
```

---

### Task 3: Add `setRegistrationPaid` service

**Files:**
- Modify: `packages/shared/src/services/registrationService.ts`
- Test: `packages/shared/test/services/registrationService.test.ts`

**Interfaces:**
- Consumes: `RegistrationData.paidAt` (Task 1).
- Produces: `setRegistrationPaid(eventId: string, regId: string, paid: boolean): Promise<void>` — writes `paidAt = serverTimestamp()` when `paid`, else `null`, via a converter-less doc ref.

- [ ] **Step 1: Write the failing test**

Open `packages/shared/test/services/registrationService.test.ts` and find the existing `setRegistrationCheckIn` test (it mocks `firebase/firestore`'s `updateDoc`/`doc`/`serverTimestamp`). Mirror it for the new function:

```ts
  it('setRegistrationPaid writes a serverTimestamp when marking paid', async () => {
    await setRegistrationPaid('e1', 'r1', true);
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
      paidAt: SERVER_TIMESTAMP_SENTINEL,
    });
  });

  it('setRegistrationPaid writes null when clearing paid', async () => {
    await setRegistrationPaid('e1', 'r1', false);
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { paidAt: null });
  });
```

> Match the file's existing mock conventions exactly: import `setRegistrationPaid` alongside `setRegistrationCheckIn`, and reuse whatever sentinel the check-in test asserts against for `serverTimestamp()` (shown here as `SERVER_TIMESTAMP_SENTINEL`). Do not invent a new mock setup.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test -- registrationService`
Expected: FAIL — `setRegistrationPaid` is not exported.

- [ ] **Step 3: Implement the service**

In `packages/shared/src/services/registrationService.ts`, directly after `setRegistrationCheckIn`:

```ts
// Organizer marks/unmarks an attendee as paid (events with requiresPayment).
// updateDoc bypasses the converter, so the serverTimestamp()/null union is fine
// on the raw path ref. Gated by firestore.rules: any write touching paidAt
// requires the event organizer.
export async function setRegistrationPaid(
  eventId: string,
  regId: string,
  paid: boolean,
): Promise<void> {
  await updateDoc(doc(getDb(), 'events', eventId, 'registrations', regId), {
    paidAt: paid ? serverTimestamp() : null,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test -- registrationService`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/registrationService.ts \
        packages/shared/test/services/registrationService.test.ts
git commit -m "feat(shared): add setRegistrationPaid service"
```

---

### Task 4: Firestore rules — allow `requiresPayment` on create, enforce organizer-only `paidAt`

**Files:**
- Modify: `firestore.rules` (`isValidEventCreate` ~L338; registration `update` rule ~L700)
- Modify (fixtures): `packages/shared/test/e2e/shapeRules.test.ts` (`validEvent` ~L285) and any other e2e event-create fixture that includes `telephoneRequired`
- Test: `packages/shared/test/e2e/eventOrganizerRules.test.ts` (add `paidAt` cases)

**Interfaces:**
- Consumes: `isEventOrganizer(eventId)` helper (existing, ~L42).
- Produces: rules that (a) accept `requiresPayment: bool` in an event create, and (b) reject any registration update whose `affectedKeys()` include `paidAt` unless `isEventOrganizer(eventId)`.

- [ ] **Step 1: Add the failing/updated rules tests**

In `packages/shared/test/e2e/eventOrganizerRules.test.ts`, extend the seed registration doc to include `paidAt: null` (add `paidAt: null,` to the `registrations/r1` object at ~L19), then add these cases inside the describe block:

```ts
  it('organizer can mark a registration paid; a stranger cannot', async () => {
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(updateDoc(doc(boss, `events/${E}/registrations/r1`), { paidAt: new Date() }));
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(updateDoc(doc(stranger, `events/${E}/registrations/r1`), { paidAt: new Date() }));
  });

  it('the registrant themselves CANNOT mark their own registration paid', async () => {
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, `events/${E}/registrations/r1`), { paidAt: new Date() }));
  });

  it('village admin can mark a registration paid', async () => {
    const vb = asUser(getEnv(), 'villageboss');
    await assertSucceeds(updateDoc(doc(vb, `events/${E}/registrations/r1`), { paidAt: new Date() }));
  });
```

- [ ] **Step 2: Run the rules test to verify the new cases fail**

Run: `pnpm --filter @cultuvilla/shared test -- eventOrganizerRules`
Expected: FAIL — the registrant-paid case currently SUCCEEDS (self branch allows it), so `assertFails` throws.

> This suite needs the Firestore emulator; run it via the repo's emulator test harness (`pnpm test:rules` or `pnpm test:emulators` if the per-file filter isn't wired for the emulator runner).

- [ ] **Step 3: Add the `paidAt` guard to the registration `update` rule**

In `firestore.rules`, replace the registration `update` rule (~L700-701) with:

```
        // Self may update their own registration; an organizer may too
        // (check-in via `checkedInAt`, or removing a no-show / walk-in).
        // EXCEPTION: writes touching `paidAt` are the paid register and are
        // organizer-only — a registrant must not be able to self-mark paid.
        allow update: if (
             (isAuthenticated() && resource.data.userId == request.auth.uid)
          || isEventOrganizer(eventId)
        ) && (
          !request.resource.data.diff(resource.data).affectedKeys().hasAny(['paidAt'])
          || isEventOrganizer(eventId)
        );
```

- [ ] **Step 4: Add `requiresPayment` to `isValidEventCreate`**

In `firestore.rules`, in `isValidEventCreate` (~L338): add `'requiresPayment'` to BOTH the `hasOnly([...])` list (~L341) and the `hasAll([...])` list (~L350), placed next to `'telephoneRequired'`. Then add the type check next to the `telephoneRequired` one (~L370):

```
          && isBool(d.requiresPayment)
```

- [ ] **Step 5: Update event-create fixtures**

Because `requiresPayment` is now required by `hasAll`, every e2e fixture that creates a full event doc must include it. In `packages/shared/test/e2e/shapeRules.test.ts`, add `requiresPayment: false,` to the `validEvent` object (~L293, next to `telephoneRequired: false,`). Grep for others and fix each:

```bash
grep -rln "telephoneRequired: false" packages/shared/test/e2e/
```

Add `requiresPayment: false,` beside each `telephoneRequired: false,` in event-create fixtures the grep surfaces (e.g. `eventOrglessRules.test.ts`, `eventOrganizerUserRules.test.ts`, `interactionRules.test.ts` if they build a full create doc).

- [ ] **Step 6: Run the rules tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test -- eventOrganizerRules shapeRules`
(or the full `pnpm test:rules` if using the emulator harness)
Expected: PASS — organizer/admin can set `paidAt`, registrant cannot, event create with `requiresPayment` succeeds and wrong-type is rejected.

- [ ] **Step 7: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/
git commit -m "feat(rules): accept requiresPayment on event; make paidAt organizer-only"
```

---

### Task 5: Dev backfill for `requiresPayment`

**Files:**
- Create: `scripts/backfill-event-requirespayment.mjs`

**Interfaces:**
- Consumes: nothing in-code; patches dev Firestore `events` docs missing `requiresPayment`.

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill-event-requirespayment.mjs`, mirroring `scripts/backfill-municipality-namelower.mjs` (project-id guard for `villa-events`, admin SDK via `GOOGLE_APPLICATION_CREDENTIALS`, idempotent — only patch docs missing the field):

```js
// Idempotent dev backfill: set events.requiresPayment = false on any event doc
// that predates the field. Mirrors scripts/backfill-municipality-namelower.mjs.
// Dev only (villa-events); refuses to run against any other project.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT = 'villa-events';
const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT });
const db = getFirestore(app);
if (app.options.projectId !== PROJECT) {
  throw new Error(`Refusing to run against ${app.options.projectId}; expected ${PROJECT}`);
}

const snap = await db.collection('events').get();
let patched = 0;
for (const d of snap.docs) {
  if (d.get('requiresPayment') === undefined) {
    await d.ref.update({ requiresPayment: false });
    patched += 1;
  }
}
console.log(`Backfilled requiresPayment on ${patched}/${snap.size} event docs.`);
process.exit(0);
```

> Follow the `firebase-admin-dev` skill for credentials. If `backfill-municipality-namelower.mjs` uses a different init/guard idiom (e.g. a shared helper), copy that idiom instead of the above.

- [ ] **Step 2: Run the backfill against dev**

Run: `GOOGLE_APPLICATION_CREDENTIALS=<dev-key> node scripts/backfill-event-requirespayment.mjs`
Expected: prints `Backfilled requiresPayment on N/M event docs.` (N may be 0 on a fresh dev DB — the `.default(false)` still covers reads).

- [ ] **Step 3: Verify dev conformance**

Run: `pnpm check:dev-conformance`
Expected: no nonconforming `events` docs reported for `requiresPayment`.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-event-requirespayment.mjs
git commit -m "chore(scripts): backfill event requiresPayment in dev"
```

---

### Task 6: i18n strings + create/edit form switch

**Files:**
- Modify: `packages/i18n/messages/es.json` (the `event` namespace, near `telephoneRequired` ~L502)
- Modify: `apps/mobile/app/event/new.tsx`

**Interfaces:**
- Consumes: `EventFormValues.requiresPayment` (Task 2), `updateEvent`/`createEvent` accepting `requiresPayment` (already generic over the event shape).
- Produces: form persists `requiresPayment` on create and edit.

- [ ] **Step 1: Add the i18n strings**

In `packages/i18n/messages/es.json`, inside the `event` object, add (follow the `i18n-add-string` skill for placement/format):

```json
    "requiresPayment": "Se paga en el evento",
    "paid": "Pagado",
```

- [ ] **Step 2: Add form state and load-on-edit**

In `apps/mobile/app/event/new.tsx`:

After `const [telephoneRequired, setTelephoneRequired] = useState(false);` (~L104):

```tsx
  const [requiresPayment, setRequiresPayment] = useState(false);
```

In the edit-mode loader, after `setTelephoneRequired(!!ev.telephoneRequired);` (~L161):

```tsx
        setRequiresPayment(!!ev.requiresPayment);
```

- [ ] **Step 3: Thread into create and update payloads**

In the edit branch `updateEvent(eventId, {...})` (~L236), after `telephoneRequired,`:

```tsx
          requiresPayment,
```

In the create branch `createEvent({...})` (~L259), after `telephoneRequired,`:

```tsx
        requiresPayment,
```

- [ ] **Step 4: Add the switch to the form UI**

In `apps/mobile/app/event/new.tsx`, directly after the `telephoneRequired` `HStack` block (closing `</HStack>` ~L470), add a parallel row:

```tsx
          <HStack className="items-center justify-between py-1">
            <Text className="flex-1">{t('event.requiresPayment')}</Text>
            <HStack gap={2} className="items-center">
              <Text tone="muted">{requiresPayment ? t('common.yes') : t('common.no')}</Text>
              <Toggle
                value={requiresPayment}
                onValueChange={setRequiresPayment}
                testID="requires-payment"
              />
            </HStack>
          </HStack>
```

- [ ] **Step 5: Typecheck the mobile app**

Run: `pnpm app:typecheck`
Expected: PASS (no type errors from the new field / props).

- [ ] **Step 6: Commit**

```bash
git add packages/i18n/messages/es.json apps/mobile/app/event/new.tsx
git commit -m "feat(mobile): add requiresPayment switch to event form"
```

---

### Task 7: Paid checkbox in the organizer roster

**Files:**
- Modify: `apps/mobile/components/feature/EventAttendees.tsx`
- Modify: `apps/mobile/app/event/[eventId].tsx` (~L220)
- Test: `apps/mobile/components/feature/__tests__/EventAttendees.test.tsx`

**Interfaces:**
- Consumes: `setRegistrationPaid` (Task 3), `RegistrationData.paidAt` (Task 1), `event.requiresPayment` (Task 2).
- Produces: an organizer-visible paid checkbox per attendee, shown only when `requiresPayment`.

- [ ] **Step 1: Pass `requiresPayment` from the detail screen**

In `apps/mobile/app/event/[eventId].tsx` (~L220), change:

```tsx
            <EventAttendees eventId={event.id} telephoneRequired={!!event.telephoneRequired} />
```

to:

```tsx
            <EventAttendees
              eventId={event.id}
              telephoneRequired={!!event.telephoneRequired}
              requiresPayment={!!event.requiresPayment}
            />
```

- [ ] **Step 2: Write the failing UI test**

In `apps/mobile/components/feature/__tests__/EventAttendees.test.tsx`, mirror the existing check-in/remove test setup (it already mocks `registrationService`). Add:

```tsx
  it('shows a paid checkbox per attendee and toggles setRegistrationPaid when requiresPayment', async () => {
    // getEventRegistrations mock returns a row r1 with paidAt: null (extend the
    // existing mock roster the file uses).
    const { getByTestId } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment />,
    );
    await waitFor(() => getByTestId('paid-attendee-r1'));
    fireEvent.press(getByTestId('paid-attendee-r1'));
    expect(setRegistrationPaid).toHaveBeenCalledWith('e1', 'r1', true);
  });

  it('hides the paid checkbox when requiresPayment is false', async () => {
    const { queryByTestId, getByText } = render(
      <EventAttendees eventId="e1" telephoneRequired={false} requiresPayment={false} />,
    );
    await waitFor(() => getByText('Alice')); // roster loaded
    expect(queryByTestId('paid-attendee-r1')).toBeNull();
  });
```

> Match the file's existing render/mocks (attendee name, `setRegistrationPaid` import from the mocked `registrationService`, `waitFor`/`fireEvent` imports). Reuse the existing roster fixture; just ensure it carries `paidAt: null`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm app:test -- EventAttendees`
Expected: FAIL — `requiresPayment` prop unknown / `paid-attendee-r1` not found.

- [ ] **Step 4: Implement the checkbox**

In `apps/mobile/components/feature/EventAttendees.tsx`:

Extend the props type:

```tsx
export function EventAttendees({
  eventId,
  telephoneRequired,
  requiresPayment,
}: {
  eventId: string;
  telephoneRequired: boolean;
  requiresPayment: boolean;
}) {
```

Add the toggle handler (near `load`, after it):

```tsx
  const togglePaid = useCallback(
    async (regId: string, next: boolean) => {
      await setRegistrationPaid(eventId, regId, next);
      await load();
    },
    [eventId, load],
  );
```

Import it at the top alongside the other service imports:

```tsx
import {
  getEventRegistrations,
  getRegistrationPhone,
  cancelRegistration,
  setRegistrationPaid,
} from '@cultuvilla/shared/services/registrationService';
```

In the row JSX, before the call button (`{telephoneRequired && phones[r.id] ? (` block), add:

```tsx
            {requiresPayment ? (
              <Pressable
                testID={`paid-attendee-${r.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: r.paidAt != null }}
                accessibilityLabel={t('event.paid')}
                onPress={() => void togglePaid(r.id, r.paidAt == null)}
              >
                <Ionicons
                  name={r.paidAt != null ? 'checkbox' : 'square-outline'}
                  size={iconSizes.md}
                  color={r.paidAt != null ? colors.light.fg.accent : colors.light.fg.muted}
                />
              </Pressable>
            ) : null}
```

> `colors.light.fg.muted` — if that token name differs in the design system, use the muted foreground token the file/codebase already uses; do not hardcode a hex value.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm app:test -- EventAttendees`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/EventAttendees.tsx \
        apps/mobile/app/event/[eventId].tsx \
        apps/mobile/components/feature/__tests__/EventAttendees.test.tsx
git commit -m "feat(mobile): paid checkbox per attendee in organizer roster"
```

---

### Task 8: Full gate + docs + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md` (`## [Unreleased]`)
- Modify: `packages/shared/src/services/_services-map.md` if it enumerates `registrationService` exports

- [ ] **Step 1: Run the full check gate**

Run: `pnpm check`
Expected: lint + typecheck + tests + build all green. Fix anything red before proceeding.

- [ ] **Step 2: Note the change in the CHANGELOG**

Under `## [Unreleased]` in `CHANGELOG.md`, add a bullet:

```md
- Events can be flagged as requiring payment; organizers mark who has paid per attendee.
```

- [ ] **Step 3: Update the services map if needed**

If `packages/shared/src/services/_services-map.md` lists `registrationService`'s functions, add `setRegistrationPaid`. (Skip if it doesn't enumerate per-function.)

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md packages/shared/src/services/_services-map.md
git commit -m "docs: note event payment register in changelog + services map"
```

- [ ] **Step 5: Verify end to end (optional, recommended)**

Follow the `verify` / `drive-android-avd` skills to drive the app: create an event with "Se paga en el evento" on, register an attendee, open the organizer roster, tick the paid box, confirm it persists on reload.

---

## Self-Review

- **Spec coverage:** event flag (Task 2), registration `paidAt` (Task 1), `setRegistrationPaid` service (Task 3), organizer-only enforcement in rules (Task 4), backfill + conformance (Task 5), form switch shown only via the flag (Task 6), paid checkbox shown only when `requiresPayment` and organizer-gated by the roster's `canOrganize` render (Task 7), i18n (Task 6), tests at model/service/rules/UI layers (Tasks 1–4, 7), docs/CHANGELOG (Task 8). Out-of-scope items (amounts, online payment) are not implemented — correct.
- **Placeholder scan:** no TBD/TODO; every code step shows the code. Test snippets that depend on an existing fixture name (`baseEventInput`, mock sentinels, roster fixture) call that dependency out explicitly rather than inventing a parallel one.
- **Type consistency:** `requiresPayment: boolean` and `paidAt: Date | null` used identically across model, service, rules fixtures, and UI. `setRegistrationPaid(eventId, regId, paid)` signature matches between Task 3 definition and Task 7 consumption. `EventAttendees` prop set (`eventId`, `telephoneRequired`, `requiresPayment`) matches between Task 7 definition and its Task 7 detail-screen call site.
