# Auth & Persona Onboarding Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `UserData` from `PersonData` cleanly, add a real persona-creation step to onboarding (avatar, date picker, village picker), and polish the auth screens (forgot-password, password reveal, Google button on signup).

**Architecture:** `users/{uid}` becomes pure account metadata; `persons/{personId}` is the persona (already exists, no schema change). Onboarding is one scrollable screen with two sections — "Tu cuenta" patches `users/{uid}`, "Tu persona" creates `persons/{personId}` then patches `users/{uid}.personId`. The redirect gate widens to fire when `!profile || !profile.personId`.

**Tech Stack:** Expo 54, expo-router, Firebase JS SDK (auth/firestore/storage), `expo-image-picker` (already installed), `@react-native-community/datetimepicker` (new), Vitest for `packages/shared` tests, Jest + RTL for mobile component tests, `@firebase/rules-unit-testing` for rules tests.

**Source spec:** retired (recover via `git log -- docs/superpowers/specs/2026-05-24-auth-and-persona-redesign-design.md`).

## Status

- **Updated:** 2026-06-13
- **Stage:** persona-first onboarding shipped; auth-screen polish + `UserData` slimming outstanding
- **Branch:** `main`
- **Done:** `complete-profile.tsx` rewritten (two sections, persona-first write order); onboarding redirect gate widened to `!profile || !profile.personId`; primitives `Avatar`/`DateField`/`PasswordInput`/`VillagePicker`; `patchUserProfile` in `userService`
- **Next:** decide whether the shipped email-link auth flow supersedes the spec's password-reveal + password-reset screens; then either slim `birthday`/`biography`/`photoURL` off `UserData` or accept the denormalization on purpose
- **Blockers:** spec drift — the live auth screens use an email-link flow, not the password-based screens the spec described. Confirm intended direction before "finishing" the plan.
- **Handoff:** `UserData` still denormalizes persona fields; the spec is **not** the source of truth here — verify against the shipped auth screens before acting.

---

## File Structure

**Created:**
- `apps/mobile/components/primitives/Avatar.tsx`
- `apps/mobile/components/primitives/DateField.tsx`
- `apps/mobile/components/primitives/PasswordInput.tsx`
- `apps/mobile/components/primitives/VillagePicker.tsx`
- `apps/mobile/components/primitives/__tests__/PasswordInput.test.tsx`
- `apps/mobile/components/primitives/__tests__/DateField.test.tsx`
- `apps/mobile/app/(onboarding)/__tests__/complete-profile.test.tsx`
- `packages/shared/test/services/userService.test.ts`
- `packages/shared/test/e2e/personRules.test.ts`

**Modified:**
- `packages/shared/src/models/user/UserDataModel.ts` — remove `birthday`, `biography`, `photoURL`.
- `packages/shared/src/services/userService.ts` — drop dropped fields from read/write; add `patchUserProfile`.
- `packages/shared/test/integration/villageRoundtrip.test.ts` — adjust if it touches `UserData` fields.
- `apps/mobile/app/_layout.tsx` — widen onboarding gate.
- `apps/mobile/app/(auth)/login.tsx` — password reveal + forgot-password link.
- `apps/mobile/app/(auth)/signup.tsx` — Google button + password reveal + hint.
- `apps/mobile/app/(onboarding)/complete-profile.tsx` — full rebuild.
- `apps/mobile/components/primitives/index.ts` — export new primitives.
- `apps/mobile/package.json` — add `@react-native-community/datetimepicker`.
- `packages/i18n/messages/es.json` — new keys under `auth.*` and `onboarding.completeProfile.*`.

**No change** (verified during planning):
- `packages/shared/src/models/person/PersonDataModel.ts` — already has everything needed.
- `packages/shared/src/services/personService.ts` — `createPerson`, `getPersonByUserId`, `updatePerson` already exist.
- `packages/shared/src/services/imageService.ts` — `uploadPersonImage` already exists.
- `packages/shared/src/services/municipalityService.ts` — `getMunicipalities`, `getActiveCommunities` already exist.
- `firestore.rules` — `/persons/{personId}` create/update rules already match our write order. Verified by adding rules tests in Task 13.

---

## Task 1: Slim the `UserData` model

**Files:**
- Modify: `packages/shared/src/models/user/UserDataModel.ts`

- [ ] **Step 1: Replace the model file**

```ts
export interface UserData {
  displayName: string
  email: string
  telephone: string | null
  activeMunicipalityId: string | null
  personId: string | null
  createdAt: Date
}

export interface UserDataInput {
  displayName: string
  email: string
  telephone?: string | null
  activeMunicipalityId?: string | null
  personId?: string | null
  createdAt?: Date
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    telephone: input.telephone ?? null,
    activeMunicipalityId: input.activeMunicipalityId ?? null,
    personId: input.personId ?? null,
    createdAt: input.createdAt ?? new Date(),
  }
}
```

