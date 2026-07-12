# Calendar date + time picker (Órdago-style)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement the Tasks section below
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's two divergent date inputs with one hand-rolled month-grid
calendar date picker plus a small JS time picker, matching the sibling `ordago-apps`
look and giving web and native a single codepath.

**Architecture:** A pure date-math helper builds the month grid and drives all state
logic (testable in isolation, no RN). Two new primitives (`CalendarDatePicker`,
`TimePicker`) render it with NativeWind + design tokens. The two existing field
components (`DateField`, `DateTimeField`) keep their names/APIs but are rewritten to
compose the new primitives, so the 7 call sites barely change.

**Tech Stack:** Expo / React Native, NativeWind v4, `@cultuvilla/shared` design
tokens + `formatDate`, `useT()` i18n, jest + `@testing-library/react-native` for
mobile tests. No new dependency; the native `@react-native-community/datetimepicker`
is removed.

## Global Constraints

- **No new picker/calendar library** — hand-rolled, mirroring Órdago's `CustomCalendar`.
- **Design tokens only** — `bg-primary`, `text-body`, `rounded-md`, `spacing[…]`,
  `iconSizes`. No raw hexes ported from Órdago, no raw Tailwind palette names.
- **i18n / locale** — reuse the single locale source: `monthShortLabels()` for month
  names and `formatDate` from `packages/shared/src/utils/format.ts` for the trigger
  text; weekday labels from a localized `es-ES` constant. Never call `Intl.*` directly
  in a component.
- **Preserve public APIs** — both `DateField` and `DateTimeField` keep their exact
  current props (`label`, `value: Date | null`, `onChange: (Date | null) => void`,
  `minimumDate?`, `maximumDate?`, `testID?`; `DateTimeField` also keeps `minuteStep?`
  and `placeholder?`) so call sites don't change.
- **Service-layer rule is N/A** — this is pure UI, touches no Firebase.
- **Safe area** — the bottom-anchored picker sheet pads by `insets.bottom`.
- **Strict TS** — no `any`; `Date` in/out at component boundaries.
- **Single date only** — no range selection (out of scope).

## Context

The app has two custom date inputs, backed by one native library:

- `DateTimeField` (date + time) — a modal that opens the **native** OS dialog on
  device (`@react-native-community/datetimepicker`) but falls back to **custom wheel
  columns on the web build**. Used only in event create (start + end).
- `DateField` (date only) — Año/Mes/Día segments opening full-screen scroll
  `FlatList`s. No calendar grid. Used in persona birthday, censo date field, and
  festival-poster create + edit (5 sites).

Neither renders a calendar grid, and the web experience diverges from native. The
user wants the Órdago look: a real month grid where you tap a day, with time as a
companion control beside it.

`ordago-apps` has exactly the pieces, in two places:

- `apps/ordago-app/components/common/pickers/CustomCalendar.js` — a hand-rolled
  month grid (chevron month-nav header, weekday row, `100/7`%-width day cells via
  flex-wrap, today/selected/range/past states). Pure `StyleSheet`, no library.
  Used only in filter modals.
- `apps/ordago-app/screens/matches/match-creation/steps/Step3DescriptionLocation.js`
  — the "Fecha y Hora" step: a **side-by-side row** of a date button (calendar icon
  + formatted date) and a time button (clock icon + formatted time), each `flex:1`,
  gap 12, each opening the native picker in the matching mode.

So the grid and the date+time layout live in different Órdago screens; this plan
combines the grid look with that side-by-side layout, all in JS so web == native.

## Design / approach

Build hand-rolled, no new library (mirrors Órdago; and the current native lib gets
removed). Three pieces, all under `apps/mobile/components/primitives/`, composed from
existing primitives and design tokens.

### 1. `CalendarDatePicker`

The ported Órdago month grid as a NativeWind primitive.

- Chevron month-nav header, `Dom/Lun/Mar/…` weekday row, 7-column day cells
  (flex-wrap of `100/7`%-width cells). Leading blank cells for the first weekday
  offset. States: today, selected (circular pill, `bg-primary`), past/out-of-range
  (dimmed, disabled).
