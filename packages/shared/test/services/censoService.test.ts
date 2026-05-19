import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ db: {}, functions: {} }));

import {
  missingRequiredAnswers,
  isCensoComplete,
  validateSchemaTransition,
} from '../../src/services/censoService';
import type { ProfileFormField } from '../../src/models/municipality/CensoTypes';

describe('missingRequiredAnswers', () => {
  const fields: ProfileFormField[] = [
    { source: 'predefined', key: 'barrio', required: true },
    { source: 'predefined', key: 'householdSize', required: false },
    { source: 'custom', key: 'has_dog', label: 'Has dog?', type: 'boolean', required: true },
  ];

  it('returns required keys with missing answers', () => {
    expect(missingRequiredAnswers(fields, {})).toEqual(['barrio', 'has_dog']);
  });

  it('treats empty string as missing', () => {
    expect(
      missingRequiredAnswers(fields, { barrio: '   ', has_dog: false }),
    ).toEqual(['barrio']);
  });

  it('treats empty array as missing', () => {
    const f: ProfileFormField[] = [
      { source: 'custom', key: 'tags', label: 'Tags', type: 'multiselect', options: ['a'], required: true },
    ];
    expect(missingRequiredAnswers(f, { tags: [] })).toEqual(['tags']);
  });

  it('treats false as a valid answer (boolean fields)', () => {
    expect(
      missingRequiredAnswers(fields, { barrio: 'Centro', has_dog: false }),
    ).toEqual([]);
  });

  it('treats 0 as a valid answer (number fields)', () => {
    const f: ProfileFormField[] = [
      { source: 'predefined', key: 'arrivalYear', required: true },
    ];
    expect(missingRequiredAnswers(f, { arrivalYear: 0 })).toEqual([]);
  });

  it('ignores non-required fields', () => {
    expect(
      missingRequiredAnswers(fields, { barrio: 'Centro', has_dog: true }),
    ).toEqual([]);
  });
});

describe('isCensoComplete', () => {
  it('returns true when no required fields are missing', () => {
    const fields: ProfileFormField[] = [
      { source: 'predefined', key: 'barrio', required: true },
    ];
    expect(isCensoComplete(fields, { barrio: 'Centro' })).toBe(true);
  });

  it('returns false when a required field is missing', () => {
    const fields: ProfileFormField[] = [
      { source: 'predefined', key: 'barrio', required: true },
    ];
    expect(isCensoComplete(fields, {})).toBe(false);
  });

  it('returns true when schema has no required fields, even with no answers', () => {
    const fields: ProfileFormField[] = [
      { source: 'predefined', key: 'barrio', required: false },
    ];
    expect(isCensoComplete(fields, {})).toBe(true);
  });
});

describe('validateSchemaTransition', () => {
  it('returns ok=true for an identical schema with no answers', () => {
    const schema: ProfileFormField[] = [
      { source: 'predefined', key: 'barrio', required: true },
    ];
    const r = validateSchemaTransition(schema, schema, {});
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('flags duplicate keys in the next schema', () => {
    const next: ProfileFormField[] = [
      { source: 'predefined', key: 'barrio', required: true },
      { source: 'predefined', key: 'barrio', required: false },
    ];
    const r = validateSchemaTransition([], next, {});
    expect(r.ok).toBe(false);
    expect(r.violations).toContainEqual({ code: 'duplicate_key', fieldKey: 'barrio' });
  });

  it('flags unknown predefined keys', () => {
    const next: ProfileFormField[] = [
      { source: 'predefined', key: 'unknownKey', required: false },
    ];
    const r = validateSchemaTransition([], next, {});
    expect(r.violations).toContainEqual({ code: 'unknown_predefined', fieldKey: 'unknownKey' });
  });

  it('flags invalid custom keys (non-snake_case)', () => {
    const next: ProfileFormField[] = [
      { source: 'custom', key: 'Bad Key', label: 'x', type: 'text', required: false },
    ];
    const r = validateSchemaTransition([], next, {});
    expect(r.violations).toContainEqual({ code: 'invalid_custom_key', fieldKey: 'Bad Key' });
  });

  it('flags removing a field that has answers', () => {
    const prev: ProfileFormField[] = [
      { source: 'custom', key: 'has_dog', label: 'Has dog?', type: 'boolean', required: false },
    ];
    const r = validateSchemaTransition(prev, [], { has_dog: new Set([true]) });
    expect(r.violations).toContainEqual({ code: 'field_removed_with_answers', fieldKey: 'has_dog' });
  });

  it('allows removing a field with no answers', () => {
    const prev: ProfileFormField[] = [
      { source: 'custom', key: 'has_dog', label: 'Has dog?', type: 'boolean', required: false },
    ];
    const r = validateSchemaTransition(prev, [], {});
    expect(r.ok).toBe(true);
  });

  it('flags changing source between predefined and custom', () => {
    const prev: ProfileFormField[] = [
      { source: 'predefined', key: 'barrio', required: false },
    ];
    const next: ProfileFormField[] = [
      { source: 'custom', key: 'barrio', label: 'Barrio', type: 'text', required: false },
    ];
    const r = validateSchemaTransition(prev, next, {});
    expect(r.violations).toContainEqual({ code: 'source_changed', fieldKey: 'barrio' });
  });

  it('flags changing type on a custom field', () => {
    const prev: ProfileFormField[] = [
      { source: 'custom', key: 'x', label: 'X', type: 'text', required: false },
    ];
    const next: ProfileFormField[] = [
      { source: 'custom', key: 'x', label: 'X', type: 'number', required: false },
    ];
    const r = validateSchemaTransition(prev, next, {});
    expect(r.violations).toContainEqual({ code: 'type_changed', fieldKey: 'x' });
  });

  it('flags removing a select option that has answers', () => {
    const prev: ProfileFormField[] = [
      {
        source: 'custom',
        key: 'color',
        label: 'Color',
        type: 'select',
        options: ['red', 'blue'],
        required: false,
      },
    ];
    const next: ProfileFormField[] = [
      {
        source: 'custom',
        key: 'color',
        label: 'Color',
        type: 'select',
        options: ['blue'],
        required: false,
      },
    ];
    const r = validateSchemaTransition(prev, next, { color: new Set(['red']) });
    expect(r.violations).toContainEqual({
      code: 'option_removed_with_answers',
      fieldKey: 'color',
      detail: 'red',
    });
  });

  it('allows removing an unused option', () => {
    const prev: ProfileFormField[] = [
      {
        source: 'custom',
        key: 'color',
        label: 'Color',
        type: 'select',
        options: ['red', 'blue'],
        required: false,
      },
    ];
    const next: ProfileFormField[] = [
      {
        source: 'custom',
        key: 'color',
        label: 'Color',
        type: 'select',
        options: ['blue'],
        required: false,
      },
    ];
    const r = validateSchemaTransition(prev, next, { color: new Set(['blue']) });
    expect(r.ok).toBe(true);
  });
});
