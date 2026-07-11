# Clock-face time picker + date/time picker polish

## Problem

The date/time picker shipped in PR #106 (`CalendarDatePicker` grid + a two-column
list `TimePicker`, composed by `DateTimeField`). A follow-up round of requests from
the same session was never implemented (the session ended before any code landed):

1. The **time picker should be a clock face** ("the hour is set with the clock
   appearing"), Órdago-style — not two scrolling columns.
2. The picker should open in a **compact modal**, not a full-screen one.
3. The event **start field ("Inicio del evento") should default to the current
   time**, not an empty placeholder.
4. The two picker buttons should read **"Seleccionar fecha"** and **"Seleccionar
   hora"** separately, instead of both showing "Seleccionar fecha y hora".

This spec covers all four.

## Decisions (locked during brainstorming)

- **Interaction:** tap numbers on the clock face. **No drag/gesture** — keeps the
  component pure-JS and safe on the web-first Firebase Hosting build (see
  `mobile-web-compat`; `PanResponder`/gesture handling is the kind of thing that
  bites the web export, so we avoid it).
- **24h representation:** Material 24-hour style — two concentric rings, outer
  **1–12**, inner **13–23 + 00**. No AM/PM toggle (un-Spanish; Spain uses 24h).
- **Minutes:** a **minute ring** on the same face (12 ticks at `minuteStep`,
  default 5 → `00,05,…,55`). Hour tap auto-advances to the minute ring.
- **Modal:** compact centered dialog card, not full-screen.
- **Start default:** current time **rounded up to the next 5-minute step**, seconds
  zeroed.

## Architecture

Three layers, matching the existing calendar picker's split (pure math →
primitive → feature composer):

### `lib/date/clockGrid.ts` (new, pure)

Pure geometry + ring math, no React. Unit-tested in isolation, mirroring
`lib/date/calendarGrid.ts`.

- `clockPositions(count, radius, center)` → array of `{ value, x, y }` placing
  `count` items evenly around a circle. Angle for index `i` of `count`:
  `θ = (i / count) * 2π`; `x = cx + r·sin(θ)`, `y = cy − r·cos(θ)` (12 at top,
  clockwise).
- `hourRings()` → the outer ring (`1..12`) and inner ring (`13..23, 0`) value
  lists, so the component just maps values → positions at two radii.
- `minuteTicks(step)` → `[0, step, 2·step, …]`; throws/guards if `60 % step !== 0`.
- Helpers to read/set hour and minute on a `Date` immutably (seconds zeroed).

### `components/primitives/ClockTimePicker.tsx` (new)

Thin consumer of `clockGrid`. Props mirror the old `TimePicker`:

```ts
interface ClockTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minuteStep?: number; // default 5, must divide 60
  testID?: string;
}
```

Behavior:

- Internal `page: 'hour' | 'minute'` state; starts on `'hour'`.
- **Hour page:** two rings of absolutely-positioned `Pressable` number tiles
  (outer 1–12, inner 13–23+00). Tapping sets the hour on `value` via `onChange`
  and flips `page` to `'minute'`.
- **Minute page:** one ring of `minuteTicks(step)` tiles. Tapping sets the minute
  and is the terminal action (the composer closes the modal on minute pick).
- Center **digital readout `HH:MM`**; the active field (hour/minute) is
  highlighted, and tapping the hour or minute part jumps `page` back to it.
- Selected number tile uses the accent pill styling already used by
  `CalendarDatePicker`'s selected day (`bg-accent`), for visual consistency.
- `testID`-derived ids per tile (`${testID}-hour-13`, `${testID}-minute-30`) so
  tests and e2e can drive it — same convention the old `TimePicker` used.

Absolutely-positioned tap targets in a circle render fine on RN web (no
`Animated`, no gesture); verify on the web build before merge.

### `components/primitives/DateTimeField.tsx` (edit)

- Swap `TimePicker` → `ClockTimePicker`.
- **Compact modal:** replace the full-screen `Modal` + `SafeAreaView` with
  `Modal transparent animationType="fade"`: a dimmed, tappable backdrop
  (press = cancel) centering a rounded `Card` sized to content. Safe-area insets
  still honored so the card never clips on notched devices.