- **Tappable header title** (`julio 2026`) → opens a compact year + month quick
  selector, then drops into that month's grid. This is what lets one component serve
  both a near-future event date and a 1974 birthday without hundreds of chevron taps.
- Props: `value: Date`, `onChange: (d: Date) => void`, optional `minDate` / `maxDate`.
  Birthday sets `min = 1900-01-01`, `max = today`; event/festival dates set
  `min = today`.
- Pure JS → identical on web and native, no native module.

### 2. `TimePicker`

Small all-JS hour + minute control (24h), same styling language, works everywhere.
Replaces the native time spinner + the web wheel fallback with one codepath.

### 3. Composition (the two field components consumers use)

Órdago's side-by-side row is the reusable shape:

- **`DateField`** (date-only, replaces the old one): renders a single date button
  (calendar icon + `formatDate`) → opens `CalendarDatePicker` in a modal/sheet.
- **`DateTimeField`** (date + time, replaces the old one): the two-button row — date
  button + time button (`flex-row gap-3`, each `flex-1`) → `CalendarDatePicker` +
  `TimePicker`.

Same component names as today so the churn at call sites is minimal; the internals
are fully rewritten.

### What gets deleted

- Old `DateField.tsx` (Año/Mes/Día scroll-lists) and old `DateTimeField.tsx`
  (native-dialog + web-wheels) internals — rewritten in place.
- `@react-native-community/datetimepicker` dependency — becomes unused, removed from
  `apps/mobile/package.json`. Per *Delete > deprecate*, no shims, no dual-read.

### Call sites (7, unchanged API where possible)

- Persona birthday — `PersonForm.tsx:274` (date-only, min 1900 / max birthdayMax)
- Censo date field — `CensoFieldInput.tsx:53` (date-only, stores `YYYY-MM-DD`)
- Festival poster create — `FestivalPostersManager.tsx:96,102` (date-only ×2)
- Festival poster edit — `festival-poster/[posterId]/edit.tsx:143,148` (date-only ×2)
- Event create — `event/new.tsx:397,405` (date + time, start + end)

### Styling & i18n

- Design tokens only (`bg-primary`, `text-body`, `rounded-md`, `spacing[…]`,
  `iconSizes`) — no hardcoded hexes ported from Órdago (its grid even had a
  green/teal inconsistency). Map Órdago green → cultuvilla `primary`.
- Weekday labels + month names through `useT()`; formatted values through the
  `es-ES` `formatDate` in `packages/shared/src/utils/format.ts`. Never `Intl`
  directly.
- Respect safe-area insets for the bottom-anchored picker sheet (pad by
  `insets.bottom`).

### Testing

- New specs for `CalendarDatePicker` (grid generation per month, leading-blank count,
  min/max disabling, month/year jump from the header) and `TimePicker` (hour/minute
  selection, 24h).
- Keep consumer tests green, updated to new internals: `DateField.test.tsx`,
  `PersonForm.test.tsx`, event `new.test.tsx` / `eventId.test.tsx`.

## Out of scope

- **Range selection.** Órdago's grid supports date ranges (for filters); none of our
  7 sites need it. Single-date only. (Event start/end are two independent fields, not
  a range.)
- **Adding a time control to date-only sites.** Birthday, censo, and festival-poster
  dates stay date-only; only event start/end carry time.
- **Native OS spinner.** Deliberately dropped in favor of the all-JS control for
  web/native parity.

## File Structure

- **Create** `apps/mobile/lib/date/calendarGrid.ts` — pure, RN-free date math: build a
  6×7 month matrix, day-comparison and clamp helpers. All picker state logic lives
  here so it's unit-testable without rendering.
- **Create** `apps/mobile/lib/date/__tests__/calendarGrid.test.ts` — jest specs for the math.
- **Create** `apps/mobile/components/primitives/CalendarDatePicker.tsx` — the month-grid
  UI (header + tappable month/year jump, weekday row, day cells).
