# Censo Form Builder

## Goal

Replace the bare key+label censo editor with a Google-Forms-style question builder for organizers, and render type-appropriate widgets in the member-facing form, so a village's censo can mix free text, paragraphs, single/multiple choice, numbers, yes/no, dates, and "pick a village element" (barrio / place / peña) questions.

## Context

The censo backend is already fully capable but the UI is not. The data model
([packages/shared/src/models/municipality/CensoTypes.ts](../../../packages/shared/src/models/municipality/CensoTypes.ts))
already supports field types `text`, `textarea`, `select`, `multiselect`, `boolean`,
`number`, `date`, plus `options[]`, a `required` flag, and a predefined-field registry
([profileFieldRegistry.ts](../../../packages/shared/src/models/municipality/profileFieldRegistry.ts)).
The [updateCenso Cloud Function](../../../functions/src/census/updateCenso.ts) validates every
schema transition server-side (duplicate keys, type changes, removing options members already
chose, removing answered fields, etc.).

Two UI components squander all of this:

- [CensoSchemaEditor.tsx](../../../apps/mobile/components/feature/CensoSchemaEditor.tsx) only adds a
  bare `text` custom field with a manually typed key + label. No type picker, no options editor,
  no required toggle, no predefined quick-add, no reordering.
- [CensoForm.tsx](../../../apps/mobile/components/feature/CensoForm.tsx) renders **every** field as a
  plain text `Input` regardless of type — so a multiple-choice question is a useless text box.

The only genuinely new capability the user asked for that the backend can't yet express is a
question whose choices come from **village entities** (barrios, places, peñas). Today only the
predefined `barrio` field hints at this via an `optionsFromBarrios` flag; we generalize it.

## Design / approach

### Scope decisions (resolved)

- Build **both halves**: the organizer builder AND the type-aware member form.
- Field types in v1: short text, paragraph (textarea), single choice (select), multiple choice
  (multiselect), number, yes/no (boolean), date, **and** "village element" (entity-backed choice).
- Offer a **quick-add list** of predefined registry fields alongside custom questions.
- Entity-backed questions point at **barrios, places, or organizations** (organizer picks the
  source per question), store the chosen entity **ID(s)**, and resolve names **live** at render.

### Backend extension — entity-backed choices

`CustomProfileFormField` in [CensoTypes.ts](../../../packages/shared/src/models/municipality/CensoTypes.ts)
gains one optional field:

```ts
optionsSource: z.enum(['barrios', 'places', 'organizations']).optional()
```

Rules (enforced in all three validation sites — see below):

- `optionsSource` is valid **only** on `select` / `multiselect`.
- A choice field must have **either** a non-empty static `options[]` **or** an `optionsSource` —
  never neither, never both.
- When `optionsSource` is set, the stored answer is the entity **ID** (`select`) or **IDs**
  (`multiselect`). Both `string` and `string[]` are already permitted by `ProfileAnswerValue`, so
  no answer-schema change is needed.
- The member form resolves IDs → current names at render time. Renames/additions appear
  automatically; a deleted entity renders as a muted "(eliminado)" rather than crashing, and is
  still a valid stored answer.
- The "option removed with answers" transition rule applies only to **static** options. Dynamic
  (`optionsSource`) fields skip it — the option set isn't owned by the schema.

Three validation sites must stay in agreement:

1. The Zod shape in [CensoTypes.ts](../../../packages/shared/src/models/municipality/CensoTypes.ts)
   — add `optionsSource`; add a `.refine` (or equivalent) for the either/or-options rule on choice
   fields.
2. The shared pure `validateSchemaTransition` in
   [censoService.ts](../../../packages/shared/src/services/censoService.ts) — accept `optionsSource`;
   skip option-removal checks for dynamic-source fields.
3. The function-side `ensureValidFieldShape` / `validateTransition` in
   `functions/src/helpers/profileFormValidation.ts` — mirror the same rules so the server stays the
   source of truth.

The `updateCenso` function body itself needs no change beyond what the shared validator changes
imply — it already round-trips `fields` verbatim.