- [ ] **Step 2: Verify nothing else in `packages/shared` imports the dropped fields**

Run: `pnpm --filter @cultuvilla/shared exec tsc --noEmit`

Expected: compilation errors only in `userService.ts` (handled in Task 2) and any test fixtures using the dropped fields. Note them — they're addressed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/models/user/UserDataModel.ts
git commit -m "refactor(shared): move biography/photo/birthday off UserData"
```

---

## Task 2: Update `userService` for the new shape

**Files:**
- Modify: `packages/shared/src/services/userService.ts`
- Test: `packages/shared/test/services/userService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  createUserProfile,
  getUserProfile,
  patchUserProfile,
} from '../../src/services/userService';
import { setFirebaseAppForTesting } from '../../src/firebase';

let env: RulesTestEnvironment;

beforeEach(async () => {
  env = await initializeTestEnvironment({
    projectId: 'cultuvilla-test',
    firestore: { rules: 'service cloud.firestore { match /databases/{db}/documents { match /{document=**} { allow read, write: if true; } } }' },
  });
  await env.clearFirestore();
});

describe('userService.createUserProfile + patchUserProfile', () => {
  it('writes only account fields and never touches dropped ones', async () => {
    const ctx = env.authenticatedContext('uid-1');
    setFirebaseAppForTesting(ctx.firestore() as never);

    await createUserProfile('uid-1', {
      displayName: 'Ana',
      email: 'ana@example.com',
      telephone: '600000000',
    });

    const profile = await getUserProfile('uid-1');
    expect(profile).toMatchObject({
      id: 'uid-1',
      displayName: 'Ana',
      email: 'ana@example.com',
      telephone: '600000000',
      activeMunicipalityId: null,
      personId: null,
    });
    expect(profile).not.toHaveProperty('birthday');
    expect(profile).not.toHaveProperty('biography');
    expect(profile).not.toHaveProperty('photoURL');

    await patchUserProfile('uid-1', { personId: 'person-1' });
    const after = await getUserProfile('uid-1');
    expect(after?.personId).toBe('person-1');
    expect(after?.displayName).toBe('Ana');
  });
});
```

(Adapt the firebase test wiring to match what `packages/shared/test/setup` already exposes — copy the pattern from `packages/shared/test/services/registrationService.test.ts`. If that test uses a different harness shape, mirror it rather than the snippet above.)

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @cultuvilla/shared test userService`

Expected: FAIL — `patchUserProfile` is undefined and `mapUserDoc` still emits `birthday`/`biography`/`photoURL`.

- [ ] **Step 3: Update `userService.ts`**

Replace the file with:

```ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import type { UserData, UserDataInput } from '../models/user/UserDataModel';

function mapUserDoc(id: string, data: Record<string, unknown>): UserData & { id: string } {
  return {
    id,
    displayName: data['displayName'] as string,
    email: data['email'] as string,
    telephone: (data['telephone'] as string) ?? null,
    activeMunicipalityId: (data['activeMunicipalityId'] as string) ?? null,
    personId: (data['personId'] as string) ?? null,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

export async function getUserProfile(
  userId: string,
): Promise<(UserData & { id: string }) | null> {
  const snap = await getDoc(doc(getDb(), 'users', userId));
  if (!snap.exists()) return null;
  return mapUserDoc(snap.id, snap.data());
}

export async function getAllUsers(): Promise<(UserData & { id: string })[]> {
  const q = query(collection(getDb(), 'users'), orderBy('displayName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapUserDoc(d.id, d.data()));
}

export async function createUserProfile(
  userId: string,
  input: UserDataInput,
): Promise<void> {
  const docRef = doc(getDb(), 'users', userId);
  await setDoc(docRef, {
    displayName: input.displayName,
    email: input.email,
    telephone: input.telephone ?? null,
    activeMunicipalityId: input.activeMunicipalityId ?? null,
    personId: input.personId ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function patchUserProfile(
  userId: string,
  data: Partial<Pick<UserData, 'displayName' | 'telephone' | 'activeMunicipalityId' | 'personId'>>,
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), data);
}

export async function setActiveMunicipality(
  userId: string,
  municipalityId: string | null,
): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), { activeMunicipalityId: municipalityId });
}
```

The old `updateUserProfile` export is removed — every caller is migrated to `patchUserProfile` in the next step.

- [ ] **Step 4: Update callers of the removed `updateUserProfile`**

