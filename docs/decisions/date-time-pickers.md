# Hand-rolled calendar date picker + time picker (no native/library dependency)

## Context

The app had two divergent date inputs and relied on
`@react-native-community/datetimepicker` for native date/time entry. The
sibling `ordago-apps` project has a hand-rolled month-grid `CustomCalendar`
with a matching look; cultuvilla wanted the same UX with one codepath shared
between web and native.

## Decision

- **No calendar/picker library.** `CalendarDatePicker` is a hand-rolled
  month-grid component; the pure date-math (building the grid, month/day
  state transitions) lives in a plain JS helper, testable without React
  Native, and drives the UI.
- **`@react-native-community/datetimepicker` was removed** — native and web
  now share one implementation instead of branching on platform.
- **Design tokens only** — no raw hexes ported from ordago, no raw Tailwind
  palette names; month/weekday labels come from the single locale source
  (`monthShortLabels()`, `formatDate`), never `Intl.*` called directly in a
  component.
- The two existing field components (`DateField`, `DateTimeField`) kept their
  names/APIs and were rewritten to compose the new primitives, so call sites
  barely changed.

## Follow-up: clock-face time picker

The initial time picker was two scrolling columns; a later pass replaced it
with `ClockTimePicker`, an Órdago-style 24h tappable clock face:

- **Tap-only, no drag/gesture** — kept deliberately pure-JS/no `PanResponder`,
  since gesture handling is a known RN-Web export risk (see
  `mobile-web-compat`).
- **Material 24-hour style**: two concentric rings (outer 1–12, inner
  13–23 + 00), no AM/PM toggle (un-Spanish). A minute ring (12 ticks at
  `minuteStep`, default 5) follows automatically after the hour tap.
- **Compact centered modal dialog**, not full-screen.
- Event start time now **defaults to `now` rounded up to the next 5-minute
  step** (`roundUpToMinuteStep`, `apps/mobile/lib/date/clockGrid.ts`) instead
  of an empty placeholder.
- The two trigger buttons read **"Seleccionar fecha"** / **"Seleccionar
  hora"** separately, rather than one combined "Seleccionar fecha y hora".

## What this binds

- New date/time entry points reuse `CalendarDatePicker` / the time picker
  primitive, not a new native dependency.
