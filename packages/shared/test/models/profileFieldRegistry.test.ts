import { describe, it, expect } from 'vitest';
import {
  PREDEFINED_FIELDS,
  isPredefinedFieldKey,
  getPredefinedField,
  listPredefinedFields,
} from '../../src/models/municipality/profileFieldRegistry';

describe('isPredefinedFieldKey', () => {
  it('recognizes built-in keys', () => {
    expect(isPredefinedFieldKey('barrio')).toBe(true);
    expect(isPredefinedFieldKey('residencyType')).toBe(true);
    expect(isPredefinedFieldKey('householdSize')).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(isPredefinedFieldKey('not_a_field')).toBe(false);
    expect(isPredefinedFieldKey('')).toBe(false);
  });
});

describe('getPredefinedField', () => {
  it('returns the definition for a known key', () => {
    const f = getPredefinedField('residencyType');
    expect(f).not.toBeNull();
    expect(f!.type).toBe('select');
    expect(f!.options).toEqual(['permanente', 'veraneante', 'visitante']);
  });

  it('returns null for unknown key', () => {
    expect(getPredefinedField('nope')).toBeNull();
  });
});

describe('listPredefinedFields', () => {
  it('returns all entries from PREDEFINED_FIELDS', () => {
    const list = listPredefinedFields();
    expect(list).toHaveLength(Object.keys(PREDEFINED_FIELDS).length);
    expect(list.map((f) => f.key).sort()).toEqual(
      Object.keys(PREDEFINED_FIELDS).sort(),
    );
  });
});