Run: `rg -n "updateUserProfile" packages apps`

Expected output: zero or a handful of call sites. For each call site, rewrite as `patchUserProfile(uid, { ... })`. If a caller relied on `biography`/`photoURL` being on `users`, port the call to either `updatePerson` (persona fields) or delete it (no longer applicable).

- [ ] **Step 5: Run tests + typecheck**

Run:
```bash
pnpm --filter @cultuvilla/shared test userService
pnpm --filter @cultuvilla/shared exec tsc --noEmit
```

Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/userService.ts packages/shared/test/services/userService.test.ts
git commit -m "refactor(shared): userService writes only account fields, add patchUserProfile"
```

---

## Task 3: Widen the onboarding redirect gate

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Locate the gate**

Open `apps/mobile/app/_layout.tsx`. The current line (around 35) is:

```ts
const needsOnboarding = !!user && profileChecked && !profile;
```

- [ ] **Step 2: Replace with**

```ts
const needsOnboarding =
  !!user && profileChecked && (!profile || !profile.personId);
```

No other change in this file.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): route to onboarding when persona is missing"
```

---

## Task 4: Install `@react-native-community/datetimepicker`

**Files:**
- Modify: `apps/mobile/package.json` (via Expo install)

- [ ] **Step 1: Install via Expo so the version matches Expo SDK 54**

Run (from repo root):
```bash
pnpm --filter cultuvilla-mobile exec npx expo install @react-native-community/datetimepicker
```

Expected: package added under `dependencies` in `apps/mobile/package.json`. Note the resolved version (Expo picks one compatible with SDK 54).

- [ ] **Step 2: Rebuild native code**

This is a native module — Metro alone is not enough. Run the project skill:

Invoke: `Skill` tool with `expo-native-rebuild` and follow its checklist for `apps/mobile`.

- [ ] **Step 3: Smoke test**

After rebuild, launch the app on a device/emulator (`pnpm --filter cultuvilla-mobile run android` or `ios`). Confirm the app boots without a "native module not found" error. We don't render the picker yet — this is just verifying the install.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): add @react-native-community/datetimepicker"
```

---

## Task 5: `Avatar` primitive

**Files:**
- Create: `apps/mobile/components/primitives/Avatar.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`

- [ ] **Step 1: Write `Avatar.tsx`**

```tsx
import { Image, View, StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface AvatarProps {
  uri?: string | null;
  size?: number;
  initials?: string;
  onPress?: () => void;
}

export function Avatar({ uri, size = 96, initials, onPress }: AvatarProps) {
  const radius = size / 2;
  const content = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text variant="h2" tone="muted">{initials ?? '+'}</Text>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Export from the primitives barrel**

In `apps/mobile/components/primitives/index.ts`, add:

```ts
export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/primitives/Avatar.tsx apps/mobile/components/primitives/index.ts
git commit -m "feat(mobile): add Avatar primitive"
```

---

## Task 6: `DateField` primitive

**Files:**
- Create: `apps/mobile/components/primitives/DateField.tsx`
- Test: `apps/mobile/components/primitives/__tests__/DateField.test.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { DateField } from '../DateField';

describe('DateField', () => {
  it('shows the formatted date or a placeholder', () => {
    const { getByText, rerender } = render(
      <DateField label="Cumple" value={null} onChange={() => {}} placeholder="DD/MM/AAAA" />,
    );
    expect(getByText('DD/MM/AAAA')).toBeTruthy();

    rerender(
      <DateField label="Cumple" value={new Date(1990, 4, 17)} onChange={() => {}} />,
    );
    // The exact format depends on locale — assert the year shows up.
    expect(getByText(/1990/)).toBeTruthy();
  });

  it('opens the picker on press', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <DateField label="Cumple" value={null} onChange={onChange} placeholder="DD/MM/AAAA" />,
    );
    fireEvent.press(getByText('DD/MM/AAAA'));
    // Picker visibility is platform-specific; assert the wrapper toggled by re-rendering and
    // checking for an internal testID.
    expect(true).toBe(true); // placeholder — replace with a testID assertion once the component exposes one.
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter cultuvilla-mobile test DateField`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DateField.tsx`**

```tsx
import { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'DD/MM/AAAA',
  minimumDate,
  maximumDate,
  testID,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS !== 'ios') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(selected);
  }

  return (
    <View testID={testID}>
      <Text tone="muted">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        testID={testID ? `${testID}-trigger` : undefined}
      >
        <Text>{value ? formatDate(value) : placeholder}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value ?? maximumDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 4: Export from the barrel + tighten the test**

In `apps/mobile/components/primitives/index.ts`:
```ts
export { DateField } from './DateField';
export type { DateFieldProps } from './DateField';
```

Update the second test in step 1 to assert `getByTestId('cumple-trigger')` exists after passing `testID="cumple"`.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter cultuvilla-mobile test DateField`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/primitives/DateField.tsx apps/mobile/components/primitives/__tests__/DateField.test.tsx apps/mobile/components/primitives/index.ts
git commit -m "feat(mobile): add DateField primitive"
```

---

## Task 7: `PasswordInput` primitive

**Files:**
- Create: `apps/mobile/components/primitives/PasswordInput.tsx`
- Test: `apps/mobile/components/primitives/__tests__/PasswordInput.test.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput', () => {
  it('toggles secure entry when the reveal button is pressed', () => {
    const { getByTestId } = render(
      <PasswordInput label="Contraseña" value="hunter2" onChangeText={() => {}} testID="pw" />,
    );
    const input = getByTestId('pw-input');
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent.press(getByTestId('pw-toggle'));
    expect(input.props.secureTextEntry).toBe(false);

    fireEvent.press(getByTestId('pw-toggle'));
    expect(input.props.secureTextEntry).toBe(true);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter cultuvilla-mobile test PasswordInput`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, type InputProps } from './Input';
import { Pressable } from './Pressable';

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry'> & {
  testID?: string;
};

