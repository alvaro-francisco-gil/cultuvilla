# Event Signup Parameters — Custom Sign-up Fields

## Status

- **Updated:** 2026-08-18
- **Stage:** implementation complete on the branch; awaiting PR review + merge
- **Branch:** `feat/event-signup-fields` (worktree `.claude/worktrees/event-signup-fields`)
- **Done:** all six stages — model + validator, refs/rules, functions, service,
  UI (editor, per-attendee sheet, organizer roster), backfills, docs. Shared
  vitest, rules e2e (330), functions (202) and mobile jest all green; dev
  backfilled and `check:dev-conformance` PASS.
- **Next:** open the PR, then run `registration-contacts-drop` per env **after**
  each deploy lands.
- **Blockers:** none.
- **Handoff:** the post-deploy drop is deliberately *not* run anywhere yet,
  including dev — the currently-deployed function still writes
  `registrationContacts`, so deleting before the deploy would lose phones
  collected in between. Run it once the new functions are live in that env.
  Rules cannot express per-entry field immutability (no loops); see Design §4
  for why the client-side half is proportionate, and flag it in review.

## Rollout status

| Step | Dev | Beta | Prod |
|---|---|---|---|
| Code deployed | ⬜ | ⬜ | ⬜ |
| `event-signup-fields` (pre-deploy) | ✅ | ⬜ | ⬜ |
| `registration-private-merge` (pre-deploy) | ✅ | ⬜ | ⬜ |
| `registration-contacts-drop` (post-deploy) | ⬜ | ⬜ | ⬜ |

Legend: ⬜ pending · ⏳ in progress · ✅ done · ⚠️ blocked (note inline)

---

## Goal

Let an event creator define **custom sign-up fields** on their event, so each
person signed up supplies the answers the organizer needs (DNI for a race, a
t-shirt size, a dietary note, a consent checkbox).

## Context

Today an event's sign-up form is fixed. The only creator-controllable knob is
`telephoneRequired: boolean`: flip it on and the sheet shows one phone field.
That phone is stored **not** on the public registration doc but in a gated
subcollection `events/{eventId}/registrationContacts/{regId}`, readable only by
event organizers.

That toggle is exactly the shape we generalize: **a creator-defined list of
typed fields**, collected at sign-up, stored where only the organizer reads it.

### The premise the idea doc got wrong

The exploration assumed the phone was a per-signup value and that per-attendee
answers would need a new storage shape. **It doesn't.**
`functions/src/events/registerToEvent.ts` writes
`eventRegistrationContactDoc(db, eventId, newRef.id)` — one private doc per
*registration*, already the exact granularity custom answers need. Only the UI
(`AttendeeSheet.tsx`) collects a single shared phone and fans it out across
registrants.

So the private-doc-per-registrant end state the idea doc called "cleaner
long-term but a bigger blast radius" is in fact a **merge and a rename**, not a
reshape. We take it.

---

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Field scope | **Per-attendee only.** No `scope` enum. Phone stays the lone shared per-signup field. |
| 2 | Submitter read-back | **Organizer-only**, mirroring the phone exactly. No edit-registration flow. |
| 3 | Answer storage | **One private doc per registrant**, `registrationContacts` merged and renamed to `registrationPrivate`. |
| 4 | Editing fields after signups | **Additive-only** once `totalCount > 0`. `id` and `type` frozen. |
| 5 | Census-linking (persona prefill) | Out of scope. Keys stay event-local so a later `personField` can layer on. |
| 6 | Organizer display | **Read-only display in v1** — free with the merge. Export later. |
| 7 | Placeholder / help text | `label` only. |

**Q2 rationale:** there is no edit-registration flow to hang read-back off —
`registrationService.ts` offers only `cancelRegistration`. Changing an answer is
cancel + re-register, identical to changing your phone today. Granting read
access without an edit path buys nothing and widens the PII surface.

**Q3 rationale:** `registrationContacts` becomes a lying name the moment it
holds a t-shirt size. Renaming costs a real collection migration, worth paying
now: pre-release on `0.x`, web-only, small beta/prod data. This is the cheapest
this rename will ever be. `EventAttendees` already N-reads that doc, so answers
arrive in a read we already make — no second fan-out.

---

## Design

### 1. Field spec model

New `packages/shared/src/models/event/SignupFieldModel.ts`:

```ts
export const SignupFieldTypeSchema = z.enum(['text', 'number', 'date', 'select', 'checkbox']);

export const SignupFieldSpecSchema = z.object({
  // Stable key, generated on add and never reused, so relabeling a field
  // doesn't strand the answers already collected under it.
  id: z.string(),
  label: z.string(),
  type: SignupFieldTypeSchema,
  required: z.boolean(),
  // Only meaningful for type 'select'; non-empty when type === 'select'.
  options: z.array(z.string()).default([]),
});

export const SignupAnswerValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export const SignupAnswersSchema = z.record(z.string(), SignupAnswerValueSchema);
```