- **Create** `apps/mobile/components/primitives/__tests__/CalendarDatePicker.test.tsx`.
- **Create** `apps/mobile/components/primitives/TimePicker.tsx` — JS hour/minute control.
- **Create** `apps/mobile/components/primitives/__tests__/TimePicker.test.tsx`.
- **Modify** `apps/mobile/components/primitives/DateField.tsx` — rewrite internals to a
  single date button opening `CalendarDatePicker`; keep the prop signature.
- **Modify** `apps/mobile/components/primitives/DateTimeField.tsx` — rewrite to the
  side-by-side date+time button row using `CalendarDatePicker` + `TimePicker`; delete
  the `require('@react-native-community/datetimepicker')` path and the `WebWheels`
  fallback; keep the prop signature.
- **Modify** `apps/mobile/components/primitives/index.ts` (barrel) — no export changes
  expected (names unchanged); add `CalendarDatePicker`/`TimePicker` if we want them
  reusable, otherwise keep them module-local.
- **Modify** `apps/mobile/components/primitives/__tests__/DateField.test.tsx` — rewrite
  for the grid interaction.
- **Modify** `apps/mobile/app/event/__tests__/new.test.tsx` and `eventId.test.tsx`,
  `apps/mobile/components/feature/__tests__/PersonForm.test.tsx` — update to the new
  DOM/testIDs.
- **Modify** `apps/mobile/package.json` — remove `@react-native-community/datetimepicker`.

Call sites (`PersonForm.tsx:274`, `CensoFieldInput.tsx:53`,
`FestivalPostersManager.tsx:119,125`, `festival-poster/[posterId]/edit.tsx:161,166`,
`event/new.tsx:397,405`) need **no prop changes** — only re-verification via tests.

## Tasks

> RED/GREEN/COMMIT per step. Run the mobile suite with `pnpm app:test`; typecheck with
> `pnpm app:typecheck`. Reference exact Expo v56 APIs (see `apps/mobile/AGENTS.md`).

### Task 1: Pure month-grid math

**Files:**
- Create: `apps/mobile/lib/date/calendarGrid.ts`
- Test: `apps/mobile/lib/date/__tests__/calendarGrid.test.ts`

**Interfaces:**
- Produces:
  - `interface DayCell { date: Date; inMonth: boolean; }`
  - `function buildMonthMatrix(year: number, monthZeroBased: number): DayCell[]` —
    always 42 cells (6 rows × 7 cols), Monday-first, leading/trailing days flagged
    `inMonth: false`.
  - `function isSameDay(a: Date, b: Date): boolean`
  - `function isDayDisabled(day: Date, minDate?: Date, maxDate?: Date): boolean` —
    compares by calendar day, ignoring time-of-day.
  - `function clampMonth(year: number, monthZeroBased: number): { year: number; month: number }`
    — normalizes overflow/underflow (e.g. month `-1` → Dec of prior year), used by
    chevron nav.

- [ ] **Step 1: Write failing tests**

```ts
import { buildMonthMatrix, isSameDay, isDayDisabled, clampMonth } from '../calendarGrid';

describe('buildMonthMatrix', () => {
  it('returns 42 cells, Monday-first', () => {
    const cells = buildMonthMatrix(2026, 6); // July 2026, 1st is a Wednesday
    expect(cells).toHaveLength(42);
    // Monday-first: Jul 1 (Wed) sits at index 2; indices 0-1 are prior-month days.
    expect(cells[2].date.getDate()).toBe(1);
    expect(cells[2].inMonth).toBe(true);
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].inMonth).toBe(false);
  });

  it('flags trailing next-month days out of month', () => {
    const cells = buildMonthMatrix(2026, 6);
    const last = cells[cells.length - 1];
    expect(last.inMonth).toBe(false);
  });
});

describe('isSameDay', () => {
  it('ignores time-of-day', () => {
    expect(isSameDay(new Date(2026, 6, 1, 9, 0), new Date(2026, 6, 1, 23, 59))).toBe(true);
    expect(isSameDay(new Date(2026, 6, 1), new Date(2026, 6, 2))).toBe(false);
  });
});

describe('isDayDisabled', () => {
  it('respects min/max by calendar day', () => {
    const min = new Date(2026, 6, 10, 23, 0);
    expect(isDayDisabled(new Date(2026, 6, 10, 0, 0), min)).toBe(false); // same day allowed
    expect(isDayDisabled(new Date(2026, 6, 9), min)).toBe(true);
    const max = new Date(2026, 6, 10);
    expect(isDayDisabled(new Date(2026, 6, 11), undefined, max)).toBe(true);
  });
});

describe('clampMonth', () => {
  it('wraps month underflow/overflow', () => {
    expect(clampMonth(2026, -1)).toEqual({ year: 2025, month: 11 });
    expect(clampMonth(2026, 12)).toEqual({ year: 2027, month: 0 });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm app:test -- calendarGrid`