export function PasswordInput({ testID, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.row}>
      <View style={styles.input}>
        <Input {...rest} secureTextEntry={!visible} testID={testID ? `${testID}-input` : undefined} />
      </View>
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        testID={testID ? `${testID}-toggle` : undefined}
        style={styles.toggle}
      >
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
  input: { flex: 1 },
  toggle: { position: 'absolute', right: 12, bottom: 12 },
});
```

If `Input` doesn't accept `testID`, plumb it through (one extra prop on the `Input` component).

- [ ] **Step 4: Export from the barrel**

In `apps/mobile/components/primitives/index.ts`:
```ts
export { PasswordInput } from './PasswordInput';
export type { PasswordInputProps } from './PasswordInput';
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter cultuvilla-mobile test PasswordInput`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/primitives/PasswordInput.tsx apps/mobile/components/primitives/__tests__/PasswordInput.test.tsx apps/mobile/components/primitives/index.ts apps/mobile/components/primitives/Input.tsx
git commit -m "feat(mobile): add PasswordInput primitive"
```

(Only stage `Input.tsx` if you had to plumb `testID` through it.)

---

## Task 8: `VillagePicker` primitive

**Files:**
- Create: `apps/mobile/components/primitives/VillagePicker.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, TextInput, View, StyleSheet } from 'react-native';
import { getMunicipalities } from '@cultuvilla/shared/services/municipalityService';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Button } from './Button';

interface Option {
  id: string;
  displayName: string;
}

export interface VillagePickerProps {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export function VillagePicker({ label, value, onChange, placeholder = 'Sin pueblo' }: VillagePickerProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open || options.length > 0) return;
    let cancelled = false;
    getMunicipalities().then((list) => {
      if (cancelled) return;
      setOptions(
        list.map((m) => ({ id: m.id, displayName: (m as { displayName?: string }).displayName ?? m.id })),
      );
    });
    return () => { cancelled = true; };
  }, [open, options.length]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.displayName.toLowerCase().includes(q));
  }, [options, filter]);

  const selected = options.find((o) => o.id === value);

  return (
    <View>
      <Text tone="muted">{label}</Text>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button">
        <Text>{selected ? selected.displayName : placeholder}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <TextInput
            placeholder="Buscar pueblo"
            value={filter}
            onChangeText={setFilter}
            style={styles.search}
            autoCapitalize="none"
          />
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                  setFilter('');
                }}
                style={styles.row}
              >
                <Text>{item.displayName}</Text>
              </Pressable>
            )}
          />
          <View style={styles.actions}>
            {value && (
              <Button variant="secondary" onPress={() => { onChange(null); setOpen(false); }}>
                <Text>Quitar</Text>
              </Button>
            )}
            <Button variant="secondary" onPress={() => setOpen(false)}>
              <Text>Cancelar</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, padding: 16, gap: 12 },
  search: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  actions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
});
```

If the `MunicipalityData` shape uses a different property than `displayName` for the village name, fix the read in the `setOptions` call to match (open `packages/shared/src/models/municipality/MunicipalityDataModel.ts` and use the canonical name field).

- [ ] **Step 2: Export from the barrel**

