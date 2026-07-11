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
