# Añadir difuntos a un cementerio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in user mark one of their own personas a cargo as buried in a cemetery, with an optional approximate death date, from the cemetery detail screen.

**Architecture:** No schema/rule/service changes — a burial is `updatePerson(personId, { burialPlace, deathDate })`, already permitted by the persons write rule for `createdBy == uid && userId == null`. New UI only: a `PartialDateField` primitive, a two-phase `BuriedSheet`, a `BuryFab` pill mounted on the cemetery screen. Death date is captured **only** in this flow, never in the general persona stepper.

**Tech Stack:** Expo SDK 54 / Expo Router v4 / React Native / NativeWind v4 / TypeScript; jest + @testing-library/react-native; `@cultuvilla/shared` services & models; `@cultuvilla/i18n` via `useT()`.

## Global Constraints

- **No `firebase/*` imports in components** — route through `@cultuvilla/shared/services/personService` (`updatePerson`, `getPersonsByCreator`). (AGENTS.md service-layer ownership.)
- **Strict TypeScript, no `any`.** `PartialDate` = `{ year: number | null; month: number | null; day: number | null }` (from `@cultuvilla/shared/models/person`).
- **Persona a cargo = `createdBy === uid && userId === null`.** The burial write only targets these; the existing Firestore rule enforces it server-side.
- **RN-Web modal pattern:** styles on `style`/`className`, pad `insets.bottom`, `Modal` with `transparent`/`animationType` per `AttendeeSheet`. (mobile-web-compat skill.)
- **i18n:** all user-facing strings via `useT()`, keys under `village.placeDetail.*` (where `buried`/`buriedEmpty` already live). Spanish messages in `packages/i18n/messages/es.json`.
- **Icons:** `Ionicons` with `iconSizes.sm|md|lg`, never ad-hoc numbers.
- **Month indexing:** month is **1-based** in `PartialDate` (`toPartialDate` uses `getMonth() + 1`); the segment picker's internal month state is 0-based like `BirthDateField`. Convert at the boundary.

---

### Task 1: `PartialDateField` primitive

A segmented year/month/day picker (reusing `BirthDateField`'s UI shape) that emits a **partial** `PartialDate`: year alone is enough, month/day optional, and it can be cleared to `null`.

**Files:**
- Create: `apps/mobile/components/primitives/PartialDateField.tsx`
- Test: `apps/mobile/components/primitives/__tests__/PartialDateField.test.tsx`
- Modify: `apps/mobile/components/primitives/index.ts` (export the new primitive)

**Interfaces:**
- Consumes: `PartialDate` from `@cultuvilla/shared/models/person`; `monthLongLabels` from `@cultuvilla/shared/utils/format`; primitives `Text`, `Pressable`, `Button`, `FieldLabel`.
- Produces:
  ```ts
  export interface PartialDateFieldProps {
    label: string;
    value: PartialDate | null;
    onChange: (value: PartialDate | null) => void;
    minYear?: number;   // default 1900
    maxYear?: number;   // default current year via a passed-in `now` OR new Date()
    testID?: string;
  }
  export function PartialDateField(props: PartialDateFieldProps): JSX.Element;
  ```
  Emission rule: `year == null` → `onChange(null)`; otherwise `onChange({ year, month, day })` with `month`/`day` possibly `null`. Month stored 0-based internally, emitted **1-based** (`month + 1`).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/primitives/__tests__/PartialDateField.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { PartialDateField } from '../PartialDateField';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({
    locale: 'es',
    t: (key: string) =>
      ({
        'partialDate.year': 'Año',
        'partialDate.month': 'Mes',
        'partialDate.day': 'Día',
        'partialDate.clear': 'Sin fecha',
        'common.cancel': 'Cancelar',
      })[key] ?? key,
  }),
}));