```ts
export { VillagePicker } from './VillagePicker';
export type { VillagePickerProps } from './VillagePicker';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/primitives/VillagePicker.tsx apps/mobile/components/primitives/index.ts
git commit -m "feat(mobile): add VillagePicker primitive"
```

---

## Task 9: Rebuild `complete-profile.tsx` with two sections

**Files:**
- Modify: `apps/mobile/app/(onboarding)/complete-profile.tsx`
- Test: `apps/mobile/app/(onboarding)/__tests__/complete-profile.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CompleteProfileScreen from '../complete-profile';

jest.mock('@cultuvilla/shared/services/personService', () => ({
  createPerson: jest.fn().mockResolvedValue('person-1'),
  updatePerson: jest.fn().mockResolvedValue(undefined),
  getPersonByUserId: jest.fn().mockResolvedValue(null),
}));
jest.mock('@cultuvilla/shared/services/userService', () => ({
  createUserProfile: jest.fn().mockResolvedValue(undefined),
  patchUserProfile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@cultuvilla/shared/services/imageService', () => ({
  uploadPersonImage: jest.fn(),
}));
jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1', email: 'a@b.test', displayName: null },
    profile: null,
    refreshProfile: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('CompleteProfileScreen', () => {
  it('rejects submit when displayName or givenName are empty', async () => {
    const { getByText } = render(<CompleteProfileScreen />);
    fireEvent.press(getByText(/Crear perfil/i));
    await waitFor(() => {
      expect(getByText(/Nombre.*obligatorio|requerido/i)).toBeTruthy();
    });
  });

  it('writes person first, then account, in order', async () => {
    const { createPerson } = await import('@cultuvilla/shared/services/personService');
    const { createUserProfile, patchUserProfile } = await import('@cultuvilla/shared/services/userService');
    const callOrder: string[] = [];
    (createPerson as jest.Mock).mockImplementation(async () => { callOrder.push('person'); return 'person-1'; });
    (createUserProfile as jest.Mock).mockImplementation(async () => { callOrder.push('user'); });
    (patchUserProfile as jest.Mock).mockImplementation(async () => { callOrder.push('patch'); });

    const { getByLabelText, getByText } = render(<CompleteProfileScreen />);
    fireEvent.changeText(getByLabelText(/Nombre visible/i), 'Ana');
    fireEvent.changeText(getByLabelText(/^Nombre$/i), 'Ana');
    fireEvent.press(getByText(/Crear perfil/i));

    await waitFor(() => {
      expect(callOrder[0]).toBe('person');
      expect(callOrder).toContain('user');
    });
  });
});
```