Expected: FAIL — module not found / functions undefined.

- [ ] **Step 3: Implement `calendarGrid.ts`**

```ts
export interface DayCell {
  date: Date;
  inMonth: boolean;
}

/** Monday-first weekday index (Mon=0 … Sun=6). */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function buildMonthMatrix(year: number, monthZeroBased: number): DayCell[] {
  const first = new Date(year, monthZeroBased, 1);
  const lead = mondayIndex(first);
  const start = new Date(year, monthZeroBased, 1 - lead);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date, inMonth: date.getMonth() === monthZeroBased });
  }
  return cells;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function isDayDisabled(day: Date, minDate?: Date, maxDate?: Date): boolean {
  const t = startOfDay(day);
  if (minDate && t < startOfDay(minDate)) return true;
  if (maxDate && t > startOfDay(maxDate)) return true;
  return false;
}

export function clampMonth(
  year: number,
  monthZeroBased: number,
): { year: number; month: number } {
  const normalized = new Date(year, monthZeroBased, 1);
  return { year: normalized.getFullYear(), month: normalized.getMonth() };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm app:test -- calendarGrid`
Expected: PASS (4 suites).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/date/calendarGrid.ts apps/mobile/lib/date/__tests__/calendarGrid.test.ts
git commit -m "feat(mobile): add pure month-grid date math for calendar picker"
```

### Task 2: `CalendarDatePicker` component

**Files:**
- Create: `apps/mobile/components/primitives/CalendarDatePicker.tsx`
- Test: `apps/mobile/components/primitives/__tests__/CalendarDatePicker.test.tsx`

**Interfaces:**
- Consumes: `buildMonthMatrix`, `isSameDay`, `isDayDisabled`, `clampMonth` (Task 1);
  `monthShortLabels` and `formatDate` from `@cultuvilla/shared/utils/format`.
- Produces:
  ```ts
  export interface CalendarDatePickerProps {
    value: Date | null;
    onChange: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    testID?: string;
  }
  export function CalendarDatePicker(props: CalendarDatePickerProps): JSX.Element;
  ```
  - Header: `‹` prev-month, tappable month/year title (opens a year+month jump list),
    `›` next-month.
  - Weekday row: localized `['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']`.
  - Day cells via `buildMonthMatrix`; selected day = `bg-primary` pill; disabled days
    (`isDayDisabled`) dimmed + non-pressable; out-of-month cells dimmed.
  - testIDs: `${testID}-prev`, `${testID}-next`, `${testID}-title`,
    `${testID}-day-YYYY-MM-DD`, and in jump mode `${testID}-year-<y>` / `${testID}-month-<m>`.

- [ ] **Step 1: Write failing tests**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { CalendarDatePicker } from '../CalendarDatePicker';

describe('CalendarDatePicker', () => {
  it('emits the tapped day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <CalendarDatePicker value={new Date(2026, 6, 1)} onChange={onChange} testID="cal" />,
    );
    fireEvent.press(getByTestId('cal-day-2026-07-15'));
    const picked = onChange.mock.calls.at(-1)![0] as Date;
    expect(picked.getFullYear()).toBe(2026);
    expect(picked.getMonth()).toBe(6);
    expect(picked.getDate()).toBe(15);
  });

  it('navigates to the next month via the chevron', () => {
    const { getByTestId, queryByTestId } = render(
      <CalendarDatePicker value={new Date(2026, 6, 1)} onChange={() => {}} testID="cal" />,
    );
    expect(queryByTestId('cal-day-2026-08-10')).toBeNull();
    fireEvent.press(getByTestId('cal-next'));
    expect(getByTestId('cal-day-2026-08-10')).toBeTruthy();
  });

  it('jumps to a far-past month/year from the title', () => {
    const { getByTestId } = render(
      <CalendarDatePicker
        value={new Date(2026, 6, 1)}
        onChange={() => {}}
        minDate={new Date(1900, 0, 1)}
        maxDate={new Date(2026, 6, 10)}
        testID="cal"
      />,
    );
    fireEvent.press(getByTestId('cal-title'));
    fireEvent.press(getByTestId('cal-year-1974'));
    fireEvent.press(getByTestId('cal-month-2')); // March (0-based)
    expect(getByTestId('cal-day-1974-03-05')).toBeTruthy();
  });

  it('does not emit for a disabled (out-of-range) day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <CalendarDatePicker
        value={new Date(2026, 6, 10)}
        onChange={onChange}
        minDate={new Date(2026, 6, 10)}
        testID="cal"
      />,
    );
    fireEvent.press(getByTestId('cal-day-2026-07-05')); // before min
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm app:test -- CalendarDatePicker`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `CalendarDatePicker.tsx`**