### Organizer builder UI

`CensoSchemaEditor` is rewritten as a card list. To keep files focused, split under a new
`apps/mobile/components/feature/censo/` folder:

- **`CensoSchemaEditor.tsx`** — orchestrator. Loads schema + locked keys (via existing
  `getMunicipality` + `getVillageMembers` + `collectUsedValues`), loads village entities for source
  pickers, renders the card list and the add/save controls. Calls `updateCensoSchema` on save.
- **`QuestionCard.tsx`** — one question: editable label, type selector, required toggle, delete
  (disabled when the field is locked / in use), reorder up/down.
- **`QuestionTypePicker.tsx`** — choose a type when adding a question (the eight v1 types).
- **`OptionsEditor.tsx`** — add / remove / reorder static choices for select/multiselect.
- **`EntitySourcePicker.tsx`** — for a "village element" question, pick barrios / places / peñas.
- **`useCensoEditor.ts`** — a hook owning the field-array reducer (add, remove, edit label, change
  type, set required, reorder, edit options, set source) plus dirty/locked state. UI-free and
  unit-testable.

UX details:

- The field **key** is auto-generated from the label via the existing `slugifyFieldKey`; organizers
  never type or see a key. Collisions get a numeric suffix.
- A **"Añadir campo predefinido"** section lists registry fields
  (`listPredefinedFields()`) not already present, as one-tap adds. The predefined `barrio` field's
  `optionsFromBarrios` continues to resolve to the barrios source.
- Locked fields (already answered by members) keep delete and type/source changes disabled, matching
  the backend transition rules. Label and `required` edits remain allowed.
- Reorder is via up/down buttons (drag-to-reorder is out of scope).

### Member form — type-aware widgets

`CensoForm` is rewritten to dispatch per field type through a `CensoFieldInput` component:

| Type | Widget |
|---|---|
| text | single-line `Input` |
| textarea | multiline `Input` |
| number | numeric `Input` |
| date | existing `DateField` primitive |
| boolean | new `Toggle` primitive |
| select | single-choice chip/radio `ChoiceList` |
| multiselect | multi-choice chip/checkbox `ChoiceList` |
| select / multiselect + `optionsSource` | same `ChoiceList`, options resolved live from the village's barrios / places / organizations |

- New shared widgets `ChoiceList` and `Toggle`. `Toggle` is a `primitives/` addition (genuinely
  reusable); `ChoiceList` lives under `feature/censo/`.
- Entity resolution: `CensoAnswers` (or a small hook) fetches the relevant entity lists once and
  passes an id→name map down, so each entity-backed question renders names without per-field fetches.
- The existing required-field warning, save flow (`saveProfileAnswers`), and completion logic
  (`isCensoComplete`) are preserved unchanged.

### i18n

New user-facing strings under the existing `censo.*` namespace in
[packages/i18n/messages/es.json](../../../packages/i18n/messages/es.json): type labels, "add
question", "add option", "add predefined field", entity-source names (barrios / lugares / peñas),
"(eliminado)" for deleted entity answers, and any builder controls. Added via the
`i18n-add-string` conventions. No hardcoded Spanish in these user-facing components.

### Testing

- **vitest (`packages/shared`):** extend `validateSchemaTransition` tests for `optionsSource`
  (valid select/multiselect, both-set rejected, neither-set rejected, dynamic-source skips
  option-removal, source invalid on non-choice types). Add `useCensoEditor` reducer tests (add /
  remove / reorder / change type clears incompatible config / label→key slug + collision suffix).
- **functions vitest emulator harness:** `updateCenso` accepts `optionsSource` fields and still
  rejects illegal transitions (type change on locked field, removing answered static option).
- `pnpm check` green before commit.

## Out of scope (v1)

- Conditional / branching logic between questions.
- Per-question description / help text.
- Drag-to-reorder (up/down buttons only).
- File / image answers.
- Response analytics or per-village reporting.
- Migrating existing answer data (no production censo schemas of consequence exist yet in dev).

## Open questions

None — all resolved during brainstorming.