(The exact labels must match the i18n strings added in Task 12 — if they don't yet exist, you can hardcode the Spanish copy in this test or run Task 12 first.)

- [ ] **Step 2: Run the test**

Run: `pnpm --filter cultuvilla-mobile test complete-profile`

Expected: FAIL.

- [ ] **Step 3: Replace `complete-profile.tsx`**

```tsx
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Screen,
  VStack,
  Text,
  Input,
  Button,
  Avatar,
  DateField,
  VillagePicker,
} from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import {
  createPerson,
  updatePerson,
  getPersonByUserId,
} from '@cultuvilla/shared/services/personService';
import {
  createUserProfile,
  patchUserProfile,
} from '@cultuvilla/shared/services/userService';
import { uploadPersonImage } from '@cultuvilla/shared/services/imageService';
import type { Sex, PartialDate, MunicipalityLink } from '@cultuvilla/shared/models/person';

function toPartialDate(d: Date | null): PartialDate | null {
  if (!d) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

async function pickImage(): Promise<{ uri: string; blob: Blob } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return { uri: asset.uri, blob };
}

export default function CompleteProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();

  // account section
  const [displayName, setDisplayName] = useState(profile?.displayName ?? user?.displayName ?? '');
  const [telephone, setTelephone] = useState(profile?.telephone ?? '');
  const [accountVillage, setAccountVillage] = useState<string | null>(profile?.activeMunicipalityId ?? null);

  // persona section
  const [photo, setPhoto] = useState<{ uri: string; blob: Blob } | null>(null);
  const [givenName, setGivenName] = useState('');
  const [firstSurname, setFirstSurname] = useState('');
  const [secondSurname, setSecondSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthPlace, setBirthPlace] = useState<string | null>(null);
  const [biography, setBiography] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!user) return;
    setError(null);
    const trimmedDisplay = displayName.trim();
    const trimmedGiven = givenName.trim();
    if (!trimmedDisplay || !trimmedGiven) {
      setError(t('onboarding.completeProfile.requiredFields'));
      return;
    }
    setLoading(true);
    try {
      // 1. persona
      const birthPlaceLink: MunicipalityLink | null = birthPlace
        ? { municipalityId: birthPlace, barrioId: null }
        : null;
      const existing = profile?.personId ? null : await getPersonByUserId(user.uid);
      let personId: string;
      if (profile?.personId) {
        personId = profile.personId;
      } else if (existing) {
        personId = existing.id;
      } else {
        personId = await createPerson({
          givenName: trimmedGiven,
          firstSurname: firstSurname.trim() || null,
          secondSurname: secondSurname.trim() || null,
          nickname: nickname.trim() || null,
          sex,
          birthday: toPartialDate(birthday),
          birthPlace: birthPlaceLink,
          biography: biography.trim() || null,
          userId: user.uid,
          createdBy: user.uid,
        });
      }

      // 2. avatar
      if (photo) {
        const url = await uploadPersonImage(personId, {
          blob: photo.blob,
          filename: `avatar-${Date.now()}.jpg`,
          contentType: photo.blob.type || 'image/jpeg',
        });
        await updatePerson(personId, { photoURL: url });
      }

      // 3. account
      if (profile) {
        await patchUserProfile(user.uid, {
          displayName: trimmedDisplay,
          telephone: telephone.trim() || null,
          activeMunicipalityId: accountVillage,
          personId,
        });
      } else {
        await createUserProfile(user.uid, {
          displayName: trimmedDisplay,
          email: user.email ?? '',
          telephone: telephone.trim() || null,
          activeMunicipalityId: accountVillage,
          personId,
        });
      }

      await refreshProfile();
      router.replace({ pathname: '/(tabs)' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onboarding.completeProfile.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text variant="h2">{t('onboarding.completeProfile.title')}</Text>
        <Text tone="muted">{t('onboarding.completeProfile.intro')}</Text>

        <Text variant="h3">{t('onboarding.completeProfile.accountSection')}</Text>
        <VStack gap={3}>
          <Input
            label={t('onboarding.completeProfile.displayName')}
            value={displayName}
            onChangeText={setDisplayName}
          />
          <Input
            label={t('onboarding.completeProfile.telephone')}
            value={telephone}
            onChangeText={setTelephone}
            keyboardType="phone-pad"
          />
          <VillagePicker
            label={t('onboarding.completeProfile.village')}
            value={accountVillage}
            onChange={setAccountVillage}
          />
        </VStack>

        <Text variant="h3">{t('onboarding.completeProfile.personaSection')}</Text>
        <VStack gap={3}>
          <Avatar
            uri={photo?.uri}
            size={96}
            onPress={async () => {
              const next = await pickImage();
              if (next) setPhoto(next);
            }}
          />
          <Input
            label={t('onboarding.completeProfile.givenName')}
            value={givenName}
            onChangeText={setGivenName}
          />
          <Input
            label={t('onboarding.completeProfile.firstSurname')}
            value={firstSurname}
            onChangeText={setFirstSurname}
          />
          <Input
            label={t('onboarding.completeProfile.secondSurname')}
            value={secondSurname}
            onChangeText={setSecondSurname}
          />
          <Input
            label={t('onboarding.completeProfile.nickname')}
            value={nickname}
            onChangeText={setNickname}
          />
          {/* sex: simple 3-button row */}
          <Text tone="muted">{t('onboarding.completeProfile.sex')}</Text>
          <VStack gap={2}>
            {(['female', 'male', 'other'] as const).map((opt) => (
              <Button
                key={opt}
                variant={sex === opt ? 'primary' : 'secondary'}
                onPress={() => setSex(sex === opt ? null : opt)}
              >
                <Text>{t(`onboarding.completeProfile.sex_${opt}`)}</Text>
              </Button>
            ))}
          </VStack>
          <DateField
            label={t('onboarding.completeProfile.birthday')}
            value={birthday}
            onChange={setBirthday}
            minimumDate={new Date(1900, 0, 1)}
            maximumDate={new Date()}
          />
          <VillagePicker
            label={t('onboarding.completeProfile.birthPlace')}
            value={birthPlace}
            onChange={setBirthPlace}
          />
          <Input
            label={t('onboarding.completeProfile.biography')}
            value={biography}
            onChangeText={setBiography}
            multiline
            numberOfLines={4}
          />
        </VStack>

        {error && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('onboarding.completeProfile.submit')}</Text>
        </Button>
      </ScrollView>
    </Screen>
  );
}
```

If `Input` doesn't accept `multiline` / `numberOfLines`, plumb them through (one prop addition each — they're plain `TextInput` passthroughs).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter cultuvilla-mobile test complete-profile`

Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/\(onboarding\)/complete-profile.tsx apps/mobile/app/\(onboarding\)/__tests__/complete-profile.test.tsx apps/mobile/components/primitives/Input.tsx
git commit -m "feat(mobile): two-section onboarding creates persona + account"
```