Compose from primitives (`Pressable`, `Text`, `View`) + NativeWind classes + design
tokens; drive state with Task 1 helpers. Key structure (fill in styling with semantic
Tailwind classes — `bg-primary`, `text-body`, `rounded-full`, `spacing`):

```tsx
import { useState } from 'react';
import { View, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { monthShortLabels } from '@cultuvilla/shared/utils/format';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { buildMonthMatrix, isSameDay, isDayDisabled, clampMonth } from '../../lib/date/calendarGrid';

const WEEKDAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = monthShortLabels(); // es-ES, single locale source
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface CalendarDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  testID?: string;
}

export function CalendarDatePicker({ value, onChange, minDate, maxDate, testID }: CalendarDatePickerProps) {
  const anchor = value ?? new Date();
  const [view, setView] = useState({ year: anchor.getFullYear(), month: anchor.getMonth() });
  const [jump, setJump] = useState(false);

  const cells = buildMonthMatrix(view.year, view.month);
  const go = (delta: number) => setView((v) => clampMonth(v.year, v.month + delta));

  const minYear = (minDate ?? new Date(1900, 0, 1)).getFullYear();
  const maxYear = (maxDate ?? new Date(anchor.getFullYear() + 5, 11, 31)).getFullYear();
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y -= 1) years.push(y);

  if (jump) {
    return (
      <View testID={testID}>
        <FlatList
          data={years}
          keyExtractor={(y) => String(y)}
          initialNumToRender={30}
          renderItem={({ item }) => (
            <Pressable
              testID={testID ? `${testID}-year-${item}` : undefined}
              onPress={() => setView((v) => ({ ...v, year: item }))}
            >
              <Text>{item}</Text>
            </Pressable>
          )}
        />
        <View className="flex-row flex-wrap">
          {MONTHS.map((m, i) => (
            <Pressable
              key={m}
              testID={testID ? `${testID}-month-${i}` : undefined}
              onPress={() => { setView((v) => ({ ...v, month: i })); setJump(false); }}
            >
              <Text>{m}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View testID={testID}>
      <View className="flex-row items-center justify-between">
        <Pressable testID={testID ? `${testID}-prev` : undefined} onPress={() => go(-1)}>
          <Ionicons name="chevron-back" size={iconSizes.md} />
        </Pressable>
        <Pressable testID={testID ? `${testID}-title` : undefined} onPress={() => setJump(true)}>
          <Text variant="h3">{`${MONTHS[view.month]} ${view.year}`}</Text>
        </Pressable>
        <Pressable testID={testID ? `${testID}-next` : undefined} onPress={() => go(1)}>
          <Ionicons name="chevron-forward" size={iconSizes.md} />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS_ES.map((w) => (
          <Text key={w} className="flex-1 text-center" tone="muted">{w}</Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map(({ date, inMonth }) => {
          const disabled = isDayDisabled(date, minDate, maxDate);
          const selected = value != null && isSameDay(date, value);
          return (
            <Pressable
              key={iso(date)}
              testID={testID ? `${testID}-day-${iso(date)}` : undefined}
              disabled={disabled}
              onPress={() => onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate()))}
              className={`items-center justify-center ${selected ? 'bg-primary rounded-full' : ''}`}
              style={{ width: `${100 / 7}%`, height: 40 }}
            >
              <Text tone={disabled || !inMonth ? 'muted' : 'primary'}>{date.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

> Note: match the surrounding token/styling idiom (the day pill should use `bg-primary`
> and rounded token, not a raw hex). The `100/7`% width mirrors Órdago's grid.

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm app:test -- CalendarDatePicker`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/primitives/CalendarDatePicker.tsx apps/mobile/components/primitives/__tests__/CalendarDatePicker.test.tsx
git commit -m "feat(mobile): add Órdago-style CalendarDatePicker grid primitive"
```

### Task 3: `TimePicker` component

**Files:**
- Create: `apps/mobile/components/primitives/TimePicker.tsx`
- Test: `apps/mobile/components/primitives/__tests__/TimePicker.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface TimePickerProps {
    value: Date;
    onChange: (date: Date) => void;
    minuteStep?: number; // default 5
    testID?: string;
  }
  export function TimePicker(props: TimePickerProps): JSX.Element;
  ```
  - Two JS columns (hour 0–23, minute stepped). Selecting sets that field on a clone
    of `value`, preserving the date part. testIDs: `${testID}-hour-<h>`,
    `${testID}-minute-<m>`.

- [ ] **Step 1: Write failing tests**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { TimePicker } from '../TimePicker';

describe('TimePicker', () => {
  it('sets the hour while preserving the date and minutes', () => {
    const onChange = jest.fn();
    render(<TimePicker value={new Date(2026, 6, 1, 9, 30)} onChange={onChange} testID="t" />);
  });

  it('emits hour change preserving date', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePicker value={new Date(2026, 6, 1, 9, 30)} onChange={onChange} testID="t" />,
    );
    fireEvent.press(getByTestId('t-hour-14'));
    const d = onChange.mock.calls.at(-1)![0] as Date;
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(1);
  });

  it('emits minute change stepped by minuteStep', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <TimePicker value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} minuteStep={15} testID="t" />,
    );
    fireEvent.press(getByTestId('t-minute-45'));
    expect((onChange.mock.calls.at(-1)![0] as Date).getMinutes()).toBe(45);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm app:test -- TimePicker` → FAIL.

