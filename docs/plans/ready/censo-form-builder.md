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

## Out of scope (resolved open questions)

All brainstorming questions resolved. Notably: numbers store as JS `number`, dates
store as ISO `YYYY-MM-DD` strings (both already permitted by `ProfileAnswerValue`);
predefined fields keep referencing the registry for their `type`/`options` rather than
duplicating them into the schema.

---

# Censo Form Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give organizers a Google-Forms-style censo builder and render type-aware widgets in the member form, including questions whose choices come from village barrios/places/peñas.

**Architecture:** The backend field model already supports every type; the only backend change is an optional `optionsSource` on custom choice fields (stores entity IDs, resolved live). The rest is mobile UI: a builder split into small components + a pure reducer, and a type-dispatching member form. A shared pure `resolveFieldDisplay` unifies how predefined and custom fields expose `type`/`options`/`label` to both the form and the builder.

**Tech Stack:** TypeScript, Zod, React Native / Expo (apps/mobile), Firebase Cloud Functions, vitest.

## Global Constraints

- `pnpm check` must be green before any commit (lint + typecheck + shared vitest + functions vitest + rules tests + web build smoke).
- No hardcoded user-facing strings in `apps/mobile` — every label goes through `useT()` and the `packages/i18n/messages/es.json` catalog (i18n-add-string conventions). Default locale `es` only.
- Three validation sites must stay in agreement: the Zod schema in `CensoTypes.ts`, the shared pure `validateSchemaTransition` in `censoService.ts`, and the function-side `ensureValidFieldShape` / `validateTransition` in `functions/src/helpers/profileFormValidation.ts`. The server (functions) is the source of truth.
- `optionsSource ∈ {'barrios','places','organizations'}`, valid only on `select`/`multiselect`. A choice field has **exactly one** of: non-empty static `options[]` OR `optionsSource`.
- mobile-web-compat: do not put styles on `className` of any `Animated.*` component; `Alert.alert` is a no-op on web (existing call sites already branch — don't add new web-blocking Alerts for required flows).
- Custom field keys match `/^[a-z0-9_]{1,40}$/`, generated from the label via the existing `slugifyFieldKey`.

---

## File Structure

**Shared (`packages/shared/src/`)**
- Modify `models/municipality/CensoTypes.ts` — add `OptionsSourceSchema`/`OptionsSource`; add optional `optionsSource` to `CustomProfileFormFieldSchema`.
- Modify `services/censoService.ts` — extend `validateSchemaTransition` (either/or-options, optionsSource type rule, skip option-removal for dynamic fields); add new violation codes.
- Create `services/censoFieldResolver.ts` — pure `resolveFieldDisplay(field)` unifying predefined+custom into `{ type, options?, optionsSource?, label, required }`.
- Test: `test/censoService.test.ts` (extend), `test/censoFieldResolver.test.ts` (new).

**Functions (`functions/src/`)**
- Modify `helpers/profileFormValidation.ts` — add `optionsSource` to `CustomField`; update `ensureValidFieldShape` + `validateTransition`.
- Test: `functions/test/profileFormValidation.test.ts` (extend or create).

**Mobile primitives (`apps/mobile/components/primitives/`)**
- Create `Toggle.tsx` + export from `index.ts`.
- Test: `components/primitives/__tests__/Toggle.test.tsx`.

**Mobile censo feature (`apps/mobile/components/feature/censo/`)** — new folder
- Create `ChoiceList.tsx` — single/multi chip selector.
- Create `CensoFieldInput.tsx` — per-type widget dispatcher (member side).
- Create `useEntityOptions.ts` — loads barrios/places/orgs → per-field option maps.
- Create `censoEditorReducer.ts` — pure builder state + actions.
- Create `useCensoEditor.ts` — hook wrapping the reducer + load/save.
- Create `QuestionTypePicker.tsx`, `OptionsEditor.tsx`, `EntitySourcePicker.tsx`, `QuestionCard.tsx`.
- Test: `components/feature/censo/__tests__/censoEditorReducer.test.ts`, `CensoFieldInput.test.tsx`.

**Mobile rewrites**
- Modify `components/feature/CensoForm.tsx` — render via `CensoFieldInput`.
- Modify `components/feature/CensoAnswers.tsx` — wire `useEntityOptions`.
- Modify `components/feature/CensoSchemaEditor.tsx` — rewrite as orchestrator over the new components.

**i18n**
- Modify `packages/i18n/messages/es.json` — `censo.builder.*` and `censo.types.*` namespaces.

---

## Task 1: Shared model — `optionsSource` field

**Files:**
- Modify: `packages/shared/src/models/municipality/CensoTypes.ts`
- Test: `packages/shared/test/censoService.test.ts`

**Interfaces:**
- Produces: `OptionsSourceSchema`, type `OptionsSource = 'barrios' | 'places' | 'organizations'`; `CustomProfileFormField` now has optional `optionsSource?: OptionsSource`.

- [ ] **Step 1: Add the schema.** In `CensoTypes.ts`, above `CustomProfileFormFieldSchema`:

```ts
export const OptionsSourceSchema = z.enum(['barrios', 'places', 'organizations']);
export type OptionsSource = z.infer<typeof OptionsSourceSchema>;
```

Add to `CustomProfileFormFieldSchema` (after `options`):

```ts
  options: z.array(z.string()).optional(),
  optionsSource: OptionsSourceSchema.optional(),
```

- [ ] **Step 2: Typecheck.** Run: `pnpm --filter @cultuvilla/shared build`. Expected: PASS (no consumers break — field is optional).

- [ ] **Step 3: Commit.**

```bash
git add packages/shared/src/models/municipality/CensoTypes.ts
git commit -m "feat(shared): add optionsSource to custom censo fields"
```

---

## Task 2: Shared `validateSchemaTransition` — entity-source rules

**Files:**
- Modify: `packages/shared/src/services/censoService.ts`
- Test: `packages/shared/test/censoService.test.ts`

**Interfaces:**
- Consumes: `OptionsSource` (Task 1).
- Produces: `SchemaTransitionViolation.code` gains `'missing_options' | 'options_source_conflict' | 'options_source_invalid_type'`.

- [ ] **Step 1: Write failing tests.** Append to `packages/shared/test/censoService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateSchemaTransition } from '../src/services/censoService';
import type { ProfileFormField } from '../src/models/municipality/CensoTypes';

const sel = (over: Partial<ProfileFormField> = {}): ProfileFormField => ({
  source: 'custom', key: 'k', label: 'L', type: 'select', options: ['a'], required: false, ...over,
} as ProfileFormField);

describe('validateSchemaTransition optionsSource', () => {
  it('accepts a select backed by optionsSource and no static options', () => {
    const f = sel({ options: undefined, optionsSource: 'barrios' });
    expect(validateSchemaTransition([], [f], {}).ok).toBe(true);
  });
  it('rejects a select with neither options nor optionsSource', () => {
    const f = sel({ options: undefined, optionsSource: undefined });
    const r = validateSchemaTransition([], [f], {});
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.code)).toContain('missing_options');
  });
  it('rejects a select with both options and optionsSource', () => {
    const f = sel({ options: ['a'], optionsSource: 'places' });
    const r = validateSchemaTransition([], [f], {});
    expect(r.violations.map((v) => v.code)).toContain('options_source_conflict');
  });
  it('rejects optionsSource on a non-choice type', () => {
    const f = sel({ type: 'text', options: undefined, optionsSource: 'barrios' });
    const r = validateSchemaTransition([], [f], {});
    expect(r.violations.map((v) => v.code)).toContain('options_source_invalid_type');
  });
  it('skips option-removal checks for dynamic-source fields', () => {
    const prev = sel({ options: undefined, optionsSource: 'barrios' });
    const next = sel({ options: undefined, optionsSource: 'barrios' });
    const used = { k: new Set(['some-deleted-id']) };
    expect(validateSchemaTransition([prev], [next], used).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure.** Run: `pnpm --filter @cultuvilla/shared test -- censoService`. Expected: FAIL (new codes not produced).

- [ ] **Step 3: Implement.** In `censoService.ts`, widen the `code` union with the three new codes. In the first `for (const f of next)` loop, after the existing custom-key check, add:

```ts
    if (f.source === 'custom') {
      const isChoice = f.type === 'select' || f.type === 'multiselect';
      const hasStatic = Array.isArray(f.options) && f.options.length > 0;
      const hasSource = f.optionsSource !== undefined;
      if (f.optionsSource !== undefined && !isChoice) {
        violations.push({ code: 'options_source_invalid_type', fieldKey: f.key });
      }
      if (isChoice) {
        if (hasStatic && hasSource) {
          violations.push({ code: 'options_source_conflict', fieldKey: f.key });
        } else if (!hasStatic && !hasSource) {
          violations.push({ code: 'missing_options', fieldKey: f.key });
        }
      }
    }
```

In the option-removal block (`prevField.source === 'custom' && nextField.source === 'custom'`), guard the option-diff so it only runs for static fields:

```ts
      if (nextField.optionsSource === undefined && prevField.optionsSource === undefined) {
        const prevOpts = new Set(prevField.options ?? []);
        const nextOpts = new Set(nextField.options ?? []);
        const removed = [...prevOpts].filter((o) => !nextOpts.has(o));
        const used = usedValuesByKey[key] ?? new Set();
        for (const r of removed) {
          if (used.has(r)) {
            violations.push({ code: 'option_removed_with_answers', fieldKey: key, detail: r });
          }
        }
      }
```

(`PrevField`-style access: the existing function reads `prevField`/`nextField` as `ProfileFormField`; `optionsSource` is now on the custom variant, so narrow with the existing `source === 'custom'` guard already in scope.)

- [ ] **Step 4: Run, verify pass.** Run: `pnpm --filter @cultuvilla/shared test -- censoService`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add packages/shared/src/services/censoService.ts packages/shared/test/censoService.test.ts
git commit -m "feat(shared): validate optionsSource transitions in censo schema"
```

---

## Task 3: Shared `resolveFieldDisplay` helper

**Files:**
- Create: `packages/shared/src/services/censoFieldResolver.ts`
- Test: `packages/shared/test/censoFieldResolver.test.ts`
- Modify: `packages/shared/src/services/index.ts` (re-export, follow existing pattern)

**Interfaces:**
- Consumes: `ProfileFormField`, `OptionsSource`, `getPredefinedField`.
- Produces:

```ts
export interface ResolvedField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];        // static choices, if any
  optionsSource?: OptionsSource;
  required: boolean;
}
export function resolveFieldDisplay(field: ProfileFormField): ResolvedField;
```

- [ ] **Step 1: Write failing test.** Create `packages/shared/test/censoFieldResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveFieldDisplay } from '../src/services/censoFieldResolver';

describe('resolveFieldDisplay', () => {
  it('resolves a custom field directly', () => {
    const r = resolveFieldDisplay({
      source: 'custom', key: 'pet', label: 'Mascota', type: 'text', required: true,
    });
    expect(r).toMatchObject({ key: 'pet', label: 'Mascota', type: 'text', required: true });
  });
  it('resolves a custom entity-backed select', () => {
    const r = resolveFieldDisplay({
      source: 'custom', key: 'lugar', label: 'Lugar favorito', type: 'select',
      optionsSource: 'places', required: false,
    });
    expect(r.optionsSource).toBe('places');
    expect(r.type).toBe('select');
  });
  it('resolves a predefined field from the registry (barrio -> barrios source)', () => {
    const r = resolveFieldDisplay({ source: 'predefined', key: 'barrio', required: true });
    expect(r.type).toBe('select');
    expect(r.optionsSource).toBe('barrios');
    expect(r.label).toBe('Barrio');
  });
  it('resolves a predefined select with static registry options', () => {
    const r = resolveFieldDisplay({ source: 'predefined', key: 'residencyType', required: false });
    expect(r.type).toBe('select');
    expect(r.options).toEqual(['permanente', 'veraneante', 'visitante']);
  });
  it('predefined label override wins over registry default', () => {
    const r = resolveFieldDisplay({ source: 'predefined', key: 'barrio', label: 'Tu barrio', required: true });
    expect(r.label).toBe('Tu barrio');
  });
});
```

- [ ] **Step 2: Run, verify failure.** Run: `pnpm --filter @cultuvilla/shared test -- censoFieldResolver`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement.** Create `censoFieldResolver.ts`:

```ts
import type { FieldType, OptionsSource, ProfileFormField } from '../models/municipality/CensoTypes';
import { getPredefinedField } from '../models/municipality/profileFieldRegistry';

export interface ResolvedField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  optionsSource?: OptionsSource;
  required: boolean;
}

/**
 * Flattens a predefined-or-custom field into the shape the form/builder render.
 * Predefined fields carry only {source,key,label?,required}; their type/options
 * live in the registry. The barrio field's optionsFromBarrios maps to the
 * 'barrios' dynamic source.
 */
export function resolveFieldDisplay(field: ProfileFormField): ResolvedField {
  if (field.source === 'custom') {
    return {
      key: field.key,
      label: field.label,
      type: field.type,
      options: field.options,
      optionsSource: field.optionsSource,
      required: field.required,
    };
  }
  const def = getPredefinedField(field.key);
  return {
    key: field.key,
    label: field.label ?? def?.defaultLabel ?? field.key,
    type: def?.type ?? 'text',
    options: def?.options,
    optionsSource: def?.optionsFromBarrios ? 'barrios' : undefined,
    required: field.required,
  };
}
```

Add the re-export to `services/index.ts` following the existing style (e.g. `export * from './censoFieldResolver';`).

- [ ] **Step 4: Run, verify pass.** Run: `pnpm --filter @cultuvilla/shared test -- censoFieldResolver`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add packages/shared/src/services/censoFieldResolver.ts packages/shared/test/censoFieldResolver.test.ts packages/shared/src/services/index.ts
git commit -m "feat(shared): resolveFieldDisplay unifies predefined/custom censo fields"
```

---

## Task 4: Functions — `optionsSource` validation parity

**Files:**
- Modify: `functions/src/helpers/profileFormValidation.ts`
- Test: `functions/test/profileFormValidation.test.ts` (create if absent; mirror existing functions vitest setup)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CustomField.optionsSource?: 'barrios' | 'places' | 'organizations'`.

- [ ] **Step 1: Write failing tests.** Create/extend `functions/test/profileFormValidation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ensureValidFieldShape, validateTransition } from '../src/helpers/profileFormValidation';

const base = { source: 'custom' as const, key: 'k', label: 'L', required: false };

describe('ensureValidFieldShape optionsSource', () => {
  it('accepts select with optionsSource and no static options', () => {
    expect(() => ensureValidFieldShape({ ...base, type: 'select', optionsSource: 'barrios' })).not.toThrow();
  });
  it('rejects select with neither options nor optionsSource', () => {
    expect(() => ensureValidFieldShape({ ...base, type: 'select' })).toThrow();
  });
  it('rejects select with both', () => {
    expect(() => ensureValidFieldShape({ ...base, type: 'select', options: ['a'], optionsSource: 'places' })).toThrow();
  });
  it('rejects optionsSource on text', () => {
    expect(() => ensureValidFieldShape({ ...base, type: 'text', optionsSource: 'barrios' })).toThrow();
  });
});

describe('validateTransition dynamic source', () => {
  it('skips option-removal for dynamic fields', () => {
    const prev = [{ source: 'custom' as const, key: 'k', type: 'select' as const, optionsSource: 'barrios' as const }];
    const next = [{ ...base, type: 'select' as const, optionsSource: 'barrios' as const }];
    expect(() => validateTransition(prev, next, { k: new Set(['gone-id']) })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify failure.** Run: `npm --prefix functions test -- profileFormValidation` (or the repo's functions test command, e.g. `pnpm functions:test`). Expected: FAIL.

- [ ] **Step 3: Implement.** In `profileFormValidation.ts`:

Add to `CustomField` and `PrevField`:

```ts
  optionsSource?: 'barrios' | 'places' | 'organizations';
```

Add a constant near `VALID_FIELD_TYPES`:

```ts
const VALID_OPTION_SOURCES = new Set(['barrios', 'places', 'organizations']);
```

Replace the existing select/multiselect options check at the end of `ensureValidFieldShape` with:

```ts
  const isChoice = c.type === 'select' || c.type === 'multiselect';
  const hasStatic = Array.isArray(c.options) && c.options.length > 0;
  const hasSource = c.optionsSource !== undefined;
  if (hasSource && !VALID_OPTION_SOURCES.has(c.optionsSource as string)) {
    throw new HttpsError('invalid-argument', `optionsSource inválido: ${String(c.optionsSource)}`);
  }
  if (hasSource && !isChoice) {
    throw new HttpsError('invalid-argument', `optionsSource solo válido en select/multiselect.`);
  }
  if (isChoice) {
    if (hasStatic && hasSource) {
      throw new HttpsError('invalid-argument', `El campo ${String(c.key)} no puede tener opciones y optionsSource a la vez.`);
    }
    if (!hasStatic && !hasSource) {
      throw new HttpsError('invalid-argument', `El campo ${String(c.key)} requiere opciones.`);
    }
  }
```

In `validateTransition`, guard the option-removal block so it only runs for static fields:

```ts
      if (nextField.optionsSource === undefined && (prevField as CustomField).optionsSource === undefined) {
        const prevOpts = new Set(prevField.options ?? []);
        const nextOpts = new Set(nextField.options ?? []);
        const removed = [...prevOpts].filter((o) => !nextOpts.has(o));
        const usedValues = used[prevField.key] ?? new Set();
        for (const r of removed) {
          if (usedValues.has(r)) {
            throw new HttpsError('failed-precondition', `No se puede eliminar la opción "${r}" del campo "${prevField.key}" porque ya está en uso.`);
          }
        }
      }
```

- [ ] **Step 4: Run, verify pass.** Run the functions test command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add functions/src/helpers/profileFormValidation.ts functions/test/profileFormValidation.test.ts
git commit -m "feat(functions): validate optionsSource in updateCenso transitions"
```

---

## Task 5: `Toggle` primitive (yes/no widget)

**Files:**
- Create: `apps/mobile/components/primitives/Toggle.tsx`
- Modify: `apps/mobile/components/primitives/index.ts`
- Test: `apps/mobile/components/primitives/__tests__/Toggle.test.tsx`

**Interfaces:**
- Produces: `Toggle`, `ToggleProps = { value: boolean; onValueChange: (next: boolean) => void; label?: string; testID?: string }`.

- [ ] **Step 1: Write failing test.** Create `__tests__/Toggle.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Toggle } from '../Toggle';

it('calls onValueChange with the toggled value', () => {
  const onChange = jest.fn();
  const { getByTestId } = render(<Toggle value={false} onValueChange={onChange} testID="t" />);
  fireEvent.press(getByTestId('t'));
  expect(onChange).toHaveBeenCalledWith(true);
});
```

(If the mobile test runner is vitest rather than jest, use `vi.fn()` and the project's RN testing-library setup — match the existing files under `apps/mobile/**/__tests__`.)

- [ ] **Step 2: Run, verify failure.** Run the mobile test command (match existing, e.g. `pnpm --filter mobile test -- Toggle`). Expected: FAIL (module missing).

- [ ] **Step 3: Implement.** Create `Toggle.tsx` — a `Pressable` track + thumb. Styles on `className` of a plain `View` (no `Animated`), per mobile-web-compat:

```tsx
import { View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { HStack } from './HStack';

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
  testID?: string;
}

export function Toggle({ value, onValueChange, label, testID }: ToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
    >
      <HStack gap={2} className="items-center">
        <View className={`w-12 h-7 rounded-full px-1 justify-center ${value ? 'bg-accent' : 'bg-subtle'}`}>
          <View className={`w-5 h-5 rounded-full bg-surface ${value ? 'self-end' : 'self-start'}`} />
        </View>
        {label ? <Text>{label}</Text> : null}
      </HStack>
    </Pressable>
  );
}
```

(Use whatever the project's accent/subtle/surface NativeWind tokens are — match `ACCENT`/existing classes seen in `VillageSections`/`Input`.)

Add `export * from './Toggle';` to `index.ts`.

- [ ] **Step 4: Run, verify pass.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/components/primitives/Toggle.tsx apps/mobile/components/primitives/index.ts apps/mobile/components/primitives/__tests__/Toggle.test.tsx
git commit -m "feat(mobile): add Toggle primitive"
```

---

## Task 6: `ChoiceList` widget (single/multi select)

**Files:**
- Create: `apps/mobile/components/feature/censo/ChoiceList.tsx`
- Test: `apps/mobile/components/feature/censo/__tests__/ChoiceList.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface ChoiceOption { value: string; label: string; disabled?: boolean }
export interface ChoiceListProps {
  options: ChoiceOption[];
  mode: 'single' | 'multi';
  value: string | string[] | undefined;
  onChange: (next: string | string[]) => void;
}
export function ChoiceList(props: ChoiceListProps): JSX.Element;
```

- [ ] **Step 1: Write failing tests.** Create `__tests__/ChoiceList.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ChoiceList } from '../ChoiceList';

const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

it('single mode emits the chosen value', () => {
  const onChange = jest.fn();
  const { getByText } = render(<ChoiceList options={opts} mode="single" value={undefined} onChange={onChange} />);
  fireEvent.press(getByText('A'));
  expect(onChange).toHaveBeenCalledWith('a');
});

it('multi mode toggles values in an array', () => {
  const onChange = jest.fn();
  const { getByText } = render(<ChoiceList options={opts} mode="multi" value={['a']} onChange={onChange} />);
  fireEvent.press(getByText('B'));
  expect(onChange).toHaveBeenCalledWith(['a', 'b']);
});
```

- [ ] **Step 2: Run, verify failure.** Expected: FAIL.

- [ ] **Step 3: Implement.** Create `ChoiceList.tsx`:

```tsx
import { Pressable, Text, HStack } from '../../primitives';
import { View } from 'react-native';

export interface ChoiceOption { value: string; label: string; disabled?: boolean }
export interface ChoiceListProps {
  options: ChoiceOption[];
  mode: 'single' | 'multi';
  value: string | string[] | undefined;
  onChange: (next: string | string[]) => void;
}

export function ChoiceList({ options, mode, value, onChange }: ChoiceListProps) {
  const selected = new Set(Array.isArray(value) ? value : value !== undefined ? [value] : []);
  function toggle(v: string) {
    if (mode === 'single') {
      onChange(v);
      return;
    }
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange([...next]);
  }
  return (
    <HStack gap={2} className="flex-wrap">
      {options.map((o) => {
        const on = selected.has(o.value);
        return (
          <Pressable key={o.value} disabled={o.disabled} onPress={() => toggle(o.value)}>
            <View className={`px-3 py-2 rounded-full border ${on ? 'bg-accent border-accent' : 'border-subtle bg-surface'} ${o.disabled ? 'opacity-50' : ''}`}>
              <Text className={on ? 'text-white' : 'text-primary'}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </HStack>
  );
}
```

(Match real NativeWind tokens. `flex-wrap` on `HStack` may require a `className` passthrough — confirm `HStack` forwards `className`; it does per existing usage in `VillageHomeBody`.)

- [ ] **Step 4: Run, verify pass.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/components/feature/censo/ChoiceList.tsx apps/mobile/components/feature/censo/__tests__/ChoiceList.test.tsx
git commit -m "feat(mobile): add ChoiceList censo widget"
```

---

## Task 7: i18n strings for builder + types

**Files:**
- Modify: `packages/i18n/messages/es.json`

- [ ] **Step 1: Add keys.** Under the existing top-level `"censo"` object (which already has `title`, `noFields`, `save`, `error`, `saved`, `missingRequired`), add:

```json
    "types": {
      "text": "Texto corto",
      "textarea": "Párrafo",
      "select": "Elección única",
      "multiselect": "Elección múltiple",
      "number": "Número",
      "boolean": "Sí/No",
      "date": "Fecha",
      "entity": "Elemento del pueblo"
    },
    "builder": {
      "addQuestion": "Añadir pregunta",
      "addPredefined": "Añadir campo predefinido",
      "questionLabel": "Pregunta",
      "required": "Obligatoria",
      "addOption": "Añadir opción",
      "optionPlaceholder": "Opción",
      "source": "Origen",
      "sourceBarrios": "Barrios",
      "sourcePlaces": "Lugares",
      "sourceOrganizations": "Peñas",
      "moveUp": "Subir",
      "moveDown": "Bajar",
      "locked": "En uso",
      "deletedEntity": "(eliminado)",
      "emptyLabel": "Escribe el texto de la pregunta",
      "needsOptions": "Añade al menos una opción"
    }
```

- [ ] **Step 2: Verify JSON valid.** Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`. Expected: `ok`.

- [ ] **Step 3: Commit.**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n: censo builder and field-type strings"
```

---

## Task 8: `useEntityOptions` — resolve barrios/places/orgs per field

**Files:**
- Create: `apps/mobile/components/feature/censo/useEntityOptions.ts`

**Interfaces:**
- Consumes: `getBarrios`, `getPlaces` (`municipalityService`), `getOrganizationsByMunicipality` (`organizationService`), `resolveFieldDisplay` (Task 3), `ProfileFormField`.
- Produces:

```ts
// Map of fieldKey -> ChoiceOption[] (live entity options), plus a loading flag.
export function useEntityOptions(
  villageId: string,
  fields: ProfileFormField[],
): { optionsByField: Record<string, ChoiceOption[]>; loading: boolean };
```

- [ ] **Step 1: Implement.** Create `useEntityOptions.ts`:

```ts
import { useEffect, useState } from 'react';
import { getBarrios, getPlaces } from '@cultuvilla/shared/services/municipalityService';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { ProfileFormField, OptionsSource } from '@cultuvilla/shared/models/municipality/CensoTypes';
import type { ChoiceOption } from './ChoiceList';

export function useEntityOptions(villageId: string, fields: ProfileFormField[]) {
  const [optionsByField, setOptionsByField] = useState<Record<string, ChoiceOption[]>>({});
  const [loading, setLoading] = useState(false);

  const sources = new Set<OptionsSource>();
  for (const f of fields) {
    const src = resolveFieldDisplay(f).optionsSource;
    if (src) sources.add(src);
  }
  const sourceKey = [...sources].sort().join(',');

  useEffect(() => {
    if (!villageId || sources.size === 0) {
      setOptionsByField({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [barrios, places, orgs] = await Promise.all([
        sources.has('barrios') ? getBarrios(villageId) : Promise.resolve([]),
        sources.has('places') ? getPlaces(villageId) : Promise.resolve([]),
        sources.has('organizations') ? getOrganizationsByMunicipality(villageId) : Promise.resolve([]),
      ]);
      const bySource: Record<OptionsSource, ChoiceOption[]> = {
        barrios: barrios.map((b) => ({ value: b.id, label: b.name })),
        places: places.map((p) => ({ value: p.id, label: p.name })),
        organizations: orgs.map((o) => ({ value: o.id, label: o.name })),
      };
      const map: Record<string, ChoiceOption[]> = {};
      for (const f of fields) {
        const src = resolveFieldDisplay(f).optionsSource;
        if (src) map[f.key] = bySource[src];
      }
      if (!cancelled) {
        setOptionsByField(map);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId, sourceKey]);

  return { optionsByField, loading };
}
```

(Confirm `BarrioData`/`PlaceData`/`OrganizationData` expose `name`; per `useVillageHome.ts` they're rendered by `name`. Adjust field names if the real models differ.)

- [ ] **Step 2: Typecheck.** Run the mobile typecheck (e.g. `pnpm --filter mobile typecheck` or `pnpm check`). Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add apps/mobile/components/feature/censo/useEntityOptions.ts
git commit -m "feat(mobile): useEntityOptions resolves entity-backed censo choices"
```

---

## Task 9: `CensoFieldInput` — per-type member widget

**Files:**
- Create: `apps/mobile/components/feature/censo/CensoFieldInput.tsx`
- Test: `apps/mobile/components/feature/censo/__tests__/CensoFieldInput.test.tsx`

**Interfaces:**
- Consumes: `resolveFieldDisplay`, `Input`, `Toggle`, `DateField`, `ChoiceList`, `ChoiceOption`, `useT`, `ProfileAnswerValue`.
- Produces:

```ts
export interface CensoFieldInputProps {
  field: ProfileFormField;
  value: ProfileAnswerValue | undefined;
  onChange: (next: ProfileAnswerValue | undefined) => void;
  entityOptions?: ChoiceOption[]; // present for optionsSource fields
}
export function CensoFieldInput(props: CensoFieldInputProps): JSX.Element;
```

- [ ] **Step 1: Write failing tests.** Create `__tests__/CensoFieldInput.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { CensoFieldInput } from '../CensoFieldInput';

it('renders a numeric input and emits a number', () => {
  const onChange = jest.fn();
  const { getByLabelText } = render(
    <CensoFieldInput field={{ source: 'custom', key: 'n', label: 'Edad', type: 'number', required: false }} value={undefined} onChange={onChange} />,
  );
  fireEvent.changeText(getByLabelText('Edad'), '42');
  expect(onChange).toHaveBeenCalledWith(42);
});

it('appends a deleted-entity option for a stored id not in current options', () => {
  const { getByText } = render(
    <CensoFieldInput
      field={{ source: 'custom', key: 'b', label: 'Barrio', type: 'select', optionsSource: 'barrios', required: false }}
      value="gone-id"
      onChange={() => {}}
      entityOptions={[{ value: 'x', label: 'Centro' }]}
    />,
  );
  expect(getByText('(eliminado)')).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify failure.** Expected: FAIL.

- [ ] **Step 3: Implement.** Create `CensoFieldInput.tsx`:

```tsx
import { useState } from 'react';
import { Input, Toggle, DateField, Text, VStack } from '../../primitives';
import { ChoiceList, type ChoiceOption } from './ChoiceList';
import { useT } from '../../../lib/i18n';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import type { ProfileAnswerValue } from '@cultuvilla/shared/models/municipality/CensoTypes';

export interface CensoFieldInputProps {
  field: ProfileFormField;
  value: ProfileAnswerValue | undefined;
  onChange: (next: ProfileAnswerValue | undefined) => void;
  entityOptions?: ChoiceOption[];
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CensoFieldInput({ field, value, onChange, entityOptions }: CensoFieldInputProps) {
  const { t } = useT();
  const r = resolveFieldDisplay(field);
  const label = r.label + (r.required ? ' *' : '');

  switch (r.type) {
    case 'textarea':
      return <Input label={label} value={String(value ?? '')} onChangeText={(v) => onChange(v)} multiline numberOfLines={4} />;
    case 'number':
      return (
        <Input
          label={label}
          keyboardType="numeric"
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={(v) => {
            const n = Number(v);
            onChange(v.trim() === '' || Number.isNaN(n) ? undefined : n);
          }}
        />
      );
    case 'boolean':
      return (
        <VStack gap={1}>
          <Text variant="bodySm" tone="muted">{label}</Text>
          <Toggle value={value === true} onValueChange={(b) => onChange(b)} />
        </VStack>
      );
    case 'date': {
      const d = typeof value === 'string' && value ? new Date(value) : null;
      return <DateField label={label} value={d} onChange={(nd) => onChange(nd ? toISODate(nd) : undefined)} />;
    }
    case 'select':
    case 'multiselect': {
      const baseOptions: ChoiceOption[] = r.optionsSource
        ? (entityOptions ?? [])
        : (r.options ?? []).map((o) => ({ value: o, label: o }));
      // Surface a stored value that no longer maps to a live option (deleted entity).
      const known = new Set(baseOptions.map((o) => o.value));
      const stored = Array.isArray(value) ? value : value !== undefined ? [String(value)] : [];
      const ghosts: ChoiceOption[] = stored
        .filter((v) => !known.has(v))
        .map((v) => ({ value: v, label: t('censo.builder.deletedEntity'), disabled: true }));
      return (
        <VStack gap={1}>
          <Text variant="bodySm" tone="muted">{label}</Text>
          <ChoiceList
            options={[...baseOptions, ...ghosts]}
            mode={r.type === 'multiselect' ? 'multi' : 'single'}
            value={value as string | string[] | undefined}
            onChange={(next) => onChange(next)}
          />
        </VStack>
      );
    }
    case 'text':
    default:
      return <Input label={label} value={String(value ?? '')} onChangeText={(v) => onChange(v)} />;
  }
}
```

(`ProfileAnswerValue` is exported from `CensoTypes`; if the duplicate import line lints, combine into one import.)

- [ ] **Step 4: Run, verify pass.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/components/feature/censo/CensoFieldInput.tsx apps/mobile/components/feature/censo/__tests__/CensoFieldInput.test.tsx
git commit -m "feat(mobile): CensoFieldInput renders type-aware censo widgets"
```

---

## Task 10: Rewire member form (`CensoForm` + `CensoAnswers`)

**Files:**
- Modify: `apps/mobile/components/feature/CensoForm.tsx`
- Modify: `apps/mobile/components/feature/CensoAnswers.tsx`

**Interfaces:**
- Consumes: `CensoFieldInput`, `useEntityOptions`.

- [ ] **Step 1: Update `CensoForm`.** Replace the field-rendering `map` (currently a plain `Input` per field) so each field renders through `CensoFieldInput`, threading entity options. Add an `entityOptions` prop:

```tsx
import { CensoFieldInput } from './censo/CensoFieldInput';
import type { ChoiceOption } from './censo/ChoiceList';

export type CensoFormProps = {
  villageId: string;
  userId: string;
  schema: ProfileFormField[];
  initialAnswers?: ProfileAnswers;
  entityOptionsByField?: Record<string, ChoiceOption[]>;
};
```

In the render, replace the `{schema.map(...)}` block with:

```tsx
      {schema.map((field) => (
        <CensoFieldInput
          key={field.key}
          field={field}
          value={answers[field.key]}
          onChange={(v) => setAnswer(field.key, v)}
          entityOptions={entityOptionsByField?.[field.key]}
        />
      ))}
```

Change `setAnswer` to accept `ProfileAnswerValue | undefined` (delete the key when `undefined`):

```tsx
  function setAnswer(key: string, value: ProfileAnswerValue | undefined) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key]; else next[key] = value;
      return next;
    });
    setSaved(false);
  }
```

Keep the existing `schema.length === 0 → t('censo.noFields')`, the missing-required warning, and the save button unchanged.

- [ ] **Step 2: Update `CensoAnswers`.** Call `useEntityOptions` and pass the map down:

```tsx
import { useEntityOptions } from './censo/useEntityOptions';
// ...inside component, after schema is loaded:
const { optionsByField } = useEntityOptions(villageId, schema ?? []);
// ...
<CensoForm villageId={villageId} userId={userId} schema={schema ?? []} initialAnswers={initialAnswers} entityOptionsByField={optionsByField} />
```

- [ ] **Step 3: Typecheck + existing tests.** Run: `pnpm check`. Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add apps/mobile/components/feature/CensoForm.tsx apps/mobile/components/feature/CensoAnswers.tsx
git commit -m "feat(mobile): member censo form renders typed widgets + entity choices"
```

---

## Task 11: Builder reducer (`censoEditorReducer`)

**Files:**
- Create: `apps/mobile/components/feature/censo/censoEditorReducer.ts`
- Test: `apps/mobile/components/feature/censo/__tests__/censoEditorReducer.test.ts`

**Interfaces:**
- Consumes: `ProfileFormField`, `FieldType`, `OptionsSource`, `slugifyFieldKey`.
- Produces:

```ts
export type EditorAction =
  | { kind: 'addCustom'; type: FieldType }
  | { kind: 'addPredefined'; key: string }
  | { kind: 'remove'; index: number }
  | { kind: 'setLabel'; index: number; label: string }
  | { kind: 'setRequired'; index: number; required: boolean }
  | { kind: 'changeType'; index: number; type: FieldType }
  | { kind: 'setOptions'; index: number; options: string[] }
  | { kind: 'setSource'; index: number; source: OptionsSource }
  | { kind: 'move'; index: number; dir: -1 | 1 };

export function censoEditorReducer(fields: ProfileFormField[], action: EditorAction): ProfileFormField[];
export function uniqueKey(base: string, existing: string[]): string;
export function fieldErrors(fields: ProfileFormField[]): Record<number, string>; // index -> error code key
```

- [ ] **Step 1: Write failing tests.** Create `__tests__/censoEditorReducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { censoEditorReducer, uniqueKey, fieldErrors } from '../censoEditorReducer';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';

const cf = (over: Partial<ProfileFormField> = {}): ProfileFormField =>
  ({ source: 'custom', key: 'k', label: 'L', type: 'text', required: false, ...over } as ProfileFormField);

describe('censoEditorReducer', () => {
  it('addCustom appends a blank field of the given type', () => {
    const r = censoEditorReducer([], { kind: 'addCustom', type: 'select' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ source: 'custom', type: 'select', label: '' });
  });
  it('setLabel regenerates the key from the label', () => {
    const r = censoEditorReducer([cf({ label: '', key: '' })], { kind: 'setLabel', index: 0, label: 'Año de llegada' });
    expect(r[0].label).toBe('Año de llegada');
    expect(r[0].key).toBe('ano_de_llegada');
  });
  it('changeType to select clears optionsSource and keeps options empty', () => {
    const r = censoEditorReducer([cf({ type: 'text' })], { kind: 'changeType', index: 0, type: 'select' });
    expect(r[0]).toMatchObject({ type: 'select' });
  });
  it('setSource clears static options', () => {
    const r = censoEditorReducer([cf({ type: 'select', options: ['a'] })], { kind: 'setSource', index: 0, source: 'barrios' });
    expect((r[0] as any).optionsSource).toBe('barrios');
    expect((r[0] as any).options).toBeUndefined();
  });
  it('move reorders', () => {
    const a = cf({ key: 'a', label: 'A' }); const b = cf({ key: 'b', label: 'B' });
    const r = censoEditorReducer([a, b], { kind: 'move', index: 0, dir: 1 });
    expect(r.map((f) => f.key)).toEqual(['b', 'a']);
  });
});

describe('uniqueKey', () => {
  it('suffixes collisions', () => {
    expect(uniqueKey('barrio', ['barrio'])).toBe('barrio_2');
  });
});

describe('fieldErrors', () => {
  it('flags an empty label and a choice with no options', () => {
    const e = fieldErrors([cf({ label: '' }), cf({ type: 'select', label: 'X', options: [] })]);
    expect(e[0]).toBeDefined();
    expect(e[1]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, verify failure.** Expected: FAIL.

- [ ] **Step 3: Implement.** Create `censoEditorReducer.ts`:

```ts
import { slugifyFieldKey } from '@cultuvilla/shared/models/municipality/CensoTypes';
import type { FieldType, OptionsSource, ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';

export type EditorAction =
  | { kind: 'addCustom'; type: FieldType }
  | { kind: 'addPredefined'; key: string }
  | { kind: 'remove'; index: number }
  | { kind: 'setLabel'; index: number; label: string }
  | { kind: 'setRequired'; index: number; required: boolean }
  | { kind: 'changeType'; index: number; type: FieldType }
  | { kind: 'setOptions'; index: number; options: string[] }
  | { kind: 'setSource'; index: number; source: OptionsSource }
  | { kind: 'move'; index: number; dir: -1 | 1 };

export function uniqueKey(base: string, existing: string[]): string {
  const safe = base || 'campo';
  if (!existing.includes(safe)) return safe;
  let i = 2;
  while (existing.includes(`${safe}_${i}`)) i += 1;
  return `${safe}_${i}`;
}

function isChoice(t: FieldType): boolean {
  return t === 'select' || t === 'multiselect';
}

export function censoEditorReducer(fields: ProfileFormField[], action: EditorAction): ProfileFormField[] {
  const next = fields.slice();
  switch (action.kind) {
    case 'addCustom':
      next.push({ source: 'custom', key: '', label: '', type: action.type, required: false,
        ...(isChoice(action.type) ? { options: [] } : {}) } as ProfileFormField);
      return next;
    case 'addPredefined':
      if (next.some((f) => f.key === action.key)) return next;
      next.push({ source: 'predefined', key: action.key, required: false } as ProfileFormField);
      return next;
    case 'remove':
      next.splice(action.index, 1);
      return next;
    case 'setLabel': {
      const f = next[action.index];
      if (f.source !== 'custom') return next;
      const others = next.filter((_, i) => i !== action.index).map((x) => x.key);
      next[action.index] = { ...f, label: action.label, key: uniqueKey(slugifyFieldKey(action.label), others) };
      return next;
    }
    case 'setRequired':
      next[action.index] = { ...next[action.index], required: action.required };
      return next;
    case 'changeType': {
      const f = next[action.index];
      if (f.source !== 'custom') return next;
      next[action.index] = {
        ...f, type: action.type,
        options: isChoice(action.type) ? (f.options ?? []) : undefined,
        optionsSource: undefined,
      };
      return next;
    }
    case 'setOptions': {
      const f = next[action.index];
      if (f.source !== 'custom') return next;
      next[action.index] = { ...f, options: action.options, optionsSource: undefined };
      return next;
    }
    case 'setSource': {
      const f = next[action.index];
      if (f.source !== 'custom') return next;
      next[action.index] = { ...f, optionsSource: action.source, options: undefined };
      return next;
    }
    case 'move': {
      const j = action.index + action.dir;
      if (j < 0 || j >= next.length) return next;
      const tmp = next[action.index];
      next[action.index] = next[j];
      next[j] = tmp;
      return next;
    }
    default:
      return next;
  }
}

/** index -> i18n error key suffix under censo.builder. */
export function fieldErrors(fields: ProfileFormField[]): Record<number, string> {
  const errs: Record<number, string> = {};
  fields.forEach((f, i) => {
    if (f.source !== 'custom') return;
    if (!f.label.trim()) { errs[i] = 'emptyLabel'; return; }
    if (isChoice(f.type)) {
      const hasStatic = Array.isArray(f.options) && f.options.length > 0;
      const hasSource = f.optionsSource !== undefined;
      if (!hasStatic && !hasSource) errs[i] = 'needsOptions';
    }
  });
  return errs;
}
```

- [ ] **Step 4: Run, verify pass.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/mobile/components/feature/censo/censoEditorReducer.ts apps/mobile/components/feature/censo/__tests__/censoEditorReducer.test.ts
git commit -m "feat(mobile): pure censo builder reducer"
```

---

## Task 12: Builder sub-components (TypePicker, OptionsEditor, EntitySourcePicker, QuestionCard)

**Files:**
- Create: `apps/mobile/components/feature/censo/QuestionTypePicker.tsx`
- Create: `apps/mobile/components/feature/censo/OptionsEditor.tsx`
- Create: `apps/mobile/components/feature/censo/EntitySourcePicker.tsx`
- Create: `apps/mobile/components/feature/censo/QuestionCard.tsx`

**Interfaces:**
- Consumes: `EditorAction` dispatcher (a `dispatch: (a: EditorAction) => void`), `resolveFieldDisplay`, `ChoiceList`/`Toggle`/`Input`/`Button`/`Text`/`Pressable`, `useT`.
- Produces: presentational components, each taking a `field`/`index`/`dispatch` (+ `locked: boolean`, `error?: string`, `entitySourceLabels`) as needed.

- [ ] **Step 1: `QuestionTypePicker`.** A row of chips that calls `onPick(type)` for each of the 8 types (`text`, `textarea`, `select`, `multiselect`, `number`, `boolean`, `date`, and an "entity" pseudo-type that maps to `select` + a source). Labels from `t('censo.types.*')`. Implementation:

```tsx
import { ChoiceList } from './ChoiceList';
import type { FieldType } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';

const TYPES: FieldType[] = ['text', 'textarea', 'select', 'multiselect', 'number', 'boolean', 'date'];

export function QuestionTypePicker({ onPick }: { onPick: (type: FieldType) => void }) {
  const { t } = useT();
  return (
    <ChoiceList
      mode="single"
      value={undefined}
      onChange={(v) => onPick(v as FieldType)}
      options={TYPES.map((ty) => ({ value: ty, label: t(`censo.types.${ty}`) }))}
    />
  );
}
```

- [ ] **Step 2: `OptionsEditor`.** Edits a `string[]` for a static choice field. Each option is an `Input` with a delete `Pressable`; an "add option" `Button` appends `''`. Calls `onChange(nextOptions)`:

```tsx
import { Input, Button, Pressable, Text, VStack, HStack } from '../../primitives';
import { useT } from '../../../lib/i18n';

export function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const { t } = useT();
  return (
    <VStack gap={2}>
      {options.map((opt, i) => (
        <HStack key={i} gap={2} className="items-center">
          <Input value={opt} onChangeText={(v) => onChange(options.map((o, j) => (j === i ? v : o)))} placeholder={t('censo.builder.optionPlaceholder')} />
          <Pressable onPress={() => onChange(options.filter((_, j) => j !== i))}>
            <Text className="text-red-600">{t('common.delete')}</Text>
          </Pressable>
        </HStack>
      ))}
      <Button variant="ghost" onPress={() => onChange([...options, ''])}>{t('censo.builder.addOption')}</Button>
    </VStack>
  );
}
```

- [ ] **Step 3: `EntitySourcePicker`.** Single-choice over the three sources, calls `onPick(source)`:

```tsx
import { ChoiceList } from './ChoiceList';
import type { OptionsSource } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';

const SOURCES: OptionsSource[] = ['barrios', 'places', 'organizations'];
const LABEL: Record<OptionsSource, string> = {
  barrios: 'censo.builder.sourceBarrios', places: 'censo.builder.sourcePlaces', organizations: 'censo.builder.sourceOrganizations',
};

export function EntitySourcePicker({ value, onPick }: { value?: OptionsSource; onPick: (s: OptionsSource) => void }) {
  const { t } = useT();
  return (
    <ChoiceList mode="single" value={value} onChange={(v) => onPick(v as OptionsSource)}
      options={SOURCES.map((s) => ({ value: s, label: t(LABEL[s]) }))} />
  );
}
```

- [ ] **Step 4: `QuestionCard`.** Composes the above for one field. Shows: label `Input` (custom only; predefined shows resolved label as read-only `Text`), type picker (custom + unlocked), required `Toggle`, `OptionsEditor` when type is choice with no source, `EntitySourcePicker` toggle for choice fields, move up/down, delete (hidden/disabled when `locked`), and the `error` message. Dispatches `EditorAction`s:

```tsx
import { View } from 'react-native';
import { Input, Toggle, Button, Pressable, Text, VStack, HStack } from '../../primitives';
import { QuestionTypePicker } from './QuestionTypePicker';
import { OptionsEditor } from './OptionsEditor';
import { EntitySourcePicker } from './EntitySourcePicker';
import { resolveFieldDisplay } from '@cultuvilla/shared/services/censoFieldResolver';
import type { EditorAction } from './censoEditorReducer';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useT } from '../../../lib/i18n';

export function QuestionCard({ field, index, dispatch, locked, error }: {
  field: ProfileFormField; index: number; dispatch: (a: EditorAction) => void; locked: boolean; error?: string;
}) {
  const { t } = useT();
  const r = resolveFieldDisplay(field);
  const isCustom = field.source === 'custom';
  const isChoice = r.type === 'select' || r.type === 'multiselect';
  return (
    <VStack gap={2} className="bg-surface border border-subtle rounded-xl p-3">
      {isCustom ? (
        <Input label={t('censo.builder.questionLabel')} value={r.label}
          onChangeText={(v) => dispatch({ kind: 'setLabel', index, label: v })} placeholder={t('censo.builder.emptyLabel')} />
      ) : (
        <Text>{r.label}</Text>
      )}

      {isCustom && !locked && (
        <QuestionTypePicker onPick={(type) => dispatch({ kind: 'changeType', index, type })} />
      )}

      {isCustom && isChoice && (
        <VStack gap={2}>
          <Text variant="bodySm" tone="muted">{t('censo.builder.source')}</Text>
          <EntitySourcePicker value={field.source === 'custom' ? field.optionsSource : undefined}
            onPick={(s) => dispatch({ kind: 'setSource', index, source: s })} />
          {(field.source === 'custom' && field.optionsSource === undefined) && (
            <OptionsEditor options={field.source === 'custom' ? (field.options ?? []) : []}
              onChange={(opts) => dispatch({ kind: 'setOptions', index, options: opts })} />
          )}
        </VStack>
      )}

      <HStack gap={3} className="items-center justify-between">
        <Toggle label={t('censo.builder.required')} value={r.required}
          onValueChange={(b) => dispatch({ kind: 'setRequired', index, required: b })} />
        <HStack gap={2} className="items-center">
          <Pressable onPress={() => dispatch({ kind: 'move', index, dir: -1 })}><Text>↑</Text></Pressable>
          <Pressable onPress={() => dispatch({ kind: 'move', index, dir: 1 })}><Text>↓</Text></Pressable>
          {locked ? (
            <Text className="text-xs text-orange-600">{t('censo.builder.locked')}</Text>
          ) : (
            <Pressable onPress={() => dispatch({ kind: 'remove', index })}><Text className="text-red-600">{t('common.delete')}</Text></Pressable>
          )}
        </HStack>
      </HStack>

      {error ? <Text tone="danger">{t(`censo.builder.${error}`)}</Text> : null}
    </VStack>
  );
}
```

- [ ] **Step 5: Typecheck.** Run: `pnpm check`. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/mobile/components/feature/censo/QuestionTypePicker.tsx apps/mobile/components/feature/censo/OptionsEditor.tsx apps/mobile/components/feature/censo/EntitySourcePicker.tsx apps/mobile/components/feature/censo/QuestionCard.tsx
git commit -m "feat(mobile): censo builder sub-components"
```

---

## Task 13: Rewrite `CensoSchemaEditor` orchestrator

**Files:**
- Modify: `apps/mobile/components/feature/CensoSchemaEditor.tsx`

**Interfaces:**
- Consumes: `censoEditorReducer`, `fieldErrors`, `QuestionCard`, `QuestionTypePicker`, `listPredefinedFields`, `getMunicipality`, `getVillageMembers`, `collectUsedValues`, `updateCensoSchema`, `validateSchemaTransition`.

- [ ] **Step 1: Implement.** Replace `CensoSchemaEditor.tsx` body. Load prior fields + locked keys exactly as today (`getMunicipality` + `getVillageMembers` + `collectUsedValues`); hold `fields` in `useReducer(censoEditorReducer, [])`; render a `QuestionCard` per field; below, a `QuestionTypePicker` (add custom) and a predefined quick-add list (`listPredefinedFields()` filtered to not-already-present); a Save button gated on `Object.keys(fieldErrors(fields)).length === 0`. Save calls `updateCensoSchema(villageId, fields)` and re-shows the existing saved Alert (native-only per mobile-web-compat):

```tsx
import { useEffect, useReducer, useState } from 'react';
import { Alert } from 'react-native';
import { VStack, HStack, Text, Button, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { updateCensoSchema } from '@cultuvilla/shared/services/censoService';
import { collectUsedValues } from '@cultuvilla/shared/services/membershipProfileService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import { listPredefinedFields } from '@cultuvilla/shared/models/municipality/profileFieldRegistry';
import type { ProfileFormField, FieldType } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { censoEditorReducer, fieldErrors, type EditorAction } from './censo/censoEditorReducer';
import { QuestionCard } from './censo/QuestionCard';
import { QuestionTypePicker } from './censo/QuestionTypePicker';

export function CensoSchemaEditor({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [fields, dispatch] = useReducer(censoEditorReducer, []);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mun, members] = await Promise.all([getMunicipality(villageId), getVillageMembers(villageId)]);
      const used = collectUsedValues(members);
      if (cancelled) return;
      setLocked(new Set(Object.entries(used).filter(([, v]) => v.size > 0).map(([k]) => k)));
      const initial = mun?.community?.profileForm?.fields ?? [];
      // hydrate the reducer by replaying addPredefined/addCustom is overkill;
      // instead seed via a dedicated reset action. Simplest: dispatch a set.
      dispatch({ kind: 'reset' as never, fields: initial } as never);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [villageId]);

  const errors = fieldErrors(fields);
  const present = new Set(fields.map((f) => f.key));
  const available = listPredefinedFields().filter((d) => !present.has(d.key));

  async function save() {
    setSaving(true);
    try {
      await updateCensoSchema(villageId, fields);
      Alert.alert(t('common.save'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Text className="p-4">{t('common.loading')}</Text>;

  return (
    <VStack gap={3} className="p-4">
      {fields.map((f, i) => (
        <QuestionCard key={`${f.key}-${i}`} field={f} index={i} dispatch={dispatch as (a: EditorAction) => void}
          locked={locked.has(f.key)} error={errors[i]} />
      ))}

      <Text variant="bodySm" tone="muted">{t('censo.builder.addQuestion')}</Text>
      <QuestionTypePicker onPick={(type: FieldType) => dispatch({ kind: 'addCustom', type })} />

      {available.length > 0 && (
        <>
          <Text variant="bodySm" tone="muted">{t('censo.builder.addPredefined')}</Text>
          <HStack gap={2} className="flex-wrap">
            {available.map((d) => (
              <Pressable key={d.key} onPress={() => dispatch({ kind: 'addPredefined', key: d.key })}
                className="px-3 py-2 rounded-full border border-subtle bg-surface">
                <Text>{d.defaultLabel}</Text>
              </Pressable>
            ))}
          </HStack>
        </>
      )}

      <Button onPress={save} loading={saving} disabled={Object.keys(errors).length > 0}>
        {t('common.save')}
      </Button>
    </VStack>
  );
}
```

- [ ] **Step 2: Add the `reset` action to the reducer.** The orchestrator needs to seed prior fields. Extend `EditorAction` and `censoEditorReducer` (Task 11 file) with:

```ts
  | { kind: 'reset'; fields: ProfileFormField[] }
```
```ts
    case 'reset':
      return action.fields.slice();
```

Remove the `as never` casts in the orchestrator once the action exists (`dispatch({ kind: 'reset', fields: initial })`). Add a reducer test:

```ts
  it('reset replaces all fields', () => {
    const r = censoEditorReducer([cf()], { kind: 'reset', fields: [cf({ key: 'x', label: 'X' })] });
    expect(r.map((f) => f.key)).toEqual(['x']);
  });
```

- [ ] **Step 3: Run full check.** Run: `pnpm check`. Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add apps/mobile/components/feature/CensoSchemaEditor.tsx apps/mobile/components/feature/censo/censoEditorReducer.ts apps/mobile/components/feature/censo/__tests__/censoEditorReducer.test.ts
git commit -m "feat(mobile): rewrite censo schema editor as form builder"
```

---

## Task 14: End-to-end verification on device

**Files:** none (manual verification via `drive-android-avd` skill).

- [ ] **Step 1:** Boot the dev-client AVD and deep-link to a village where the signed-in user is an organizer (`drive-android-avd` skill).
- [ ] **Step 2:** Open the village tab → tap **Configurar censo** → confirm the builder renders. Add: a short-text question, a single-choice with two static options, a number, a yes/no, a date, and an entity-backed "Lugares" multiselect. Save; confirm no error.
- [ ] **Step 3:** Switch to a member account (or use a second member), open **Completar mi censo**, confirm each question renders the correct widget and the entity multiselect lists real places. Answer and save.
- [ ] **Step 4:** Back as organizer, rename a place, reopen the member form, confirm the renamed place shows live; delete a place that was chosen, confirm the member sees `(eliminado)` rather than a crash.
- [ ] **Step 5:** Capture a screenshot of the builder and the member form for the PR/commit description. No code commit unless a bug fix is needed.

---

## Self-Review (completed)

- **Spec coverage:** backend `optionsSource` (Tasks 1–4), builder UI (Tasks 11–13), type-aware member form (Tasks 5–6, 9–10), entity-backed live resolution (Tasks 8–9), predefined quick-add (Task 13), i18n (Task 7), tests at every layer, device verification (Task 14). All design sections map to tasks.
- **Type consistency:** `EditorAction`, `ResolvedField`, `ChoiceOption`, `CensoFieldInputProps`, `optionsSource` used identically across tasks; `reset` action reconciled into Task 11's file in Task 13.
- **Placeholder scan:** none — every code step carries full code.
- **Known follow-up to confirm during execution:** exact NativeWind token names (`bg-accent`, `text-white`, etc.) and the mobile test runner (jest vs vitest) — match the existing `apps/mobile` files; the plan flags both inline.