(Only stage `Input.tsx` if you plumbed `multiline`/`numberOfLines`.)

---

## Task 10: Polish `signup.tsx`

**Files:**
- Modify: `apps/mobile/app/(auth)/signup.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Screen, VStack, Text, Input, PasswordInput, Button } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function SignupScreen() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('auth.signup.title')}</Text>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          testID="signup-password"
        />
        <Text tone="muted">{t('auth.passwordHint')}</Text>
        {error != null && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('auth.signup.submit')}</Text>
        </Button>
        <Button onPress={onGoogle} loading={googleLoading} variant="secondary" fullWidth>
          <Text>{t('auth.signInWithGoogle')}</Text>
        </Button>
        <Link href="/login">
          <Text tone="muted">{t('auth.signup.toLogin')}</Text>
        </Link>
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/signup.tsx
git commit -m "feat(mobile): signup gets Google button, password reveal, hint"
```

---

## Task 11: Polish `login.tsx` — forgot-password + password reveal

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Replace contents**

```tsx
import { useState } from 'react';
import { Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getAuth } from '@cultuvilla/shared/firebase';
import { Screen, VStack, Text, Input, PasswordInput, Button, Pressable } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null); setInfo(null); setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null); setInfo(null); setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onForgot() {
    setError(null); setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('auth.forgotPasswordNeedsEmail'));
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), trimmed);
      setInfo(t('auth.forgotPasswordSent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    }
  }

  return (
    <Screen>
      <VStack gap={4}>
        <Text variant="h2">{t('auth.login.title')}</Text>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          testID="login-password"
        />
        <Pressable onPress={onForgot} accessibilityRole="button">
          <Text tone="muted">{t('auth.forgotPassword')}</Text>
        </Pressable>
        {error != null && <Text tone="danger">{error}</Text>}
        {info != null && <Text tone="muted">{info}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth>
          <Text tone="onAccent">{t('auth.login.submit')}</Text>
        </Button>
        <Button onPress={onGoogle} loading={googleLoading} variant="secondary" fullWidth>
          <Text>{t('auth.signInWithGoogle')}</Text>
        </Button>
        <Link href="/signup">
          <Text tone="muted">{t('auth.login.toSignup')}</Text>
        </Link>
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile exec tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/login.tsx
git commit -m "feat(mobile): login gets forgot-password + password reveal"
```

---

## Task 12: i18n strings

**Files:**
- Modify: `packages/i18n/messages/es.json`

- [ ] **Step 1: Patch `auth.*`**

Inside the `"auth"` object, add the following keys (alongside the existing ones — keep existing keys intact):

```json
"passwordHint": "Mínimo 6 caracteres.",
"forgotPassword": "¿Olvidaste tu contraseña?",
"forgotPasswordSent": "Te enviamos un correo para restablecerla.",
"forgotPasswordNeedsEmail": "Introduce tu correo arriba primero."
```

- [ ] **Step 2: Replace `onboarding.completeProfile` entirely**

```json
"onboarding": {
  "completeProfile": {
    "title": "Completa tu perfil",
    "intro": "Cuéntanos un poco sobre ti. Solo el nombre es obligatorio.",
    "accountSection": "Tu cuenta",
    "personaSection": "Tu persona",
    "displayName": "Nombre visible",
    "telephone": "Teléfono (opcional)",
    "village": "Tu pueblo (opcional)",
    "givenName": "Nombre",
    "firstSurname": "Primer apellido (opcional)",
    "secondSurname": "Segundo apellido (opcional)",
    "nickname": "Apodo (opcional)",
    "sex": "Sexo (opcional)",
    "sex_female": "Mujer",
    "sex_male": "Hombre",
    "sex_other": "Otro",
    "birthday": "Fecha de nacimiento (opcional)",
    "birthPlace": "Lugar de nacimiento (opcional)",
    "biography": "Sobre ti (opcional)",
    "submit": "Crear perfil",
    "requiredFields": "El nombre visible y tu nombre son obligatorios.",
    "error": "No se pudo guardar el perfil"
  }
}
```

- [ ] **Step 3: Verify JSON is valid**

Run: `pnpm --filter @cultuvilla/i18n exec tsc --noEmit`

