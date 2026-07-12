# Event payment flag + per-attendee paid register

## Problem

Some events collect money (a peña dinner, a paid workshop). The organizer needs
a lightweight way to (a) mark an event as one where payment is collected, and
(b) keep a register of which attendees have paid — a simple checkbox per person,
"just to have a record". No amounts, no online payment, no reconciliation.

## Approach

Mirror the existing **check-in** feature exactly — it is the same shape:

| Concern            | Check-in (exists)                    | Payment (this spec)                 |
|--------------------|--------------------------------------|-------------------------------------|
| Event flag         | `telephoneRequired: boolean`         | `requiresPayment: boolean`          |
| Registration mark  | `checkedInAt: Date \| null`          | `paidAt: Date \| null`              |
| Service toggle     | `setRegistrationCheckIn(id, id, b)`  | `setRegistrationPaid(id, id, b)`    |
| Organizer UI       | row action in `EventAttendees`       | paid checkbox in `EventAttendees`   |

Storing a **timestamp** (`paidAt`) rather than a bare boolean gives us "when it
was marked paid" for free, consistent with `checkedInAt`.

## Data model changes

### `packages/shared/src/models/event/EventDataModel.ts`
- Add `requiresPayment: z.boolean().default(false)` to `EventDataSchema`.
  The `.default(false)` lets the strict converter parse existing dev event docs
  that predate the field (no read crash).
- Add `requiresPayment` to `EventDataInput` and default it in `buildEventData`.

### `packages/shared/src/models/event/EventFormSchema.ts`
- Add `requiresPayment: z.boolean()` to `EventFormSchema`.

### `packages/shared/src/models/event/RegistrationDataModel.ts`
- Add `paidAt: z.date().nullable().default(null)` to `RegistrationDataSchema`.
- Default it to `null` in `buildRegistrationData`.

### Backfill (dev only, autonomous)
- `scripts/backfill-event-requirespayment.mjs` — idempotent, project-id guarded,
  patches only `events` docs in `villa-events` missing `requiresPayment`,
  setting `false`. Mirrors `scripts/backfill-municipality-namelower.mjs`.
- Registrations get `paidAt` lazily (the `.default(null)` covers reads); no
  registration backfill needed since the field is nullable and read-defaulted.
- Verify with `pnpm check:dev-conformance` before and after.

## Service changes

### `packages/shared/src/services/registrationService.ts`
- Add `setRegistrationPaid(eventId, regId, paid: boolean)` — clone of
  `setRegistrationCheckIn`: `updateDoc` setting `paidAt` to `serverTimestamp()`
  when `paid`, or `null` when clearing.

### `packages/shared/src/services/eventService.ts`
- Thread `requiresPayment` through `createEvent` / `updateEvent` (already generic
  over the form shape — just include the new field where `telephoneRequired` flows).

## Firestore rules — enforce organizer-only paid writes

The current registration `update` rule (`firestore.rules` ~L700) allows the edit
if `resource.data.userId == request.auth.uid` **OR** `isEventOrganizer(eventId)`.
That would let a registrant self-mark `paidAt` via a raw DB write. The user wants
"only organizers can check this box" **enforced**, so:

- Add a field-level guard: any registration `update` whose changed fields include
  `paidAt` must be made by `isEventOrganizer(eventId)` (the self branch is not
  sufficient for that field). Keep the existing self-or-organizer rule for all
  other registration mutations (e.g. self-cancel).
- Concretely: in the `update` rule, require
  `isEventOrganizer(eventId)` when
  `request.resource.data.diff(resource.data).affectedKeys().hasAny(['paidAt'])`.

`requiresPayment` on the event is written only through `createEvent`/`updateEvent`,
already gated by the event `update`/`create` rules and `isValidEventCreate`; add
`requiresPayment` to that shape helper if it enumerates allowed fields.

## UI changes

### `apps/mobile/app/event/new.tsx` (create + edit)
- Add a `requiresPayment` state (default `false`), loaded when editing.
- Render a `Switch` labelled "Se paga en el evento" next to the
  `telephoneRequired` switch (~L461). Pass through to create/update.

### `apps/mobile/components/feature/EventAttendees.tsx`
- When `event.requiresPayment`, each attendee row shows a **paid checkbox**
  reflecting `paidAt != null`, toggling `setRegistrationPaid`. Reuse the check-in
  row action styling. Hidden entirely when `requiresPayment` is false.
- `EventAttendees` already only renders for organizers (`canOrganize` on the
  detail screen), so the checkbox is organizer-only in the UI as well as in rules.

### i18n — `packages/i18n/messages/es.json`
- `event.form.requiresPayment` (switch label, e.g. "Se paga en el evento")
- `event.attendees.paid` (checkbox label / a11y, e.g. "Pagado")

## Tests

- **vitest (`packages/shared/test/`)**: `buildEventData` defaults `requiresPayment`
  to `false`; `buildRegistrationData` defaults `paidAt` to `null`; schemas parse a
  doc missing each field (converter-safe default).
- **rules test (`packages/shared/test/e2e/`)**: an organizer can set `paidAt`; a
  registrant (self, non-organizer) is **denied** writing `paidAt`; a registrant can
  still self-cancel (unaffected).

## Out of scope (YAGNI)

- Amounts / prices / currency. Boolean flag only.
- Online payment, refunds, partial payments.
- Any payment surface for non-organizers (attendees don't see paid state).

## Migration notes (for the PR body)

- New field `events.requiresPayment` (bool, default false) — backfilled in dev via
  `scripts/backfill-event-requirespayment.mjs`.
- New field `events/*/registrations/*.paidAt` (nullable timestamp, default null) —
  read-defaulted, no backfill.
- Firestore rules change: registration `update` now requires organizer for any
  write touching `paidAt`. No client release currently depends on the loose rule,
  so no `minSupported` bump needed.
