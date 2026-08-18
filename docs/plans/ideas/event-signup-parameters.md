# Event Signup Parameters — Idea Exploration

> **Status:** Pre-spec exploration. Not yet a formal design. Use as reference before writing the full spec / promoting to `ready/`.

---

## Goal

Let an event creator define **custom sign-up fields** on their event, so that each person a user signs up must supply the answers the organizer needs (e.g. a **DNI/ID number** for a race, a t-shirt size, a dietary note, a consent checkbox).

## Context

Today an event's sign-up form is fixed. The only creator-controllable knob is `telephoneRequired: boolean` on the event: flip it on and the sign-up sheet shows a phone field. That phone is stored **not** on the public registration doc but in a separate organizer-only subcollection `events/{eventId}/registrationContacts/{regId}`, locked down in the rules so only organizers can read it.

That single hardcoded toggle is exactly the shape we want to generalize: **a creator-defined list of typed fields**, each collected at sign-up and stored where only the organizer can read it.

### Decisions already taken (see AskUserQuestion in the exploration session)

- **Field types:** a small typed set — `text`, `number`, `date`, `select` (single choice), `checkbox` (yes/no). Not text-only; not the rich set (no file upload / regex / multi-select in v1).
- **Answer storage:** **organizer-only, always.** All answers go to a gated subcollection mirroring `registrationContacts` — readable only by event organizers and the person who submitted them. No custom answers on the public registration doc. This is the safe default given DNI-class PII.
- **Deliverable:** this plan doc first, before any code.

---

## The one hard part: per-attendee answers

Today's phone field is a **single shared value** for the whole sign-up (one phone, regardless of how many personas you tick). A DNI is **per person** — signing up myself plus two kids for a race means three DNIs.

So the sign-up UI must change shape: from "one field for the sign-up" to "**these fields, once per ticked persona**." This is the main new interaction and the biggest UI change.

We may still want a notion of field **scope** (`per-attendee` vs `per-signup`) so an organizer can ask a single shared question (e.g. "contact phone for the group") without repeating it per persona — but v1 can ship per-attendee only and treat the existing phone toggle as the lone per-signup field. Flagged as an open question below.

---

## "Close to the census" — two flavors of field

The request mentioned the fields being "close to the census." Personas (`persons/{personId}`) already hold census-like identity — names, `birthday`, `birthPlace`, `municipalityLinks` — but **no DNI** today. So there are two flavors hiding here:

1. **Event-scoped answer** *(v1)* — asked fresh at sign-up, stored per registration. Self-contained, no person-model change. This is what we build first.
2. **Census-linked field** *(later)* — the field reads/writes the persona's permanent record so the answer is remembered across events (fill your DNI once, auto-prefill next race). Bigger: touches `PersonDataModel`, privacy rules for dependents, and a prefill path in the sheet.

**Recommendation:** ship event-scoped answers in v1; treat census-linking as a follow-up. Persona prefill can be layered on later without changing the event-config or storage shape.

---

## Design

### 1. Event config — `signupFields` on the event

New field on `EventData` (`packages/shared/src/models/event/EventDataModel.ts`), added to the schema, `EventDataInput`, and `buildEventData`, with `.default([])` so legacy/pre-field docs parse through the strict converter.

```ts
export const SignupFieldTypeSchema = z.enum(['text', 'number', 'date', 'select', 'checkbox']);

export const SignupFieldSpecSchema = z.object({
  // Stable key used as the answer map key. Generated on add, never reused,
  // so renaming a label doesn't strand existing answers.
  id: z.string(),
  label: z.string(),
  type: SignupFieldTypeSchema,
  required: z.boolean(),
  // Only meaningful for type 'select'. Non-empty when type === 'select'.
  options: z.array(z.string()).default([]),
  // v1: every custom field is per-attendee. Reserved for a later per-signup scope.
  // scope: z.enum(['per-attendee', 'per-signup']).default('per-attendee'),
});
export type SignupFieldSpec = z.infer<typeof SignupFieldSpecSchema>;

// in EventDataSchema:
signupFields: z.array(SignupFieldSpecSchema).default([]),
```

