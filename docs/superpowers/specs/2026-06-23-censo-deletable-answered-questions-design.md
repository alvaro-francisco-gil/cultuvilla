# Censo: deletable answered questions (with answer cleanup)

**Date:** 2026-06-23
**Status:** Approved design

## Problem

The censo schema is a single living `profileForm.fields` array on the
municipality doc. The server's `validateTransition` (in
`functions/src/helpers/profileFormValidation.ts`) refuses to remove any field
that members have already answered, throwing `failed-precondition`. Combined
with the existing block on changing an answered question's type, an admin who
gets any real answers is permanently stuck: they cannot drop a question.

(Note: the `INTERNAL` error that surfaced this — adding a question to an
existing censo — was a *separate* bug: the deployed dev function bundled a
stale `@cultuvilla/shared` that rejected `options: null`. Fixed by rebuilding
shared and redeploying `updateCenso` to dev. This spec does not address that;
it is already resolved.)

## Decision

Relax the policy in exactly one way: **a question can always be deleted, even
when answered. Deleting it erases that field's answers across all members.**
Mutating an answered question (type change, removing an in-use option) stays
blocked — those are edits, not deletions.

Rejected alternatives: archiving answers (soft-delete) and versioned schemas —
both over-engineer a village censo. Erasure is acceptable because it is
explicit and confirmed by the admin.

## Policy after this change

| Edit | Answered? | Allowed | Effect |
|---|---|---|---|
| Add question | — | ✅ | — |
| Reorder / rename label / toggle required / add option | any | ✅ | none on answers |
| Remove question | no | ✅ | — |
| **Remove question** | **yes** | **✅ (new)** | **erase `profileAnswers.<key>` for all members** |
| Change question type | yes | ❌ | blocked (unchanged) |
| Remove an in-use choice option | yes | ❌ | blocked (unchanged) |

## Components

### Server — `functions/src/helpers/profileFormValidation.ts`
`validateTransition`: remove the throw in the `if (!nextField)` branch that
fires when a removed field `hasAnswers`. Keep every other throw (duplicate
key, source change, type change, in-use option removal).

### Server — `functions/src/census/updateCenso.ts`
After `validateTransition` passes:
1. Compute `removedAnsweredKeys`: keys present in `prevFields`, absent in
   `next`, and present in `used` with a non-empty set.
2. Build a single `WriteBatch`:
   - `municipalityRef.update('community.profileForm', { fields, updatedAt: serverTimestamp() })`
   - For each member doc, for each removed-answered key the member actually
     has: `memberRef.update('profileAnswers.<key>', FieldValue.delete())`.
   - Only touch members who hold one of the removed keys (skip the rest).
3. `batch.commit()` — atomic. Village member counts are small, well under the
   500-op batch limit; no chunking needed for v1 (documented assumption).

Return `{ ok: true, fieldCount }` as today. Reuse the existing
`collectUsedValues` member scan; extend it (or add a parallel pass) so the
removed-key cleanup knows which member docs hold which keys — store the member
doc ids per key alongside the value sets, or re-read in the batch step.

### Client — `apps/mobile/components/feature/CensoSchemaEditor.tsx`
The editor already fetches members. Compute `answeredCountByKey: Record<string, number>`
= number of members whose `profileAnswers` contains the key. Pass each
question's count into `QuestionCard`.

### Client — `apps/mobile/components/feature/censo/QuestionCard.tsx`
- A locked question keeps the "En uso" indicator for type/option edits, but
  now also renders the trash button (currently it shows *only* "En uso").
- Delete handler:
  - locked / answered (count > 0) → `showConfirm` (cross-platform; web no-op
    safe) with a body naming the count, then `onRemove`.
  - not answered → `onRemove` directly (unchanged).

### i18n — `packages/i18n/messages/es.json`
Add under `censo.builder`:
- `deleteAnsweredTitle`: e.g. "Eliminar pregunta"
- `deleteAnsweredBody`: ICU plural on count, e.g.
  "{count, plural, one {# vecino ha respondido} other {# vecinos han respondido}} esta pregunta. Si la eliminas, se borrarán sus respuestas."

## Error handling
- The batch is atomic: schema change and answer deletions land together or not
  at all.
- No silent fallback: validation errors keep their existing `HttpsError` codes;
  the client surfaces `saveError` on screen as today.

## Testing (RED first)
1. `functions/src/__tests__/helpers/profileFormValidation.test.ts`: flip the
   existing "throws when removing an answered field" expectation to "does not
   throw"; keep the type-change and in-use-option-removal throw tests green.
2. `functions` emulator test for `updateCenso`: seed a municipality with a
   censo and a member who answered field `A` and field `B`; remove `A`; assert
   the new schema omits `A`, member's `profileAnswers.A` is gone, `B` remains.
3. Unit test for `answeredCountByKey` (pure helper over a members array).

## Out of scope
Versioning, archiving/soft-delete, editing answered questions, batch chunking
beyond 500 members.
