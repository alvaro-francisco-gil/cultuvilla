import { describe, it, expect } from 'vitest';
import {
  FieldTypeSchema,
  ProfileFormFieldSchema,
  VillageProfileFormSchema,
  ProfileAnswersSchema,
} from '../../../src/models/municipality/CensoTypes';

describe('FieldTypeSchema', () => {
  it('accepts known field types', () => {
    expect(() => FieldTypeSchema.parse('text')).not.toThrow();
    expect(() => FieldTypeSchema.parse('date')).not.toThrow();
  });

  it('rejects unknown field types', () => {
    expect(() => FieldTypeSchema.parse('email')).toThrow();
  });
});

describe('ProfileFormFieldSchema', () => {
  it('parses a predefined field', () => {
    expect(() =>
      ProfileFormFieldSchema.parse({
        source: 'predefined',
        key: 'barrio',
        required: true,
      }),
    ).not.toThrow();
  });

  it('parses a custom field with options', () => {
    expect(() =>
      ProfileFormFieldSchema.parse({
        source: 'custom',
        key: 'origen',
        label: 'Pueblo de origen',
        type: 'select',
        options: ['A', 'B'],
        required: false,
      }),
    ).not.toThrow();
  });

  it('rejects a custom field missing a label', () => {
    expect(() =>
      ProfileFormFieldSchema.parse({
        source: 'custom',
        key: 'origen',
        type: 'text',
        required: false,
      }),
    ).toThrow();
  });

  it('rejects an unknown source discriminator', () => {
    expect(() =>
      ProfileFormFieldSchema.parse({
        source: 'other',
        key: 'x',
        required: true,
      }),
    ).toThrow();
  });
});

describe('VillageProfileFormSchema', () => {
  it('parses a valid form', () => {
    expect(() =>
      VillageProfileFormSchema.parse({
        fields: [
          { source: 'predefined', key: 'barrio', required: true },
        ],
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    ).not.toThrow();
  });

  it('rejects missing updatedAt', () => {
    expect(() =>
      VillageProfileFormSchema.parse({ fields: [] }),
    ).toThrow();
  });
});

describe('ProfileAnswersSchema', () => {
  it('accepts string, number, boolean, and string[] values', () => {
    expect(() =>
      ProfileAnswersSchema.parse({
        a: 'x',
        b: 1,
        c: true,
        d: ['x', 'y'],
      }),
    ).not.toThrow();
  });

  it('rejects unsupported value types', () => {
    expect(() => ProfileAnswersSchema.parse({ a: { nested: true } })).toThrow();
  });
});