Keep a small cap (e.g. ≤ 10 fields, ≤ 20 options per select) enforced in the form and re-checked in rules/function.

### 2. Answers — organizer-only subcollection

Mirror `registrationContacts`. New subcollection keyed by registration id:

```
events/{eventId}/registrationAnswers/{regId}
  { answers: { [fieldId: string]: string | number | boolean }, name: string }
```

- Written **only** by the `registerToEvent` Cloud Function (and the walk-in callable), never by clients — same as `registrationContacts`.
- Rules: read by event organizers **and** the submitting user (`resource`-based); `write: if false`. (registrationContacts is organizer-only read; we likely want the submitter to read their own answers back for the "edit my sign-up" case — open question.)
- Storing `date` as an ISO string and `number`/`checkbox` natively keeps the map simple and converter-friendly.

> Alternative considered: fold answers into the existing `registrationContacts` doc (rename it `registrationPrivate` or similar) so phone + custom answers share one gated doc per registration. Cleaner long-term (one private doc per registrant), but a bigger blast radius on the existing phone path. Lean toward a **new sibling subcollection** in v1 to keep the phone flow untouched; consider merging later. Open question.

### 3. Firestore rules

- `isValidEventCreate` (`firestore.rules` ~line 344): add `signupFields` to **both** the `hasOnly` and `hasAll` key lists and a type check (`d.signupFields is list`, size cap). Without this, event creates that include the field are rejected.
- New `match /events/{eventId}/registrationAnswers/{regId}`: organizer-or-owner read, `write: if false`. Model it on the `registrationContacts` block (~line 727).

### 4. Server: validate + persist (`functions/`)