Expected: clean (the JSON is imported with type assertion).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(es): add onboarding persona keys + auth polish keys"
```

---

## Task 13: Rules tests for `/persons/{personId}`

**Files:**
- Create: `packages/shared/test/e2e/personRules.test.ts`

- [ ] **Step 1: Write the test, mirroring `villageRules.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'cultuvilla-rules',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const personData = (overrides: Partial<{ createdBy: string; userId: string | null }> = {}) => ({
  givenName: 'Ana',
  middleNames: [],
  firstSurname: null,
  secondSurname: null,
  nickname: null,
  sex: null,
  birthday: null,
  deathDate: null,
  birthPlace: null,
  burialPlace: null,
  municipalityLinks: [],
  occupationIds: [],
  pendingOccupations: [],
  biography: null,
  photoURL: null,
  userId: overrides.userId ?? null,
  createdBy: overrides.createdBy ?? 'uid-1',
  createdAt: serverTimestamp(),
});

describe('persons rules', () => {
  it('owner can create their own persona', async () => {
    const ctx = env.authenticatedContext('uid-1');
    await assertSucceeds(setDoc(doc(ctx.firestore(), 'persons/p1'), personData({ createdBy: 'uid-1', userId: 'uid-1' })));
  });

  it('rejects create when createdBy != auth uid', async () => {
    const ctx = env.authenticatedContext('uid-1');
    await assertFails(setDoc(doc(ctx.firestore(), 'persons/p1'), personData({ createdBy: 'uid-2', userId: 'uid-2' })));
  });

  it('owner can update photoURL after create', async () => {
    // seed without rules
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'persons/p1'), personData({ createdBy: 'uid-1', userId: 'uid-1' }));
    });
    const ctx = env.authenticatedContext('uid-1');
    await assertSucceeds(updateDoc(doc(ctx.firestore(), 'persons/p1'), { photoURL: 'https://example.test/a.jpg' }));
  });

  it('rejects update by a different user', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'persons/p1'), personData({ createdBy: 'uid-1', userId: 'uid-1' }));
    });
    const stranger = env.authenticatedContext('uid-2');
    await assertFails(updateDoc(doc(stranger.firestore(), 'persons/p1'), { photoURL: 'https://x' }));
  });
});
```

- [ ] **Step 2: Run the rules tests**

Run: `pnpm --filter @cultuvilla/shared test personRules`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/test/e2e/personRules.test.ts
git commit -m "test(rules): cover persons create + update by owner"
```

---

## Task 14: Manual smoke test on a device

**Files:** none

- [ ] **Step 1: Run the app**

```bash
pnpm --filter cultuvilla-mobile run android   # or run ios
```

- [ ] **Step 2: Walk the happy paths**

1. **Fresh signup**: email + password → see two-section onboarding → fill required `displayName` + `givenName` only → submit → tabs.
2. **Existing account, no persona**: log in as your current account (which has `UserData` but no `personId`) → onboarding fires → submit creates the `Person` and patches `personId` → tabs.
3. **Login forgot-password**: empty email → see the "intro tu correo" hint. Real email → reset email arrives.
4. **Signup Google button**: triggers the existing Google flow, lands on onboarding for first-time accounts.
5. **Persona avatar**: tap the avatar circle → image picker → choose → image shows.
6. **DateField**: tap birthday → native dialog opens → pick a date → field shows DD/MM/YYYY.
7. **VillagePicker**: tap village → modal opens with the seeded municipalities → search filters → tapping selects.

If any step fails, fix in place (the smallest scoped commit possible) before the final commit.

- [ ] **Step 3: Final commit (if anything was patched)**

If everything worked first try, skip. Otherwise:

```bash
git add -A
git commit -m "fix(mobile): onboarding/auth smoke-test follow-ups"
```

---

## Self-Review Notes

- **Spec coverage:** Slimmed `UserData` (T1, T2). Gate widened (T3). New onboarding screen with avatar + DateField + VillagePicker (T5–T9). Login/Signup polish (T10, T11). i18n (T12). Rules tests (T13). Smoke test (T14). ✓
- **Persona-first write order:** Enforced in T9 (`createPerson` → upload avatar → `updatePerson(photoURL)` → `createUserProfile`/`patchUserProfile`). ✓
- **Existing-account migration:** T3 widens the gate; T9 detects `profile != null` and patches instead of recreating, and uses `getPersonByUserId` to recover orphaned personas. ✓
- **No GPS / map work:** All "location" is village id only. ✓
- **Open items from spec:** (1) `getMunicipalities` is the chosen API. (2) `patchUserProfile` is added in T2. (3) Person rules confirmed via T13 (no rule edit needed).
- **Type consistency:** `patchUserProfile` signature in T2 matches usage in T9. `PartialDate` shape in T9 matches `PersonDataModel`. `MunicipalityLink` shape in T9 matches `personService` reader.
