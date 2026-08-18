import { z } from 'zod';

/**
 * Creator-defined sign-up fields. An event carries a list of these specs; each
 * person signed up answers all of them (they are per-attendee, not per-signup —
 * the event's `telephoneRequired` phone remains the one shared value).
 *
 * Answers never land on the public registration doc; they go to the gated
 * `events/{eventId}/registrationPrivate/{regId}` doc alongside the phone.
 */

export const SignupFieldTypeSchema = z.enum(['text', 'number', 'date', 'select', 'checkbox']);
export type SignupFieldType = z.infer<typeof SignupFieldTypeSchema>;

/** Caps are re-checked in firestore.rules; keep the two in step. */
export const MAX_SIGNUP_FIELDS = 10;
export const MAX_SIGNUP_FIELD_OPTIONS = 20;
export const MAX_SIGNUP_LABEL_LENGTH = 60;
export const MAX_SIGNUP_ANSWER_LENGTH = 200;

export const SignupFieldSpecSchema = z.object({
  // Stable key, generated on add and never reused. Answers are stored under it,
  // so relabeling a field must not strand what has already been collected.
  id: z.string().min(1),
  label: z.string().min(1).max(MAX_SIGNUP_LABEL_LENGTH),
  type: SignupFieldTypeSchema,
  required: z.boolean(),
  // Only meaningful for type 'select'. Not schema-refined to non-empty: an
  // options list is built up one entry at a time in the editor, so the
  // "a select needs at least one option" check is isUsableSignupField, applied
  // when the creator submits rather than on every parse.
  options: z.array(z.string().min(1)).max(MAX_SIGNUP_FIELD_OPTIONS).default([]),
});
export type SignupFieldSpec = z.infer<typeof SignupFieldSpecSchema>;

export const SignupFieldsSchema = z.array(SignupFieldSpecSchema).max(MAX_SIGNUP_FIELDS).default([]);

export const SignupAnswerValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type SignupAnswerValue = z.infer<typeof SignupAnswerValueSchema>;

export const SignupAnswersSchema = z.record(z.string(), SignupAnswerValueSchema);
export type SignupAnswers = z.infer<typeof SignupAnswersSchema>;

/** A field id generated client-side when the creator adds a row. */
export function makeSignupFieldId(): string {
  return `f_${Math.random().toString(36).slice(2, 10)}`;
}

export type SignupAnswerError =
  | 'required'
  | 'not-a-number'
  | 'not-a-date'
  | 'not-a-boolean'
  | 'not-an-option'
  | 'too-long'
  | 'unknown-field'
  | 'too-many';

export type SignupAnswerValidation =
  | { ok: true; value: SignupAnswers }
  | { ok: false; fieldId: string; reason: SignupAnswerError };

/** A select spec is only usable once it has at least one option to pick. */
export function isUsableSignupField(field: SignupFieldSpec): boolean {
  if (field.type !== 'select') return true;
  return field.options.length > 0;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

// Accepts the ISO date strings the date picker produces ('2026-08-18' or a full
// ISO instant). Stored as a string so the answer map stays a flat primitive map.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

/**
 * The single implementation of "are these answers valid for these fields",
 * shared by the sign-up sheet (to gate the confirm button) and by
 * `registerToEvent` (which is the authority — the client check is convenience).
 *
 * Unknown keys are rejected rather than dropped: a stale client sending answers
 * for a field the creator removed should surface as an error, not silently lose
 * data the attendee typed.
 */
export function validateSignupAnswers(
  fields: SignupFieldSpec[],
  answers: Record<string, unknown> | undefined,
): SignupAnswerValidation {
  const given = answers ?? {};
  const known = new Map(fields.map((f) => [f.id, f]));

  if (Object.keys(given).length > MAX_SIGNUP_FIELDS) {
    return { ok: false, fieldId: '', reason: 'too-many' };
  }
  for (const key of Object.keys(given)) {
    if (!known.has(key)) return { ok: false, fieldId: key, reason: 'unknown-field' };
  }

  const value: SignupAnswers = {};
  for (const field of fields) {
    const raw = given[field.id];

    if (isBlank(raw)) {
      if (field.required) return { ok: false, fieldId: field.id, reason: 'required' };
      continue;
    }

    switch (field.type) {
      case 'text': {
        const text = String(raw).trim();
        if (text.length > MAX_SIGNUP_ANSWER_LENGTH) {
          return { ok: false, fieldId: field.id, reason: 'too-long' };
        }
        value[field.id] = text;
        break;
      }
      case 'number': {
        // The form holds numeric input as a string; accept both shapes but
        // always store a number so organizers can sort/aggregate later.
        const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
        if (!Number.isFinite(num)) return { ok: false, fieldId: field.id, reason: 'not-a-number' };
        value[field.id] = num;
        break;
      }
      case 'date': {
        const text = String(raw).trim();
        if (!ISO_DATE.test(text) || Number.isNaN(Date.parse(text))) {
          return { ok: false, fieldId: field.id, reason: 'not-a-date' };
        }
        value[field.id] = text;
        break;
      }
      case 'select': {
        const text = String(raw);
        if (!field.options.includes(text)) {
          return { ok: false, fieldId: field.id, reason: 'not-an-option' };
        }
        value[field.id] = text;
        break;
      }
      case 'checkbox': {
        if (typeof raw !== 'boolean') {
          return { ok: false, fieldId: field.id, reason: 'not-a-boolean' };
        }
        // A required checkbox means "must be ticked" (consent), not "must be present".
        if (field.required && !raw) return { ok: false, fieldId: field.id, reason: 'required' };
        value[field.id] = raw;
        break;
      }
    }
  }

  return { ok: true, value };
}

/**
 * Guards the creator's edit path: once an event has sign-ups the field list is
 * additive-only, because answers are already keyed by the existing ids and a
 * type change would leave the collected values mismatched against their spec.
 *
 * firestore.rules can only enforce the size half of this (no loops), so this is
 * the full check — see docs/plans/ready/event-signup-parameters.md §4.
 */
export function isAdditiveSignupFieldChange(
  before: SignupFieldSpec[],
  after: SignupFieldSpec[],
): boolean {
  if (after.length < before.length) return false;
  // Compared as joined keys rather than by index: identity is (id, type), and
  // the leading slice of `after` must reproduce `before` exactly — same fields,
  // same order, same types. Anything appended past that is free.
  const identity = (fields: SignupFieldSpec[]) => fields.map((f) => `${f.id}:${f.type}`).join('|');
  return identity(before) === identity(after.slice(0, before.length));
}