- **Separate placeholders:** add optional `datePlaceholder` / `timePlaceholder`
  props (each falling back to the existing `placeholder`, then to `'Fecha'` /
  `'Hora'`). The date button shows `datePlaceholder`, the time button
  `timePlaceholder`.
- Time-modal close timing changes: the old picker closed on any change; the clock
  is a two-page flow, so the modal closes when a **minute** is picked (hour tap
  only advances the page). Date modal still closes on day pick.

### `app/event/new.tsx` (edit)

- Initialize `startDate` to **now rounded up to the next 5-min step, seconds
  zeroed**, so "Inicio del evento" shows a real value on mount. `endDate` stays
  `null` (optional field).
- Pass `datePlaceholder={t('event.selectDate')}` and
  `timePlaceholder={t('event.selectTime')}` to both `DateTimeField`s.

### `packages/i18n/messages/es.json` (edit)

Add under `event`:

- `"selectDate": "Seleccionar fecha"`
- `"selectTime": "Seleccionar hora"`

Keep the existing `"selectDateTime"` (still used as the shared fallback and by any
other consumer).

### Deletion

Delete `components/primitives/TimePicker.tsx` and its test. It is consumed only by
`DateTimeField`; `ClockTimePicker` replaces it. Per AGENTS.md "Delete > deprecate",
no shim/re-export is left. Update the primitives `index` export accordingly.

## Testing

- **`lib/date/__tests__/clockGrid.test.ts`** — `clockPositions` places 12 at top /
  3 at right (angle math); outer vs inner hour ring value lists; `minuteTicks(5)`
  = 12 entries; `minuteTicks` guard rejects a step that doesn't divide 60;
  set-hour/set-minute zero seconds and preserve the other field.
- **`components/primitives/__tests__/ClockTimePicker.test.tsx`** — tapping an
  outer number sets that hour and advances to the minute page; tapping an inner
  number sets 13–23/00; tapping a minute preserves the chosen hour; tapping the
  hour readout returns to the hour page.
- **`DateTimeField.test.tsx`** — date button shows `datePlaceholder`, time button
  shows `timePlaceholder`; picking a day preserves the time; picking a minute
  preserves the date and closes the modal; backdrop press cancels.
- **`app/event/__tests__/new.test.tsx`** — `startDate` is pre-seeded (field renders
  a formatted date/time, not the placeholder) and rounded to a 5-min boundary.

## Out of scope

- Drag-to-set clock hands (explicitly rejected — tap only).
- Changing any other `DateTimeField` / `DateField` consumer (`PersonForm`,
  censo, festival posters) beyond the shared placeholder-prop addition.
- AM/PM localization.

## Workflow

Worktree `worktree-clock-time-picker` off latest `origin/develop`. `pnpm check`
before pushing; PR targets `develop`; CHANGELOG `[Unreleased]` note.

---

# Clock-face time picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-column list time picker with a tap-only 24h clock face, move the pickers into a compact modal, give the date/time buttons distinct labels, and pre-seed the event start time.

**Architecture:** Pure clock geometry in `lib/date/clockGrid.ts` → a thin `ClockTimePicker` primitive → `DateTimeField` composes calendar + clock inside a centered dialog. Mirrors the existing `calendarGrid.ts` → `CalendarDatePicker` → `DateTimeField` split from PR #106.

**Tech Stack:** Expo SDK 54 / React Native, NativeWind v4, TypeScript strict, Jest + `@testing-library/react-native`, `@cultuvilla/i18n`.

## Global Constraints

- TypeScript `strict`, no `any`, no `@ts-nocheck`.
- Mobile is web-first (Firebase Hosting). No `Animated`, no `PanResponder`/gesture — tap-only, absolutely-positioned `Pressable`s (see `mobile-web-compat`).
- Compose primitives (`Pressable`, `Text`, `Card`, `Button`) — no raw `<View>` where a primitive fits.
- `Text` tones are `'primary' | 'muted' | 'onAccent' | 'danger' | 'success'` — there is **no** `accent` tone; signal active state with `primary` vs `muted`.
- User-facing strings go through `useT()` / `packages/i18n/messages/es.json`.
- Tests colocated as `*.test.ts(x)`. Run mobile tests with `pnpm app:test`.