`date` answers are stored as ISO date strings; `number` and `checkbox` store
natively. Caps: **≤ 10 fields per event, ≤ 20 options per select**.

The same file exports the **pure validator both the client form and the Cloud
Function call**, so "required is filled, the value matches the declared type, a
select value is one of its options" has exactly one implementation:

```ts
export function validateSignupAnswers(
  fields: SignupFieldSpec[],
  answers: Record<string, unknown>,
): { ok: true; value: SignupAnswers } | { ok: false; fieldId: string; reason: SignupAnswerError };
```

### 2. Event config

`signupFields: z.array(SignupFieldSpecSchema).default([])` on `EventDataSchema`,
plus `EventDataInput` and `buildEventData`. `.default([])` matches the
`requiresPayment` / `endDate` precedent so pre-field docs parse; existing dev
docs are backfilled in the same change regardless (AGENTS.md).

### 3. Storage — `registrationPrivate`

```
events/{eventId}/registrationPrivate/{regId}
  {
    name: string,
    phone: string | null,
    answers: { [fieldId]: string | number | boolean },
  }
```

Replaces `registrationContacts` wholesale. Written **only** by `registerToEvent`
and `addWalkInRegistration` (admin SDK); `write: if false` for clients. Read by
event organizers only — the same gate the phone has today.

The doc is now written whenever there is a phone **or** any answer, where today
it is written only `if (registrant.phone)`.

### 4. Firestore rules

- `isValidEventCreate`: add `signupFields` to both the `hasOnly` and `hasAll`
  lists, plus `d.signupFields is list && d.signupFields.size() <= 10`.
- Event `allow update`: when the event already has signups, the field list may
  only grow —
  `resource.data.totalCount == 0 || request.resource.data.signupFields.size() >= resource.data.get('signupFields', []).size()`
  (`.get()` with a default covers legacy docs mid-migration).
- Rename the `registrationContacts` match block to `registrationPrivate`,
  unchanged otherwise: `allow read: if isEventOrganizer(eventId); allow write: if false;`

**Accepted gap — deep field immutability is not rules-enforced.** Rules have no
loops, so "element *i*'s `id` and `type` are unchanged" is inexpressible for an
arbitrary-length list. Rules enforce the type, the cap, and size-monotonicity;
the client form enforces frozen `id`/`type`. The threat model makes this
proportionate: event update is already organizer-gated, so the only actor who
can violate it is the organizer, and the only damage is to the answers on their
own event. No cross-tenant or privacy consequence. Flagged in the PR per
AGENTS.md rather than escalating `updateEvent` to a callable.

### 5. Server

- `helpers/registerToEventValidation.ts`: `RegistrantInput.answers?: Record<string, unknown>`;
  validate only the *shape* here (object, primitive values, ≤ 10 keys) — the
  event isn't loaded in this helper.
- `events/registerToEvent.ts`: the *semantic* check runs inside the transaction
  where `eventData.signupFields` is in hand. Run `validateSignupAnswers` per
  registrant; on failure throw `HttpsError('invalid-argument', …)`. Write the
  private doc when `phone || answers`.
- `events/addWalkInRegistration.ts`: same path — the organizer fills the fields
  on the walk-in's behalf.

### 6. Service layer

`registrationService.ts`: `RegisterInput.answers?: SignupAnswers`, threaded to
the callable. `getRegistrationPhone` → **`getRegistrationPrivate(eventId, regId)`**
returning `{ phone, answers } | null`; `EventAttendees` gets both from the one
read it already performs.

### 7. Create/edit UI

`apps/mobile/app/event/new.tsx` handles both create and edit. A new
`SignupFieldsEditor` component lands in `stepDetails` beside the
`telephoneRequired` / `requiresPayment` toggles: an add/remove/reorder list of
rows (label, type, required toggle, options editor when `select`). Raw
`useState` per house style. In edit mode with `totalCount > 0`, existing rows
lock `type` and disable removal, matching the rules gate.

### 8. Sign-up UI

`AttendeeSheet.tsx` gains a per-persona field group rendered beneath each
**ticked** row: `text`/`number` → `Input`, `date` → `DateField`, `select` →
selectable chips, `checkbox` → `Checkbox`. Answers are held as
`Record<personId, Record<fieldId, value>>`; confirm is blocked until every
required field on every ticked persona validates, surfacing errors on the same
`confirmAttempted` pattern the phone already uses. `RegisterFab.applyDiff`
threads `answers` per registrant into `registerToEvent`.

Selectable chips rather than a nested modal: `Modal`-in-`Modal` is a known
RN-Web hazard (`mobile-web-compat`), and the sheet is already a `Modal`.

### 9. Migration

Three registered backfills. The subcollection rename is split across the deploy
because the *currently deployed* function keeps writing `registrationContacts`
until the new code lands:

| id | phase | what |
|---|---|---|
| `event-signup-fields` | `pre-deploy` | events missing `signupFields` → `[]` |
| `registration-private-merge` | `pre-deploy` | copy each `registrationContacts/{regId}` → `registrationPrivate/{regId}` with `answers: {}`, `phone` normalized to `string \| null` |
| `registration-contacts-drop` | `post-deploy` | re-copy stragglers written during the deploy window, then delete `registrationContacts` |