describe('PartialDateField', () => {
  it('renders separate year, month, and day selectors', () => {
    const { getByTestId } = render(
      <PartialDateField label="Fecha" value={null} onChange={() => {}} testID="d" />,
    );
    expect(getByTestId('d-year')).toBeTruthy();
    expect(getByTestId('d-month')).toBeTruthy();
    expect(getByTestId('d-day')).toBeTruthy();
  });

  it('emits a year-only partial date (month is enough to omit)', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PartialDateField label="Fecha" value={null} onChange={onChange} maxYear={2026} testID="d" />,
    );
    fireEvent.press(getByTestId('d-year'));
    fireEvent.press(getByTestId('d-year-option-1990'));
    expect(onChange).toHaveBeenLastCalledWith({ year: 1990, month: null, day: null });
  });

  it('emits a 1-based month when year and month are set', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PartialDateField label="Fecha" value={null} onChange={onChange} maxYear={2026} testID="d" />,
    );
    fireEvent.press(getByTestId('d-year'));
    fireEvent.press(getByTestId('d-year-option-1990'));
    fireEvent.press(getByTestId('d-month'));
    fireEvent.press(getByTestId('d-month-option-4')); // internal 0-based April
    expect(onChange).toHaveBeenLastCalledWith({ year: 1990, month: 5, day: null });
  });

  it('clears to null when "Sin fecha" is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PartialDateField
        label="Fecha"
        value={{ year: 1990, month: 5, day: null }}
        onChange={onChange}
        testID="d"
      />,
    );
    fireEvent.press(getByTestId('d-clear'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/primitives/__tests__/PartialDateField.test.tsx`
Expected: FAIL — `Cannot find module '../PartialDateField'`.

- [ ] **Step 3: Write minimal implementation**

Model on `BirthDateField` but keep segments independently optional and emit a partial. Full file:

```tsx
// apps/mobile/components/primitives/PartialDateField.tsx
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';
import { monthLongLabels } from '@cultuvilla/shared/utils/format';
import type { PartialDate } from '@cultuvilla/shared/models/person';
import { useT } from '../../lib/i18n';
import { Button } from './Button';
import { FieldLabel } from './FieldLabel';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Segment = 'year' | 'month' | 'day';

const MONTHS = monthLongLabels();
const CHEVRON_COLOR = colors.light.fg.muted;

export interface PartialDateFieldProps {
  label: string;
  value: PartialDate | null;
  onChange: (value: PartialDate | null) => void;
  minYear?: number;
  maxYear?: number;
  testID?: string;
}

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

export function PartialDateField({
  label,
  value,
  onChange,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  testID,
}: PartialDateFieldProps) {
  const { t } = useT();
  // month kept 0-based internally (like BirthDateField); emitted 1-based.
  const [year, setYear] = useState<number | null>(value?.year ?? null);
  const [month, setMonth] = useState<number | null>(value?.month != null ? value.month - 1 : null);
  const [day, setDay] = useState<number | null>(value?.day ?? null);
  const [open, setOpen] = useState<Segment | null>(null);

  useEffect(() => {
    setYear(value?.year ?? null);
    setMonth(value?.month != null ? value.month - 1 : null);
    setDay(value?.day ?? null);
  }, [value]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let option = maxYear; option >= minYear; option -= 1) years.push(option);
    return years;
  }, [maxYear, minYear]);
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index), []);
  const dayOptions = useMemo(() => {
    const count = year != null && month != null ? daysInMonth(year, month) : 31;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [year, month]);

  // Emit rule: no year → null. Otherwise a partial with 1-based month.
  function commit(nextYear: number | null, nextMonth: number | null, nextDay: number | null) {
    if (nextYear == null) {
      onChange(null);
      return;
    }
    const safeDay =
      nextMonth != null && nextDay != null ? Math.min(nextDay, daysInMonth(nextYear, nextMonth)) : nextDay;
    onChange({ year: nextYear, month: nextMonth != null ? nextMonth + 1 : null, day: safeDay });
  }

  function pickYear(next: number) {
    setYear(next);
    setOpen(null);
    commit(next, month, day);
  }
  function pickMonth(next: number) {
    setMonth(next);
    setOpen(null);
    commit(year, next, day);
  }
  function pickDay(next: number) {
    setDay(next);
    setOpen(null);
    commit(year, month, next);
  }
  function clear() {
    setYear(null);
    setMonth(null);
    setDay(null);
    setOpen(null);
    onChange(null);
  }

  return (
    <View testID={testID}>
      <View className="flex-row items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        {year != null ? (
          <Pressable onPress={clear} testID={testID ? `${testID}-clear` : undefined} accessibilityRole="button">
            <Text tone="muted" variant="bodySm">
              {t('partialDate.clear')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row gap-2 mt-1">
        <SegmentButton
          text={year != null ? String(year) : t('partialDate.year')}
          onPress={() => setOpen('year')}
          testID={testID ? `${testID}-year` : undefined}
        />
        <SegmentButton
          text={month != null ? (MONTHS[month] ?? t('partialDate.month')) : t('partialDate.month')}
          onPress={() => setOpen('month')}
          testID={testID ? `${testID}-month` : undefined}
        />
        <SegmentButton
          text={day != null ? String(day) : t('partialDate.day')}
          onPress={() => setOpen('day')}
          testID={testID ? `${testID}-day` : undefined}
        />
      </View>

      <Modal visible={open != null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <SafeAreaView edges={['top', 'bottom']} style={StyleSheet.absoluteFill} className="bg-surface p-4">
          <View className="px-6 pt-4 pb-5 border-b border-subtle">
            <Text variant="h2" className="text-accent">
              {open ? t(`partialDate.${open}`) : ''}
            </Text>
          </View>
          {open === 'year' ? (
            <OptionList options={yearOptions} label={String} onPick={pickYear} testID={testID ? `${testID}-year-option` : undefined} />
          ) : null}
          {open === 'month' ? (
            <OptionList options={monthOptions} label={(o) => MONTHS[o] ?? String(o + 1)} onPick={pickMonth} testID={testID ? `${testID}-month-option` : undefined} />
          ) : null}
          {open === 'day' ? (
            <OptionList options={dayOptions} label={String} onPick={pickDay} testID={testID ? `${testID}-day-option` : undefined} />
          ) : null}
          <View className="pt-3 flex-row justify-end">
            <Button variant="secondary" onPress={() => setOpen(null)}>
              {t('common.cancel')}
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function SegmentButton({ text, onPress, testID }: { text: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      className="flex-1 min-w-0 flex-row items-center justify-between border border-subtle rounded-md py-3 px-2 bg-surface"
    >
      <Text numberOfLines={1} ellipsizeMode="tail" className="shrink mr-1">
        {text}
      </Text>
      <Ionicons name="chevron-down" size={iconSizes.sm} color={CHEVRON_COLOR} />
    </Pressable>
  );
}

function OptionList({
  options,
  label,
  onPick,
  testID,
}: {
  options: number[];
  label: (option: number) => string;
  onPick: (option: number) => void;
  testID?: string;
}) {
  return (
    <FlatList
      className="flex-1"
      data={options}
      keyExtractor={String}
      initialNumToRender={40}
      renderItem={({ item }) => (
        <Pressable onPress={() => onPick(item)} className="px-6 py-4 border-b border-subtle" testID={testID ? `${testID}-${item}` : undefined}>
          <Text>{label(item)}</Text>
        </Pressable>
      )}
    />
  );
}
```

Then add the export to `apps/mobile/components/primitives/index.ts` (alphabetically near `BirthDateField`):

```ts
export { PartialDateField } from './PartialDateField';
export type { PartialDateFieldProps } from './PartialDateField';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/primitives/__tests__/PartialDateField.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/primitives/PartialDateField.tsx \
        apps/mobile/components/primitives/__tests__/PartialDateField.test.tsx \
        apps/mobile/components/primitives/index.ts
git commit -m "feat(mobile): add PartialDateField primitive for approximate dates"
```

---

### Task 2: i18n strings

Add the Spanish messages the sheet and FAB consume.

**Files:**
- Modify: `packages/i18n/messages/es.json`

**Interfaces:**
- Produces keys: `partialDate.{year,month,day,clear}`, `village.placeDetail.{addDifunto,condolence,deathDatePrompt,createPersona,alreadyBuried,addAction}`.

- [ ] **Step 1: Add the `partialDate` block**

Add a top-level `"partialDate"` object (place it alphabetically among existing top-level keys):

```json
"partialDate": {
  "year": "Año",
  "month": "Mes",
  "day": "Día",
  "clear": "Sin fecha"
},
```

- [ ] **Step 2: Extend `village.placeDetail`**

Locate the existing `village.placeDetail` object (it already has `buried` and `buriedEmpty`) and add:

```json
"addDifunto": "Añadir difunto",
"condolence": "Lamentamos tu pérdida",
"deathDatePrompt": "¿Sabes la fecha de su fallecimiento? Con el año basta.",
"createPersona": "Crear nueva persona",
"alreadyBuried": "Ya está aquí",
"addAction": "Añadir"
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(cemetery): strings for adding difuntos"
```

---

### Task 3: `BuriedSheet` component

Two-phase bottom modal: pick a persona a cargo (or create new), then capture an optional death date.

**Files:**
- Create: `apps/mobile/components/feature/BuriedSheet.tsx`
- Test: `apps/mobile/components/feature/__tests__/BuriedSheet.test.tsx`

**Interfaces:**
- Consumes: `PartialDateField` (Task 1); `PartialDate` from `@cultuvilla/shared/models/person`; primitives `Button`, `Text`, `VStack`, `HStack`.
- Produces:
  ```ts
  export interface BuriedPersonaOption {
    id: string;
    name: string;
    buriedHere: boolean;
  }
  export interface BuriedSheetProps {
    visible: boolean;
    personas: BuriedPersonaOption[];
    busy: boolean;
    /** Persona to auto-advance to the date phase (e.g. one just created). */
    autoSelectId?: string;
    onClose: () => void;
    onCreateNew: () => void;
    onConfirm: (personId: string, deathDate: PartialDate | null) => void;
  }
  export function BuriedSheet(props: BuriedSheetProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feature/__tests__/BuriedSheet.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { BuriedSheet } from '../BuriedSheet';

jest.mock('../../../lib/i18n', () => ({
  useT: () => ({ locale: 'es', t: (k: string) => k }),
}));

const personas = [
  { id: 'p1', name: 'Abuelo Juan', buriedHere: false },
  { id: 'p2', name: 'Tía María', buriedHere: true },
];

describe('BuriedSheet', () => {
  it('lists personas and advances to the date phase on pick, then confirms with no date', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <BuriedSheet
        visible
        personas={personas}
        busy={false}
        onClose={() => {}}
        onCreateNew={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByTestId('buried-persona-p1'));
    fireEvent.press(getByTestId('buried-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('p1', null);
  });

  it('does not confirm a persona already buried here (row disabled)', () => {
    const onConfirm = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <BuriedSheet
        visible
        personas={personas}
        busy={false}
        onClose={() => {}}
        onCreateNew={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByTestId('buried-persona-p2'));
    // Still on pick phase — no date confirm button rendered.
    expect(queryByTestId('buried-confirm')).toBeNull();
  });

  it('fires onCreateNew from the dashed row', () => {
    const onCreateNew = jest.fn();
    const { getByTestId } = render(
      <BuriedSheet
        visible
        personas={personas}
        busy={false}
        onClose={() => {}}
        onCreateNew={onCreateNew}
        onConfirm={() => {}}
      />,
    );
    fireEvent.press(getByTestId('buried-create'));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('auto-advances to the date phase for autoSelectId', () => {
    const { getByTestId } = render(
      <BuriedSheet
        visible
        personas={[{ id: 'p3', name: 'Nuevo', buriedHere: false }]}
        busy={false}
        autoSelectId="p3"
        onClose={() => {}}
        onCreateNew={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(getByTestId('buried-confirm')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/BuriedSheet.test.tsx`
Expected: FAIL — cannot find `../BuriedSheet`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/mobile/components/feature/BuriedSheet.tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable as RNPressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PartialDate } from '@cultuvilla/shared/models/person';
import { Button } from '../primitives/Button';
import { Text } from '../primitives/Text';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { PartialDateField } from '../primitives/PartialDateField';
import { useT } from '../../lib/i18n';

export interface BuriedPersonaOption {
  id: string;
  name: string;
  buriedHere: boolean;
}

export interface BuriedSheetProps {
  visible: boolean;
  personas: BuriedPersonaOption[];
  busy: boolean;
  autoSelectId?: string;
  onClose: () => void;
  onCreateNew: () => void;
  onConfirm: (personId: string, deathDate: PartialDate | null) => void;
}

/**
 * Two-phase difunto picker for a cemetery. Phase 1 lists the caller's personas a
 * cargo (marking any already buried here) plus a create-new row. Phase 2 shows a
 * condolence line and an optional approximate death date, then confirms.
 *
 * Follows AttendeeSheet's RN-Web-safe Modal pattern (styles on style/className,
 * insets.bottom padding).
 */
export function BuriedSheet({
  visible,
  personas,
  busy,
  autoSelectId,
  onClose,
  onCreateNew,
  onConfirm,
}: BuriedSheetProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [deathDate, setDeathDate] = useState<PartialDate | null>(null);

  // Reset on each open; auto-advance to the date phase when a persona was just
  // created (autoSelectId) and is present in the list.
  useEffect(() => {
    if (!visible) return;
    const auto = autoSelectId && personas.some((p) => p.id === autoSelectId) ? autoSelectId : null;
    setSelected(auto);
    setDeathDate(null);
    // personas identity intentionally excluded — re-seed only on open / autoSelect change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoSelectId]);

  const inDatePhase = selected != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <RNPressable
        onPress={() => {
          if (!busy) onClose();
        }}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        className="justify-end"
      >
        <RNPressable
          onPress={() => {}}
          className="rounded-t-2xl bg-surface-elevated p-5 border-t border-subtle"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          {inDatePhase ? (
            <VStack gap={3}>
              <Text variant="h3">{t('village.placeDetail.condolence')}</Text>
              <Text tone="muted" variant="bodySm">
                {t('village.placeDetail.deathDatePrompt')}
              </Text>
              <PartialDateField
                label={t('village.placeDetail.deathDatePrompt')}
                value={deathDate}
                onChange={setDeathDate}
                testID="buried-death-date"
              />
              <Button
                onPress={() => selected && onConfirm(selected, deathDate)}
                loading={busy}
                fullWidth
                testID="buried-confirm"
              >
                {t('village.placeDetail.addAction')}
              </Button>
            </VStack>
          ) : (
            <VStack gap={3}>
              <Text variant="h3">{t('village.placeDetail.addDifunto')}</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                <VStack gap={2}>
                  {personas.map((p) => (
                    <RNPressable
                      key={p.id}
                      testID={`buried-persona-${p.id}`}
                      onPress={() => {
                        if (!p.buriedHere) setSelected(p.id);
                      }}
                      disabled={p.buriedHere}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: p.buriedHere }}
                      className={`flex-row items-center justify-between rounded-lg border p-3 ${
                        p.buriedHere ? 'border-subtle opacity-60' : 'border-subtle'
                      }`}
                    >
                      <Text className="flex-1">{p.name}</Text>
                      {p.buriedHere ? (
                        <Text tone="muted" variant="caption">
                          {t('village.placeDetail.alreadyBuried')}
                        </Text>
                      ) : null}
                    </RNPressable>
                  ))}
                  <RNPressable
                    onPress={onCreateNew}
                    testID="buried-create"
                    accessibilityRole="button"
                    className="flex-row items-center rounded-lg border border-dashed border-subtle p-3"
                  >
                    <HStack gap={3} className="items-center flex-1">
                      <Text tone="muted" style={{ fontSize: 18 }}>
                        ＋
                      </Text>
                      <Text tone="muted" className="flex-1">
                        {t('village.placeDetail.createPersona')}
                      </Text>
                    </HStack>
                  </RNPressable>
                </VStack>
              </ScrollView>
            </VStack>
          )}
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/BuriedSheet.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/BuriedSheet.tsx \
        apps/mobile/components/feature/__tests__/BuriedSheet.test.tsx
git commit -m "feat(mobile): BuriedSheet two-phase difunto picker"
```

---

### Task 4: `BuryFab` component

The pill on the cemetery screen. Loads the caller's personas a cargo, owns the `BuriedSheet`, writes the burial via `updatePerson`, and notifies the parent to reload.

**Files:**
- Create: `apps/mobile/components/feature/BuryFab.tsx`
- Test: `apps/mobile/components/feature/__tests__/BuryFab.test.tsx`

**Interfaces:**
- Consumes: `BuriedSheet`, `BuriedPersonaOption` (Task 3); `getPersonsByCreator`, `updatePerson` from `@cultuvilla/shared/services/personService`; `buildShortName`, `PersonData` from `@cultuvilla/shared/models/person`; `useFocusEffect`, `router` from `expo-router`.
- Produces:
  ```ts
  export interface BuryFabProps {
    municipalityId: string;
    placeId: string;
    userId: string;
    /** Ids already buried here (from the parent's buried list) to mark rows. */
    buriedHereIds: string[];
    /** Called after a successful burial write so the parent reloads. */
    onChanged: () => void;
  }
  export function BuryFab(props: BuryFabProps): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/feature/__tests__/BuryFab.test.tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BuryFab } from '../BuryFab';
import * as personService from '@cultuvilla/shared/services/personService';

jest.mock('../../../lib/i18n', () => ({ useT: () => ({ locale: 'es', t: (k: string) => k }) }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => cb(),
}));
jest.mock('@cultuvilla/shared/services/personService', () => ({
  getPersonsByCreator: jest.fn(),
  updatePerson: jest.fn().mockResolvedValue(undefined),
}));

const asMock = <T,>(fn: T) => fn as unknown as jest.Mock;

const personas = [
  { id: 'own', userId: 'u1', givenName: 'Yo', firstSurname: 'Mismo', nickname: null },
  { id: 'dep', userId: null, givenName: 'Abuelo', firstSurname: 'Juan', nickname: null },
];

describe('BuryFab', () => {
  beforeEach(() => {
    asMock(personService.getPersonsByCreator).mockResolvedValue(personas);
    asMock(personService.updatePerson).mockClear();
  });

  it('shows only personas a cargo (userId === null) and writes a burial on confirm', async () => {
    const onChanged = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <BuryFab municipalityId="m1" placeId="c1" userId="u1" buriedHereIds={[]} onChanged={onChanged} />,
    );
    fireEvent.press(getByTestId('bury-fab'));
    await waitFor(() => expect(getByTestId('buried-persona-dep')).toBeTruthy());
    // Own persona is filtered out.
    expect(queryByTestId('buried-persona-own')).toBeNull();

    fireEvent.press(getByTestId('buried-persona-dep'));
    fireEvent.press(getByTestId('buried-confirm'));

    await waitFor(() =>
      expect(personService.updatePerson).toHaveBeenCalledWith('dep', {
        burialPlace: { municipalityId: 'm1', placeId: 'c1' },
        deathDate: null,
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/BuryFab.test.tsx`
Expected: FAIL — cannot find `../BuryFab`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/mobile/components/feature/BuryFab.tsx
import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable as RNPressable, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { PartialDate } from '@cultuvilla/shared/models/person';
import { buildShortName, type PersonData } from '@cultuvilla/shared/models/person';
import { getPersonsByCreator, updatePerson } from '@cultuvilla/shared/services/personService';
import { BuriedSheet, type BuriedPersonaOption } from './BuriedSheet';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { showAlert } from '../../lib/dialogs';

export interface BuryFabProps {
  municipalityId: string;
  placeId: string;
  userId: string;
  buriedHereIds: string[];
  onChanged: () => void;
}

type PersonDoc = PersonData & { id: string };

export function BuryFab({ municipalityId, placeId, userId, buriedHereIds, onChanged }: BuryFabProps) {
  const { t } = useT();
  const [dependents, setDependents] = useState<PersonDoc[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoSelectId, setAutoSelectId] = useState<string | undefined>(undefined);
  const knownIds = useRef<Set<string>>(new Set());

  // Load personas a cargo on focus (so one created via /person/new shows on return).
  const load = useCallback(async () => {
    const result = await withFirestoreErrorLog('cemetery:getPersonsByCreator', () =>
      getPersonsByCreator(userId),
    );
    // Personas a cargo are exactly the non-account persons this user created.
    const deps = result.filter((d) => d.userId == null);
    const known = knownIds.current;
    const fresh = deps.filter((d) => !known.has(d.id)).map((d) => d.id);
    if (known.size > 0 && fresh.length === 1) setAutoSelectId(fresh[0]);
    knownIds.current = new Set(deps.map((d) => d.id));
    setDependents(deps);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const buriedSet = new Set(buriedHereIds);
  const personas: BuriedPersonaOption[] = dependents.map((d) => ({
    id: d.id,
    name: buildShortName(d),
    buriedHere: buriedSet.has(d.id),
  }));

  async function handleConfirm(personId: string, deathDate: PartialDate | null) {
    setBusy(true);
    try {
      await updatePerson(personId, {
        burialPlace: { municipalityId, placeId },
        deathDate,
      });
      setAutoSelectId(undefined);
      setSheetOpen(false);
      onChanged();
    } catch (e) {
      showAlert(e instanceof Error ? e.message : 'error', t('village.placeDetail.addDifunto'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 24, flexDirection: 'row', justifyContent: 'center', zIndex: 20 }}
      >
        <RNPressable
          onPress={() => {
            if (!busy) setSheetOpen(true);
          }}
          disabled={busy}
          testID="bury-fab"
          accessibilityRole="button"
          accessibilityLabel={t('village.placeDetail.addDifunto')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 22,
            borderRadius: 999,
            backgroundColor: '#bb5d3a',
            opacity: busy ? 0.7 : 1,
            elevation: 6,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }}
        >
          <Text style={{ color: '#f9f0e8', fontSize: 18, lineHeight: 22, marginRight: 8 }}>＋</Text>
          <Text style={{ color: '#f9f0e8', fontSize: 16, fontWeight: '700' }}>{t('village.placeDetail.addDifunto')}</Text>
        </RNPressable>
      </Animated.View>

      <BuriedSheet
        visible={sheetOpen}
        personas={personas}
        busy={busy}
        autoSelectId={autoSelectId}
        onClose={() => setSheetOpen(false)}
        onCreateNew={() => router.push('/person/new')}
        onConfirm={handleConfirm}
      />
    </>
  );
}
```

Note: confirm the exact export names of `withFirestoreErrorLog` (`apps/mobile/lib/firestoreErrorLog.ts`) and `showAlert` (`apps/mobile/lib/dialogs.ts`) match — both are used by `RegisterFab` so they exist; if a signature differs, mirror `RegisterFab`'s usage exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/BuryFab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/BuryFab.tsx \
        apps/mobile/components/feature/__tests__/BuryFab.test.tsx
git commit -m "feat(mobile): BuryFab writes burials for personas a cargo"
```

---

### Task 5: Mount the FAB on the cemetery screen

Render `BuryFab` on the place detail screen for cemeteries when logged in, wired to the existing `load` reload.

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/place/[placeId].tsx`

**Interfaces:**
- Consumes: `BuryFab` (Task 4); `uid` from `useEntityCapabilities(villageId)` (already returns `{ canManage, uid, loading }`).

- [ ] **Step 1: Add imports**

At the top of the file, add:

```tsx
import { BuryFab } from '../../../../components/feature/BuryFab';
```

- [ ] **Step 2: Read `uid` from capabilities**

Change line 33 from:

```tsx
  const { canManage } = useEntityCapabilities(villageId);
```

to:

```tsx
  const { canManage, uid } = useEntityCapabilities(villageId);
```

- [ ] **Step 3: Render the FAB after the scaffold content**

Wrap the return so the FAB overlays the scaffold. Replace the single `<EntityDetailScaffold …>…</EntityDetailScaffold>` return with a fragment that appends the FAB:

```tsx
  return (
    <>
      <EntityDetailScaffold
        loading={loading}
        notFound={!loading && !place}
        imageUri={place?.images[0] ?? null}
        fallbackIcon={ENTITY_FALLBACK_ICON.place}
        actions={actions}
        title={place?.name}
        onRefresh={load}
      >
        {/* …existing children unchanged… */}
      </EntityDetailScaffold>
      {place?.kind === 'cemetery' && uid && villageId ? (
        <BuryFab
          municipalityId={villageId}
          placeId={place.id}
          userId={uid}
          buriedHereIds={buried.map((p) => p.id)}
          onChanged={load}
        />
      ) : null}
    </>
  );
```

(Leave the existing scaffold children exactly as they are — only the outer wrapper and the trailing `BuryFab` are new.)

- [ ] **Step 4: Typecheck**

Run: `pnpm app:typecheck`
Expected: no errors. (If `useEntityCapabilities` does not expose `uid`, confirm at `apps/mobile/lib/auth/useEntityCapabilities.ts` — it returns `uid` per its definition.)

- [ ] **Step 5: Run the mobile test suite for touched areas**

Run: `pnpm --filter cultuvilla-mobile exec jest components/feature/__tests__/BuriedSheet.test.tsx components/feature/__tests__/BuryFab.test.tsx components/primitives/__tests__/PartialDateField.test.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/place/\[placeId\].tsx
git commit -m "feat(mobile): add difunto FAB to cemetery detail screen"
```

---

### Task 6: Changelog + plan lifecycle

**Files:**
- Modify: `CHANGELOG.md`
- Move: `docs/plans/ideas/cementerio-difuntos.md` → delete after distilling (optional; leave for now)

- [ ] **Step 1: Add a CHANGELOG entry under `## [Unreleased]`**

```markdown
### Added
- Cemetery detail screen: an "Añadir difunto" button lets any resident record one of
  their personas a cargo as buried there, with an optional approximate death date.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(cemetery): changelog for adding difuntos"
```

---

## Verification (manual, after all tasks)

Drive the dev-client AVD (`drive-android-avd` skill): open a cemetery place → tap "Añadir difunto" → "Crear nueva persona" → complete the stepper → return → the new persona is listed → pick it → set year-only date → "Añadir" → confirm it appears in the buried section. Repeat picking an existing persona a cargo and adding with no date.

## Notes for the executor

- **Confirm `useEntityCapabilities` exposes `uid`** (it does per its current definition — `{ canManage, canApprove, uid, loading }`). If not, source `uid` from `useAuth().user?.uid`.
- **Do not add death date to `PersonForm`/the persona stepper** — it lives only in `BuriedSheet`.
- **No Firestore rule or index change** — the burial write is `updatePerson` on a persona a cargo, already permitted; `getPersonsByBurialPlace` uses a single equality filter (no composite index).
- **Web-safe:** `BuriedSheet`/`BuryFab` keep styles on `style`/`className` per `AttendeeSheet`/`RegisterFab`; verify no `Animated.View` `className` (mobile-web-compat).