---

### Task 1: `clockGrid.ts` pure clock math

**Files:**
- Create: `apps/mobile/lib/date/clockGrid.ts`
- Test: `apps/mobile/lib/date/__tests__/clockGrid.test.ts`

**Interfaces:**
- Produces:
  - `interface ClockPosition { value: number; x: number; y: number }`
  - `clockPositions(values: number[], radius: number): ClockPosition[]` — 12-o'clock at top, clockwise; `x`/`y` are center-relative offsets.
  - `hourRings(): { outer: number[]; inner: number[] }` — outer `[12,1..11]`, inner `[0,13..23]` (24h value == displayed number; index 0 sits at top).
  - `minuteTicks(step: number): number[]` — throws unless `step > 0 && 60 % step === 0`.
  - `setClockHour(base: Date, hour: number): Date` / `setClockMinute(base: Date, minute: number): Date` — immutable, seconds zeroed.
  - `roundUpToMinuteStep(base: Date, step: number): Date` — immutable, seconds zeroed, minutes rounded UP to the next multiple of `step`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/lib/date/__tests__/clockGrid.test.ts
import {
  clockPositions,
  hourRings,
  minuteTicks,
  setClockHour,
  setClockMinute,
  roundUpToMinuteStep,
} from '../clockGrid';

describe('clockPositions', () => {
  it('places index 0 at top and index n/4 at the right (clockwise)', () => {
    const p = clockPositions([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 100);
    expect(p[0]!.value).toBe(12);
    expect(Math.round(p[0]!.x)).toBe(0);
    expect(Math.round(p[0]!.y)).toBe(-100); // top
    expect(Math.round(p[3]!.x)).toBe(100); // 3 o'clock, right
    expect(Math.round(p[3]!.y)).toBe(0);
  });
});

describe('hourRings', () => {
  it('outer is 12 then 1..11; inner is 0 then 13..23', () => {
    const { outer, inner } = hourRings();
    expect(outer).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(inner).toEqual([0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });
});

describe('minuteTicks', () => {
  it('returns 60/step entries', () => {
    expect(minuteTicks(5)).toHaveLength(12);
    expect(minuteTicks(5).at(-1)).toBe(55);
  });
  it('rejects a step that does not divide 60', () => {
    expect(() => minuteTicks(7)).toThrow();
  });
});

describe('setClockHour / setClockMinute', () => {
  it('sets one field, zeroes seconds, preserves the rest', () => {
    const base = new Date(2026, 6, 1, 9, 30, 45);
    const h = setClockHour(base, 20);
    expect(h.getHours()).toBe(20);
    expect(h.getMinutes()).toBe(30);
    expect(h.getSeconds()).toBe(0);
    const m = setClockMinute(base, 5);
    expect(m.getMinutes()).toBe(5);
    expect(m.getHours()).toBe(9);
    expect(m.getSeconds()).toBe(0);
  });
});

describe('roundUpToMinuteStep', () => {
  it('rounds minutes up to the next step, seconds zeroed', () => {
    expect(roundUpToMinuteStep(new Date(2026, 6, 1, 9, 31, 10), 5).getMinutes()).toBe(35);
    expect(roundUpToMinuteStep(new Date(2026, 6, 1, 9, 30, 0), 5).getMinutes()).toBe(30); // already aligned
    const wrap = roundUpToMinuteStep(new Date(2026, 6, 1, 9, 58, 0), 5);
    expect(wrap.getHours()).toBe(10);
    expect(wrap.getMinutes()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm app:test -- clockGrid`
Expected: FAIL — `Cannot find module '../clockGrid'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/lib/date/clockGrid.ts

export interface ClockPosition {
  value: number;
  x: number;
  y: number;
}

/** Place values evenly around a circle: index 0 at 12-o'clock, going clockwise. */
export function clockPositions(values: number[], radius: number): ClockPosition[] {
  const n = values.length;
  return values.map((value, i) => {
    const theta = (i / n) * 2 * Math.PI;
    return { value, x: radius * Math.sin(theta), y: -radius * Math.cos(theta) };
  });
}

/** Material 24h layout. Displayed number equals the 24h value; index 0 sits at top. */
export function hourRings(): { outer: number[]; inner: number[] } {
  return {
    outer: [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    inner: [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  };
}

export function minuteTicks(step: number): number[] {
  if (step <= 0 || 60 % step !== 0) {
    throw new Error(`minuteStep must divide 60 evenly, got ${step}`);
  }
  return Array.from({ length: 60 / step }, (_, i) => i * step);
}

export function setClockHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour);
  d.setSeconds(0, 0);
  return d;
}

export function setClockMinute(base: Date, minute: number): Date {
  const d = new Date(base);
  d.setMinutes(minute);
  d.setSeconds(0, 0);
  return d;
}

export function roundUpToMinuteStep(base: Date, step: number): Date {
  const d = new Date(base);
  d.setSeconds(0, 0);
  const rem = d.getMinutes() % step;
  if (rem !== 0) d.setMinutes(d.getMinutes() + (step - rem));
  return d;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm app:test -- clockGrid`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/date/clockGrid.ts apps/mobile/lib/date/__tests__/clockGrid.test.ts
git commit -m "feat(mobile): add pure clock-face geometry for time picker"
```

---

### Task 2: `ClockTimePicker` primitive

**Files:**
- Create: `apps/mobile/components/primitives/ClockTimePicker.tsx`
- Test: `apps/mobile/components/primitives/__tests__/ClockTimePicker.test.tsx`

**Interfaces:**
- Consumes: `clockPositions`, `hourRings`, `minuteTicks`, `setClockHour`, `setClockMinute` from Task 1.
- Produces:
  - `interface ClockTimePickerProps { value: Date; onChange: (date: Date) => void; onCommit?: () => void; minuteStep?: number; testID?: string }`
  - `function ClockTimePicker(props): JSX.Element`
  - Per-tile testIDs: `${testID}-hour-<h>` (h is the 24h value, e.g. `-hour-20`, `-hour-0`), `${testID}-minute-<m>`, plus `${testID}-show-hour` / `${testID}-show-minute` for the readout.
  - Behavior: starts on the hour page; tapping an hour tile calls `onChange(setClockHour(value, h))` **and** flips to the minute page (does NOT commit); tapping a minute tile calls `onChange(setClockMinute(value, m))` **then** `onCommit?.()` (terminal — the parent closes the modal on commit). This split is what lets an hour tap keep the modal open while a minute tap closes it.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/components/primitives/__tests__/ClockTimePicker.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ClockTimePicker } from '../ClockTimePicker';

describe('ClockTimePicker', () => {
  it('sets an outer-ring hour and advances to the minute page', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <ClockTimePicker value={new Date(2026, 6, 1, 9, 30)} onChange={onChange} testID="c" />,
    );
    fireEvent.press(getByTestId('c-hour-11'));
    const d = onChange.mock.calls.at(-1)![0] as Date;
    expect(d.getHours()).toBe(11);
    expect(d.getMinutes()).toBe(30); // preserved
    // now on the minute page: an hour tile is gone, a minute tile is present
    expect(queryByTestId('c-hour-11')).toBeNull();
    expect(getByTestId('c-minute-30')).toBeTruthy();
  });

  it('sets an inner-ring (24h) hour', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ClockTimePicker value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} testID="c" />,
    );
    fireEvent.press(getByTestId('c-hour-20'));
    expect((onChange.mock.calls.at(-1)![0] as Date).getHours()).toBe(20);
  });

  it('picks a minute preserving the hour', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ClockTimePicker value={new Date(2026, 6, 1, 20, 0)} onChange={onChange} testID="c" />,
    );
    fireEvent.press(getByTestId('c-show-minute')); // jump straight to the minute page
    fireEvent.press(getByTestId('c-minute-45'));
    const d = onChange.mock.calls.at(-1)![0] as Date;
    expect(d.getMinutes()).toBe(45);
    expect(d.getHours()).toBe(20);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm app:test -- ClockTimePicker`
Expected: FAIL — `Cannot find module '../ClockTimePicker'`.

- [ ] **Step 3: Write the implementation**

```tsx
// apps/mobile/components/primitives/ClockTimePicker.tsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import {
  clockPositions,
  hourRings,
  minuteTicks,
  setClockHour,
  setClockMinute,
} from '../../lib/date/clockGrid';

const pad2 = (n: number) => String(n).padStart(2, '0');

const SIZE = 260;
const CENTER = SIZE / 2;
const OUTER_R = 108;
const INNER_R = 70;
const TILE = 36;

export interface ClockTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  /** Fired after a minute is picked — the terminal action (parent closes here). */
  onCommit?: () => void;
  minuteStep?: number;
  testID?: string;
}

export function ClockTimePicker({ value, onChange, onCommit, minuteStep = 5, testID }: ClockTimePickerProps) {
  const [page, setPage] = useState<'hour' | 'minute'>('hour');
  const { outer, inner } = hourRings();
  const hour = value.getHours();
  const minute = value.getMinutes();

  function tile(v: number, x: number, y: number, kind: 'hour' | 'minute', selected: boolean) {
    return (
      <Pressable
        key={`${kind}-${v}`}
        testID={testID ? `${testID}-${kind}-${v}` : undefined}
        accessibilityRole="button"
        onPress={() => {
          if (kind === 'hour') {
            onChange(setClockHour(value, v));
            setPage('minute');
          } else {
            onChange(setClockMinute(value, v));
            onCommit?.();
          }
        }}
        style={[styles.tile, { left: CENTER + x - TILE / 2, top: CENTER + y - TILE / 2 }]}
        className={`items-center justify-center rounded-full ${selected ? 'bg-accent' : ''}`}
      >
        <Text tone={selected ? 'onAccent' : 'primary'}>{pad2(v)}</Text>
      </Pressable>
    );
  }

  return (
    <View testID={testID}>
      <View className="flex-row items-center justify-center" style={styles.readout}>
        <Pressable testID={testID ? `${testID}-show-hour` : undefined} onPress={() => setPage('hour')}>
          <Text variant="h3" tone={page === 'hour' ? 'primary' : 'muted'}>{pad2(hour)}</Text>
        </Pressable>
        <Text variant="h3">:</Text>
        <Pressable testID={testID ? `${testID}-show-minute` : undefined} onPress={() => setPage('minute')}>
          <Text variant="h3" tone={page === 'minute' ? 'primary' : 'muted'}>{pad2(minute)}</Text>
        </Pressable>
      </View>

      <View style={styles.face}>
        {page === 'hour'
          ? [
              ...clockPositions(outer, OUTER_R).map((p) => tile(p.value, p.x, p.y, 'hour', p.value === hour)),
              ...clockPositions(inner, INNER_R).map((p) => tile(p.value, p.x, p.y, 'hour', p.value === hour)),
            ]
          : clockPositions(minuteTicks(minuteStep), OUTER_R).map((p) =>
              tile(p.value, p.x, p.y, 'minute', p.value === minute),
            )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { gap: 4, paddingBottom: 12 },
  face: { width: SIZE, height: SIZE, alignSelf: 'center' },
  tile: { position: 'absolute', width: TILE, height: TILE },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm app:test -- ClockTimePicker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/primitives/ClockTimePicker.tsx \
        apps/mobile/components/primitives/__tests__/ClockTimePicker.test.tsx
git commit -m "feat(mobile): add tap-only 24h ClockTimePicker primitive"
```

---

### Task 3: Rewire `DateTimeField` — compact modal, clock, separate labels

**Files:**
- Modify: `apps/mobile/components/primitives/DateTimeField.tsx`
- Delete: `apps/mobile/components/primitives/TimePicker.tsx`, `apps/mobile/components/primitives/__tests__/TimePicker.test.tsx`
- Test: `apps/mobile/components/primitives/__tests__/DateTimeField.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `ClockTimePicker` (Task 2), existing `CalendarDatePicker`.
- Produces (new `DateTimeFieldProps` — additive):
  - `datePlaceholder?: string` — shown on the date button when `value` is null (falls back to `placeholder`, then `'Fecha'`).
  - `timePlaceholder?: string` — shown on the time button when `value` is null (falls back to `placeholder`, then `'Hora'`).
  - Date modal closes on day pick; time modal closes when a **minute** is picked (hour tap only advances the clock page). The clock's minute-pick testID remains `${testID}-time-picker-minute-<m>`.

- [ ] **Step 1: Rewrite the test (failing)**

```tsx
// apps/mobile/components/primitives/__tests__/DateTimeField.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { DateTimeField } from '../DateTimeField';

it('shows distinct date and time placeholders when empty', () => {
  const { getByTestId } = render(
    <DateTimeField
      label="Inicio"
      value={null}
      onChange={jest.fn()}
      datePlaceholder="Seleccionar fecha"
      timePlaceholder="Seleccionar hora"
      testID="dt"
    />,
  );
  expect(getByTestId('dt-date')).toHaveTextContent('Seleccionar fecha');
  expect(getByTestId('dt-time')).toHaveTextContent('Seleccionar hora');
});

it('picks a day, preserving the time', () => {
  const onChange = jest.fn();
  const { getByTestId } = render(
    <DateTimeField label="Inicio" value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} testID="dt" />,
  );
  fireEvent.press(getByTestId('dt-date'));
  fireEvent.press(getByTestId('dt-date-calendar-day-2026-07-05'));
  const d = onChange.mock.calls.at(-1)![0] as Date;
  expect(d.getDate()).toBe(5);
  expect(d.getHours()).toBe(9);
});

it('picks a minute on the clock, preserving the date and closing the modal', () => {
  const onChange = jest.fn();
  const { getByTestId, queryByTestId } = render(
    <DateTimeField label="Inicio" value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} testID="dt" />,
  );
  fireEvent.press(getByTestId('dt-time'));
  fireEvent.press(getByTestId('dt-time-picker-hour-14')); // advances to minute page
  fireEvent.press(getByTestId('dt-time-picker-minute-30'));
  const d = onChange.mock.calls.at(-1)![0] as Date;
  expect(d.getHours()).toBe(14);
  expect(d.getMinutes()).toBe(30);
  expect(d.getDate()).toBe(1);
  expect(queryByTestId('dt-time-picker')).toBeNull(); // modal closed after minute pick
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm app:test -- DateTimeField`
Expected: FAIL — placeholder assertions fail / minute-close behavior missing.

- [ ] **Step 3: Rewrite `DateTimeField.tsx`**

Replace the file with:

```tsx
import { useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@cultuvilla/shared/utils/format';
import { colors } from '@cultuvilla/shared/design-system';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { Card } from './Card';
import { FieldLabel } from './FieldLabel';
import { Button } from './Button';
import { CalendarDatePicker } from './CalendarDatePicker';
import { ClockTimePicker } from './ClockTimePicker';

const ACCENT = colors.light.fg.accent;

export interface DateTimeFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Minute granularity for the clock. Defaults to 5. */
  minuteStep?: number;
  /** Fallback placeholder for both buttons. */
  placeholder?: string;
  /** Placeholder shown on the date button when empty. Falls back to `placeholder`. */
  datePlaceholder?: string;
  /** Placeholder shown on the time button when empty. Falls back to `placeholder`. */
  timePlaceholder?: string;
  testID?: string;
}

type ActiveModal = 'date' | 'time' | null;

function defaultDraft(minimumDate?: Date): Date {
  const base = minimumDate && minimumDate.getTime() > Date.now() ? new Date(minimumDate) : new Date();
  base.setSeconds(0, 0);
  return base;
}

/**
 * Date + time picker: two side-by-side buttons, each opening a compact centered
 * dialog — the calendar grid for the date, the tap-only clock for the time.
 * Picking a date preserves the time and vice versa, so the two buttons compose
 * onto the same underlying value.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  minuteStep = 5,
  placeholder,
  datePlaceholder,
  timePlaceholder,
  testID,
}: DateTimeFieldProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const insets = useSafeAreaInsets();
  const current = value ?? defaultDraft(minimumDate);

  function pickDate(day: Date) {
    const merged = new Date(current);
    merged.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(merged);
    setActiveModal(null);
  }

  // Hour and minute taps both update the value; only a minute tap commits
  // (fires onCommit), so an hour tap keeps the clock open on its minute page.
  function updateTime(time: Date) {
    onChange(time);
  }

  const dateText = value ? formatDate(value, 'dayMonth') : (datePlaceholder ?? placeholder ?? 'Fecha');
  const timeText = value ? formatDate(value, 'time') : (timePlaceholder ?? placeholder ?? 'Hora');

  function dialog(children: React.ReactNode) {
    return (
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          onPress={() => setActiveModal(null)}
        />
        <Card variant="elevated" className="w-full max-w-sm" testID={testID ? `${testID}-dialog` : undefined}>
          <View style={[styles.dialogInner, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <Text variant="h3">{label}</Text>
            {children}
            <View style={styles.dialogActions}>
              <Button variant="secondary" onPress={() => setActiveModal(null)}>
                Cancelar
              </Button>
            </View>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View testID={testID}>
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row gap-3" style={styles.row}>
        <Pressable
          onPress={() => setActiveModal('date')}
          accessibilityRole="button"
          testID={testID ? `${testID}-date` : undefined}
          className="flex-1"
          style={[styles.trigger, { flex: 1 }]}
        >
          <Ionicons name="calendar-outline" size={18} color={ACCENT} />
          <Text numberOfLines={1} tone={value ? 'primary' : 'muted'} style={styles.triggerText}>
            {dateText}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveModal('time')}
          accessibilityRole="button"
          testID={testID ? `${testID}-time` : undefined}
          className="flex-1"
          style={[styles.trigger, { flex: 1 }]}
        >
          <Ionicons name="time-outline" size={18} color={ACCENT} />
          <Text numberOfLines={1} tone={value ? 'primary' : 'muted'} style={styles.triggerText}>
            {timeText}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={activeModal === 'date'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        {dialog(
          <CalendarDatePicker
            testID={testID ? `${testID}-date-calendar` : undefined}
            value={current}
            onChange={pickDate}
            minDate={minimumDate}
            maxDate={maximumDate}
          />,
        )}
      </Modal>

      <Modal
        visible={activeModal === 'time'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        {dialog(
          <ClockTimePicker
            testID={testID ? `${testID}-time-picker` : undefined}
            value={current}
            onChange={updateTime}
            onCommit={() => setActiveModal(null)}
            minuteStep={minuteStep}
          />,
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 4 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  triggerText: { flexShrink: 1 },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 16,
  },
  dialogInner: { gap: 12 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
```

- [ ] **Step 4: Delete the obsolete `TimePicker`**

```bash
git rm apps/mobile/components/primitives/TimePicker.tsx \
       apps/mobile/components/primitives/__tests__/TimePicker.test.tsx
```

(`TimePicker` is not re-exported from `components/primitives/index.ts`, so no index edit is needed. Confirm with `grep -rn "TimePicker" apps/mobile` — only `ClockTimePicker` should remain.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm app:test -- DateTimeField ClockTimePicker`
Expected: PASS. Then `grep -rn "from './TimePicker'" apps/mobile` → no matches.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/primitives/DateTimeField.tsx \
        apps/mobile/components/primitives/__tests__/DateTimeField.test.tsx
git rm --cached apps/mobile/components/primitives/TimePicker.tsx 2>/dev/null; true
git commit -m "feat(mobile): compact-modal DateTimeField on the clock picker; drop list TimePicker"
```

---

### Task 4: Pre-seed event start, separate labels, i18n, CHANGELOG

**Files:**
- Modify: `apps/mobile/app/event/new.tsx` (line 97 `startDate` init; the two `DateTimeField` usages ~397–411)
- Modify: `packages/i18n/messages/es.json` (under `event`)
- Modify: `apps/mobile/app/event/__tests__/new.test.tsx` (surface `value` in the `DateTimeField` mock)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `roundUpToMinuteStep` (Task 1); `datePlaceholder`/`timePlaceholder` (Task 3).

- [ ] **Step 1: Add the failing test**

In `apps/mobile/app/event/__tests__/new.test.tsx`, replace the `DateTimeField` mock so it exposes the passed `value`, and add an assertion:

```tsx
// Drive DateTimeField.onChange directly; also surface the incoming value for assertions.
jest.mock('../../../components/primitives/DateTimeField', () => ({
  DateTimeField: ({ onChange, testID, value }: { onChange: (d: Date) => void; testID?: string; value: Date | null }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={testID} onPress={() => onChange(new Date('2026-08-01T18:00'))}>
        <Text testID={`${testID}-value`}>{value ? value.toISOString() : ''}</Text>
      </Pressable>
    );
  },
}));
```

Add a test:

```tsx
it('pre-seeds the event start with a 5-minute-aligned current time', async () => {
  const { getByTestId } = render(<NewEventScreen />);
  await waitFor(() => getByTestId('startDate-value'));
  const iso = getByTestId('startDate-value').props.children as string;
  expect(iso).not.toBe(''); // not the empty placeholder
  expect(new Date(iso).getMinutes() % 5).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm app:test -- app/event/__tests__/new.test.tsx`
Expected: FAIL — `startDate-value` is empty because `startDate` starts `null`.

- [ ] **Step 3: Implement**

In `apps/mobile/app/event/new.tsx`:

1. Add the import (with the other `lib/date` / util imports):

```tsx
import { roundUpToMinuteStep } from '../../lib/date/clockGrid';
```

2. Change the `startDate` initializer (line 97) to a lazy default (edit mode still overrides it via the existing `setStartDate(ev.startDate)` effect):

```tsx
const [startDate, setStartDate] = useState<Date | null>(() => roundUpToMinuteStep(new Date(), 5));
```

3. Pass distinct placeholders to both `DateTimeField`s (~397 and ~405):

```tsx
<DateTimeField
  label={t('event.startDateTime')}
  value={startDate}
  onChange={setStartDate}
  minimumDate={new Date()}
  datePlaceholder={t('event.selectDate')}
  timePlaceholder={t('event.selectTime')}
  testID="startDate"
/>
```

```tsx
<DateTimeField
  label={t('event.endDateTime')}
  value={endDate}
  onChange={setEndDate}
  minimumDate={startDate ?? new Date()}
  datePlaceholder={t('event.selectDate')}
  timePlaceholder={t('event.selectTime')}
  testID="endDate"
/>
```

4. In `packages/i18n/messages/es.json`, add under `event` (next to `selectDateTime` at line 532):

```json
    "selectDate": "Seleccionar fecha",
    "selectTime": "Seleccionar hora",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm app:test -- app/event/__tests__/new.test.tsx`
Expected: PASS.

- [ ] **Step 5: CHANGELOG**

Under `## [Unreleased]` in `CHANGELOG.md`, add:

```markdown
- Time picker is now a tap-only 24-hour clock face (outer 1–12 / inner 13–23+00) in a compact dialog; the date and time buttons read "Seleccionar fecha" / "Seleccionar hora", and a new event's start time is pre-filled with the current time.
```

- [ ] **Step 6: Full gate + commit**

Run: `pnpm app:typecheck && pnpm app:test`
Expected: PASS (no `any`, no unused `TimePicker` references).

```bash
git add apps/mobile/app/event/new.tsx apps/mobile/app/event/__tests__/new.test.tsx \
        packages/i18n/messages/es.json CHANGELOG.md
git commit -m "feat(mobile): pre-seed event start time; split date/time picker labels"
```

---

### Final verification (before PR)

- [ ] `pnpm check` green from the worktree.
- [ ] Manually drive the web build (or AVD via `drive-android-avd`) per `verify`: open event creation, confirm the clock opens in a compact dialog, hour→minute flow works, and both buttons show the right Spanish labels. Web-first is the release target — verify there first.
- [ ] Promote this plan `docs/plans/ready/ → docs/plans/ongoing/` with a status header when execution starts (per `managing-plans-lifecycle`), and retire it to `docs/decisions/` once merged.