All idempotent. `autoApply: []` — the rename is not the kind of thing that
should run unattended.

### 10. i18n

`event.signupFields.*` (creator: add field, type names, required, options, the
locked-after-signups notice) and `event.register.*` (attendee: required-field
and invalid-value errors) in `packages/i18n/messages/es.json`.

---

## File Structure

**Create**

- `packages/shared/src/models/event/SignupFieldModel.ts`
- `packages/shared/test/models/signupField.test.ts`
- `apps/mobile/components/feature/SignupFieldsEditor.tsx`
- `apps/mobile/components/feature/SignupAnswerFields.tsx`
- `apps/mobile/components/feature/__tests__/SignupFieldsEditor.test.tsx`
- `scripts/backfill-event-signup-fields.mjs`
- `scripts/backfill-registration-private-merge.mjs`
- `scripts/backfill-registration-contacts-drop.mjs`

**Modify**

- `packages/shared/src/models/event/EventDataModel.ts` — `signupFields` + builder
- `packages/shared/src/models/event/index.ts` — re-export
- `packages/shared/src/firebase/refs/client.ts` / `admin.ts` — `eventRegistrationPrivateDoc`
- `packages/shared/src/services/registrationService.ts` — `answers`, `getRegistrationPrivate`
- `packages/shared/src/services/_services-map.md`
- `functions/src/helpers/registerToEventValidation.ts`
- `functions/src/events/registerToEvent.ts`
- `functions/src/events/addWalkInRegistration.ts`
- `firestore.rules`
- `apps/mobile/app/event/new.tsx`
- `apps/mobile/components/feature/AttendeeSheet.tsx`
- `apps/mobile/components/feature/RegisterFab.tsx`
- `apps/mobile/components/feature/EventAttendees.tsx`
- `packages/i18n/messages/es.json`
- `CHANGELOG.md` — entry + `**Migration:**` marker

**Delete**

- `eventRegistrationContactDoc` (both ref files), `getRegistrationPhone`, and the
  `registrationContacts` rules block — replaced, not deprecated.

---

## Tasks

### Stage 1 — Model + validator (pure, fully testable)

- [x] `SignupFieldModel.ts`: spec/answer schemas, caps, `validateSignupAnswers`
- [x] `signupFields` on `EventDataSchema` / `EventDataInput` / `buildEventData`
- [x] vitest: schema round-trip, required missing, type mismatch, select not in options, cap enforcement, `buildEventData` defaults `[]`

### Stage 2 — Storage + rules

- [x] `eventRegistrationPrivateDoc` refs (client + admin); delete the contact refs
- [x] `firestore.rules`: `signupFields` in create validation, size-monotonic update gate, `registrationPrivate` block replacing `registrationContacts`
- [x] rules e2e: organizer reads / stranger denied / client write denied; create with `signupFields`; shrink-after-signup denied, grow allowed

### Stage 3 — Functions

- [x] `RegistrantInput.answers` shape validation
- [x] `registerToEvent`: semantic validation in-transaction, private-doc write on `phone || answers`
- [x] `addWalkInRegistration`: same path
- [x] functions tests: answers persisted, missing required rejected, walk-in with answers

### Stage 4 — Service

- [x] `RegisterInput.answers`; `getRegistrationPrivate` replacing `getRegistrationPhone`
- [x] update `_services-map.md`

### Stage 5 — UI

- [x] `SignupFieldsEditor` + wire into `new.tsx` `stepDetails` and both payloads
- [x] `SignupAnswerFields` + per-persona rendering in `AttendeeSheet`, required-gating on confirm
- [x] `RegisterFab`: thread `answers` per registrant
- [x] `EventAttendees`: read-only answer display from the merged doc
- [x] i18n strings
- [x] jest: editor add/remove/lock, sheet blocks confirm on missing required

### Stage 6 — Migration + docs

- [x] the three backfill scripts, registered on the harness
- [x] run the two pre-deploy backfills against dev; `pnpm check:dev-conformance` before and after (the post-deploy drop waits for the deploy — see Status)
- [x] CHANGELOG entry with `**Migration:**` marker
- [x] PR flags the rules-level immutability gap (Design §4)

---

## Out of scope

- **Per-signup field scope.** Rejected as a half-built abstraction; phone
  already covers the one shared-value case. Revisit when a real second one appears.
- **Submitter read-back / editing a submitted answer.** Needs an
  edit-registration flow that doesn't exist. Cancel + re-register is the path.
- **Census-linked fields (DNI on the persona, prefill across events).** Needs
  `PersonDataModel` changes and a dependent-privacy rule. Answer keys stay
  event-local field ids so a later `personField: 'dni'` on the spec adds prefill
  without touching stored answers.
- **Answer export (CSV) from the attendee list.** v1 displays; export follows.
- **File upload, regex validation, multi-select, per-field help text.**