- `helpers/registerToEventValidation.ts`: extend `RegistrantInput` with `answers?: Record<string, unknown>`. Validate each answer against the event's `signupFields` — **but the event isn't loaded in the validator today** (it only shapes the raw input). So the *shape* check (keys are strings, values are primitives, ≤ N) lives in the validator; the *semantic* check (required fields present, value matches declared type, select value ∈ options) must happen inside `registerToEvent.ts` where `eventData.signupFields` is in hand (inside the transaction, after the event read).
- `registerToEvent.ts`: after building each registration, write the answers doc alongside the phone-contact write (the `if (registrant.phone)` block at lines 96–101 is the exact template). Reject with `HttpsError('invalid-argument', …)` when a required field is missing or a value is ill-typed.
- `addWalkInRegistration.ts`: same answer-collection path for organizer-entered walk-ins (organizer fills the fields on the attendee's behalf).

### 5. Create/edit UI — the "details" step

`apps/mobile/app/event/new.tsx`, step `stepDetails` (~lines 443–488) already hosts the `telephoneRequired` / `requiresPayment` toggles — the two existing sign-up-affecting controls. Add a **custom-fields editor** here: a repeatable list of rows (label, type picker, required toggle, and an options editor when type = select), with add/remove/reorder. Thread the resulting `signupFields` array into the `createEvent` / `updateEvent` payloads (~lines 240–280). Raw `useState` per house style (no form lib).

### 6. Sign-up UI — per-attendee inputs

`apps/mobile/components/feature/AttendeeSheet.tsx` is the actual form (persona checkboxes + conditional `PhoneField`). For each **ticked** persona, render the event's `signupFields` beneath that persona's row (text/number → `Input`, date → `DateTimeField`, select → a picker, checkbox → `Toggle`). Collect answers per personId; block confirm until all `required` fields for every ticked persona are filled. Thread answers out through `RegisterFab.tsx` → `registrationService.RegisterInput` (extend with `answers`) → the callable.

The current single-shared-phone shape doesn't fit per-attendee answers — expect a real layout change in the sheet.

### 7. Service layer

`packages/shared/src/services/registrationService.ts`: extend `RegisterInput` with `answers?: Record<string, string | number | boolean>`; pass through to the callable. Add an organizer read helper `getRegistrationAnswers(eventId, regId)` (mirrors `getRegistrationPhone`) for the attendee-management screen.

### 8. i18n

New strings under `event.register.*` (attendee-facing field prompts/validation) and `event.*` (creator-facing field-editor labels: "Add field", type names, "Required", "Options") in `packages/i18n/messages/es.json`. Follow the `i18n-add-string` skill.

### 9. Dev backfill

Adding `signupFields` with `.default([])` in the schema tolerates legacy reads, but per AGENTS.md ("Backfill dev when a schema field is added") we still backfill existing `villa-events` events to `signupFields: []` so the stored data is conformant, then verify with `pnpm check:dev-conformance`. One-off idempotent `scripts/backfill-event-signup-fields.mjs`, mirroring `scripts/backfill-municipality-namelower.mjs`. Note it in the CHANGELOG with a `**Migration:**` marker.

---

## Touch list (for when this reaches `ready/`)

| Layer | File | Change |
|---|---|---|
| Model | `packages/shared/src/models/event/EventDataModel.ts` | `SignupFieldSpec` schema + `signupFields` on event + builder |
| Model | `packages/shared/src/models/event/RegistrationDataModel.ts` | (no change — answers live in subcollection) |
| Refs | `packages/shared/src/firebase/refs/*` | `eventRegistrationAnswersDoc` ref (client + admin) |
| Service | `packages/shared/src/services/registrationService.ts` | `RegisterInput.answers`, `getRegistrationAnswers` |
| Rules | `firestore.rules` | `signupFields` in `isValidEventCreate`; new `registrationAnswers` match block |
| Function | `functions/src/events/registerToEvent.ts` | validate + persist answers |
| Function | `functions/src/helpers/registerToEventValidation.ts` | answer shape validation, `RegistrantInput.answers` |
| Function | `functions/src/events/addWalkInRegistration.ts` | walk-in answer path |
| UI (create) | `apps/mobile/app/event/new.tsx` | custom-fields editor in `stepDetails` |
| UI (signup) | `apps/mobile/components/feature/AttendeeSheet.tsx` | per-attendee field inputs |
| UI (signup) | `apps/mobile/components/feature/RegisterFab.tsx` | thread `answers` through |
| i18n | `packages/i18n/messages/es.json` | `event.*` + `event.register.*` strings |
| Backfill | `scripts/backfill-event-signup-fields.mjs` | dev events → `signupFields: []` |
| Docs | `_services-map.md`, `CHANGELOG.md` | new subcollection + migration marker |
| Tests | shared vitest + rules e2e + functions | field validation, rules gating, register-with-answers |

---

## Open questions (for full spec)

1. **Per-signup scope:** ship per-attendee only in v1, or introduce the `scope: 'per-attendee' | 'per-signup'` distinction now so shared questions (group contact) don't repeat per persona? (Recommendation: per-attendee only in v1; leave the field out rather than half-build it.)
2. **Submitter read-back:** can the user who signed up read their own answers (to review/edit), or organizer-only like `registrationContacts`? Editing a sign-up's answers after the fact is a whole sub-flow — is it in scope?
3. **Merge vs. sibling subcollection:** new `registrationAnswers` next to `registrationContacts`, or unify both private-per-registrant blobs into one doc? (Recommendation: sibling in v1, unify later.)
4. **Editing fields after registrations exist:** what happens to already-collected answers if a creator edits/removes a field on an event that already has sign-ups? Freeze the field list once the first registration lands? Allow additive-only edits? Needs a rule.
5. **Census-linking / persona prefill:** confirmed out of scope for v1 — but worth sketching the eventual DNI-on-persona shape so v1's answer keys don't paint us into a corner.
6. **Attendee-management display:** the organizer's attendee list (`EventAttendees.tsx`) presumably needs to surface answers (e.g. export DNIs for a race roster). In scope for v1, or read-only via the new service helper for now?
7. **Field-type breadth:** confirmed `text | number | date | select | checkbox`. Do we need per-field placeholder/help text, or is `label` enough for v1?
