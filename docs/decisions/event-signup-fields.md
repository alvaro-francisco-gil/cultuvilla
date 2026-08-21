# Event sign-up fields — per-attendee answers in the organizer-only private doc

## Context

An event's sign-up form used to be fixed. The one creator-controllable knob was
`telephoneRequired: boolean` — flip it on and the sheet showed a phone field,
stored not on the public registration doc but in a gated subcollection
`events/{eventId}/registrationContacts/{regId}`, readable only by the event's
organizers. Organizers wanted the general case: a DNI for a race, a t-shirt size,
a dietary note, a consent checkbox.

The design exploration assumed per-attendee answers would need a new storage
shape. They didn't. `registerToEvent` already wrote **one private doc per
registration** — exactly the granularity custom answers need. Only the UI
collected a single shared phone and fanned it out across registrants. So the
"cleaner long-term but bigger blast radius" end state was a **merge and a
rename**, not a reshape.

## Decision

- **Fields are per-attendee only.** No `scope` enum. The phone stays the lone
  shared per-signup value; a second one has never appeared.
- **`registrationContacts` → `registrationPrivate`**, holding
  `{ name, phone, answers }`. `registrationContacts` becomes a lying name the
  moment it holds a t-shirt size, and pre-release on `0.x` with web-only traffic
  and small beta/prod data is the cheapest this rename will ever be. `EventAttendees`
  already N-reads that doc, so answers arrive in a read we already make.
- **Written only by the Admin SDK** (`registerToEvent`, `addWalkInRegistration`),
  `write: if false` for clients, read by event organizers only — the same gate the
  phone had.
- **`SignupFieldModel.ts` exports the single validator** used by both the client
  form and the Cloud Function, so "required is filled, the value matches the
  declared type, a select value is one of its options" has one implementation.
  The client validates for the error message; the function validates
  **in-transaction**, where `eventData.signupFields` is actually in hand.
- **Field edits are additive-only once `totalCount > 0`**; `id` and `type` are
  frozen. Ids are generated on add and never reused, so relabeling a field does
  not strand the answers already collected under it.
- **Answer keys stay event-local**, deliberately, so a later `personField: 'dni'`
  on the spec can add census prefill without touching stored answers.
- Caps: ≤ 10 fields per event, ≤ 20 options per select.

### Accepted gap — deep field immutability is not rules-enforced

Firestore rules have no loops, so "element *i*'s `id` and `type` are unchanged"
is inexpressible for an arbitrary-length list. Rules enforce the type, the cap,
and **size-monotonicity**; the client form enforces frozen `id`/`type`. This is
proportionate because event update is already organizer-gated: the only actor who
can violate it is the organizer, and the only damage is to the answers on their
own event. No cross-tenant or privacy consequence — not worth escalating
`updateEvent` to a callable.

## Rejected alternatives

- **A `scope` enum (per-signup vs per-attendee fields).** A half-built
  abstraction; phone already covers the one shared-value case.
- **Submitter read-back or editing a submitted answer.** There is no
  edit-registration flow to hang it off — `registrationService` offers only
  cancellation, and changing an answer is cancel + re-register, identical to
  changing your phone. Read access without an edit path buys nothing and widens
  the PII surface.
- **Census-linked fields** (DNI on the persona, prefilled across events). Needs
  `PersonDataModel` changes and a dependent-privacy rule.
- **A nested modal for the select type.** `Modal`-in-`Modal` is a known RN-Web
  hazard and the sign-up sheet is already a `Modal`; selectable chips instead.

## What this binds

- Anything reading a registration's phone or answers goes through
  `getRegistrationPrivate` — `getRegistrationPhone` and
  `eventRegistrationContactDoc` no longer exist.
- A new field type means extending `SignupFieldModel`'s validator, not adding a
  second check at a call site.
- The private doc is written whenever there is a phone **or** any answer — no
  longer only `if (registrant.phone)`.

## Revisit when

- A genuine second shared-per-signup value appears → reconsider the `scope` enum
  that was rejected here.
- An edit-registration flow is built → submitter read-back becomes cheap and the
  Q2 reasoning above no longer holds.
- Organizers ask to get answers out in bulk → CSV export from the attendee list
  (v1 displays only).