- [ ] **Step 3: Implement `TimePicker.tsx`**

```tsx
import { FlatList, View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';

const pad2 = (n: number) => String(n).padStart(2, '0');

export interface TimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minuteStep?: number;
  testID?: string;
}

export function TimePicker({ value, onChange, minuteStep = 5, testID }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  const setHour = (h: number) => { const d = new Date(value); d.setHours(h); d.setSeconds(0, 0); onChange(d); };
  const setMinute = (m: number) => { const d = new Date(value); d.setMinutes(m); d.setSeconds(0, 0); onChange(d); };

  return (
    <View className="flex-row" style={{ height: 180 }}>
      <FlatList
        style={{ flex: 1 }}
        data={hours}
        keyExtractor={(h) => String(h)}
        initialNumToRender={24}
        renderItem={({ item }) => (
          <Pressable testID={testID ? `${testID}-hour-${item}` : undefined} onPress={() => setHour(item)}>
            <Text tone={value.getHours() === item ? 'primary' : 'muted'}>{pad2(item)}</Text>
          </Pressable>
        )}
      />
      <FlatList
        style={{ flex: 1 }}
        data={minutes}
        keyExtractor={(m) => String(m)}
        renderItem={({ item }) => (
          <Pressable testID={testID ? `${testID}-minute-${item}` : undefined} onPress={() => setMinute(item)}>
            <Text tone={value.getMinutes() === item ? 'primary' : 'muted'}>{pad2(item)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 4: Run, verify pass** — `pnpm app:test -- TimePicker` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/primitives/TimePicker.tsx apps/mobile/components/primitives/__tests__/TimePicker.test.tsx
git commit -m "feat(mobile): add all-JS TimePicker (hour/minute) primitive"
```

### Task 4: Rewrite `DateField` to use the calendar

**Files:**
- Modify: `apps/mobile/components/primitives/DateField.tsx`
- Modify (rewrite): `apps/mobile/components/primitives/__tests__/DateField.test.tsx`

**Interfaces:**
- Consumes: `CalendarDatePicker` (Task 2), `formatDate` from `@cultuvilla/shared/utils/format`.
- Produces: unchanged `DateFieldProps` (`label`, `value: Date | null`,
  `onChange: (Date | null) => void`, `minimumDate?`, `maximumDate?`, `testID?`).
- Behaviour: renders `FieldLabel` + a single trigger button showing `formatDate(value)`
  or the label placeholder; tapping opens a bottom sheet/modal with `CalendarDatePicker`;
  picking a day calls `onChange` and closes. Trigger testID stays `${testID}-trigger`;
  add `${testID}-calendar` on the embedded picker.

- [ ] **Step 1: Rewrite the test (RED)**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { DateField } from '../DateField';

describe('DateField (calendar)', () => {
  it('shows the label placeholder when empty', () => {
    const { getByText } = render(<DateField label="Cumpleaños" value={null} onChange={() => {}} />);
    expect(getByText('Cumpleaños')).toBeTruthy();
  });

  it('opens the calendar and emits the picked day', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <DateField label="Fecha" value={new Date(2026, 6, 1)} onChange={onChange} testID="d" />,
    );
    fireEvent.press(getByTestId('d-trigger'));
    fireEvent.press(getByTestId('d-calendar-day-2026-07-20'));
    const picked = onChange.mock.calls.at(-1)![0] as Date;
    expect(picked.getMonth()).toBe(6);
    expect(picked.getDate()).toBe(20);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm app:test -- DateField` → FAIL.

- [ ] **Step 3: Rewrite `DateField.tsx`** — trigger button + `Modal` (safe-area padded)
  wrapping `<CalendarDatePicker testID={testID ? \`${testID}-calendar\` : undefined} … />`.
  Map `minimumDate`/`maximumDate` → `minDate`/`maxDate`. On day pick: `onChange(day)` +
  close. Use `formatDate(value, 'short')` for the trigger text. Keep the SafeAreaView
  bottom padding per the safe-area rule.

- [ ] **Step 4: Run, verify pass** — `pnpm app:test -- DateField` → PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm app:typecheck
git add apps/mobile/components/primitives/DateField.tsx apps/mobile/components/primitives/__tests__/DateField.test.tsx
git commit -m "refactor(mobile): rewrite DateField on CalendarDatePicker grid"
```

### Task 5: Rewrite `DateTimeField` to the date+time row

**Files:**
- Modify: `apps/mobile/components/primitives/DateTimeField.tsx`

**Interfaces:**
- Consumes: `CalendarDatePicker`, `TimePicker`, `formatDate`.
- Produces: unchanged `DateTimeFieldProps` (keeps `minuteStep`, `placeholder`).
- Behaviour: `FieldLabel` + a `flex-row gap-3` of two `flex-1` buttons — date (calendar
  icon + `formatDate`) and time (clock icon + `HH:mm`). Tapping either opens the matching
  picker in a modal. Deletes the native `require(...)` and `WebWheels`. Keeps
  `${testID}-trigger` (put it on the date button) and `${testID}-confirm` if still used
  by `new.test.tsx`; otherwise emit on pick and drop the confirm step (see Task 6).

- [ ] **Step 1: Add a focused RED test** (co-locate a new `DateTimeField.test.tsx`)

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { DateTimeField } from '../DateTimeField';

it('emits a date+time from the two-button row', () => {
  const onChange = jest.fn();
  const { getByTestId } = render(
    <DateTimeField label="Inicio" value={new Date(2026, 6, 1, 9, 0)} onChange={onChange} testID="dt" />,
  );
  fireEvent.press(getByTestId('dt-date'));
  fireEvent.press(getByTestId('dt-date-calendar-day-2026-07-05'));
  const d = onChange.mock.calls.at(-1)![0] as Date;
  expect(d.getDate()).toBe(5);
  expect(d.getHours()).toBe(9); // time preserved
});
```

- [ ] **Step 2: Run, verify fail** — `pnpm app:test -- DateTimeField` → FAIL.

- [ ] **Step 3: Rewrite `DateTimeField.tsx`** — two-button row; date button testID
  `${testID}-date`, time button `${testID}-time`. Modal hosts `CalendarDatePicker`
  (testID `${testID}-date-calendar`) or `TimePicker` (testID `${testID}-time-picker`).
  Merge picks onto a clone so date-pick preserves time and vice-versa (reuse the
  existing `applyPicked` merge logic, minus the native path). Remove the
  `@react-native-community/datetimepicker` require and `WebWheels`.

- [ ] **Step 4: Run, verify pass** — `pnpm app:test -- DateTimeField` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/primitives/DateTimeField.tsx apps/mobile/components/primitives/__tests__/DateTimeField.test.tsx
git commit -m "refactor(mobile): rewrite DateTimeField as calendar + JS time row"
```

### Task 6: Green the consumer tests + drop the native dependency

**Files:**
- Modify: `apps/mobile/app/event/__tests__/new.test.tsx`, `eventId.test.tsx`
- Modify: `apps/mobile/components/feature/__tests__/PersonForm.test.tsx`
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Run the full suite to find breakage**

Run: `pnpm app:test`
Expected: the event and PersonForm suites FAIL where they drove the old
`-trigger`/`-confirm`/segment testIDs.

- [ ] **Step 2: Update those tests** to drive the new interaction (open date button →
  press `…-calendar-day-YYYY-MM-DD`; for events, open time button → press
  `…-time-picker-hour-<h>` / `-minute-<m>`). Keep each test's original assertion about
  what the screen does with the value — only the interaction path changes.

- [ ] **Step 3: Remove the native dep**

```bash
cd apps/mobile
# remove the line "@react-native-community/datetimepicker": "9.1.0" from package.json
cd ../.. && pnpm install
```

Confirm nothing else imports it:

Run: `grep -rn "@react-native-community/datetimepicker" apps/mobile/`
Expected: no matches.

- [ ] **Step 4: Full green + typecheck**

Run: `pnpm app:test && pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/event/__tests__ apps/mobile/components/feature/__tests__/PersonForm.test.tsx apps/mobile/package.json pnpm-lock.yaml
git commit -m "refactor(mobile): migrate date/time call sites; drop native datetimepicker dep"
```

### Task 7: Verify on the web build + full gate

- [ ] **Step 1:** Run the repo gate — `pnpm check` (lint + typecheck + test + build).
  Expected: PASS.
- [ ] **Step 2:** Drive the actual app to see the picker (the `verify` / `run` skill):
  open event-create and persona-birthday, confirm the grid renders on web, the
  month/year jump reaches 1974, and time selection works. Capture a screenshot.
- [ ] **Step 3:** Update `CHANGELOG.md` under `## [Unreleased]` with a one-line
  user-facing note (new calendar date/time picker; native picker removed).
- [ ] **Step 4:** Commit the CHANGELOG.

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note calendar date/time picker"
```

## Self-review notes

- **Spec coverage:** grid (Task 2), month/year jump for birthdays (Task 2), JS time
  (Task 3), two-button composition (Task 5), all 7 call sites re-verified (Tasks 4–6),
  native dep removed (Task 6), token/i18n constraints threaded through Tasks 2–5.
- **Type consistency:** `CalendarDatePicker.onChange` is non-null `(Date) => void`; the
  field wrappers adapt to their existing nullable `(Date | null) => void` public API.
- **Out of scope** honored: no range selection, date-only sites stay date-only.
