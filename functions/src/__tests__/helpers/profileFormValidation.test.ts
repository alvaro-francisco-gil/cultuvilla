import { describe, it, expect } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  ensureValidFieldShape,
  validateTransition,
  type ProfileFormField,
  type PrevField,
} from '../../helpers/profileFormValidation';

const predefined = (key: string, required = true): ProfileFormField => ({
  source: 'predefined',
  key,
  required,
});

const customField = (
  overrides: Partial<Extract<ProfileFormField, { source: 'custom' }>> = {},
): ProfileFormField => ({
  source: 'custom',
  key: 'occupation',
  label: 'Ocupación',
  type: 'text',
  required: false,
  ...overrides,
});

function code(e: unknown): string | undefined {
  return e instanceof HttpsError ? e.code : undefined;
}

describe('ensureValidFieldShape', () => {
  it('accepts a known predefined field', () => {
    expect(() => { ensureValidFieldShape(predefined('barrio')); }).not.toThrow();
  });

  it('rejects predefined fields with unknown keys', () => {
    let caught: unknown;
    try {
      ensureValidFieldShape({ source: 'predefined', key: 'bogus', required: true });
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('invalid-argument');
  });

  it('rejects non-objects', () => {
    let caught: unknown;
    try {
      ensureValidFieldShape(null);
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('invalid-argument');
  });

  it('requires required:boolean', () => {
    let caught: unknown;
    try {
      ensureValidFieldShape({ source: 'predefined', key: 'barrio', required: 'yes' });
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('invalid-argument');
  });

  it('accepts a custom text field', () => {
    expect(() => { ensureValidFieldShape(customField()); }).not.toThrow();
  });

  it('rejects custom keys that violate the slug pattern', () => {
    let caught: unknown;
    try {
      ensureValidFieldShape(customField({ key: 'Has Spaces' }));
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('invalid-argument');
  });

  it('rejects custom select fields with no options', () => {
    let caught: unknown;
    try {
      ensureValidFieldShape(customField({ type: 'select', options: [] }));
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('invalid-argument');
  });

  it('accepts a custom select field with options', () => {
    expect(() =>
      { ensureValidFieldShape(customField({ type: 'select', options: ['a', 'b'] })); },
    ).not.toThrow();
  });

  it('rejects custom fields without a label', () => {
    let caught: unknown;
    try {
      ensureValidFieldShape({ source: 'custom', key: 'k', type: 'text', required: true });
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('invalid-argument');
  });
});

describe('validateTransition', () => {
  const noUsage = {} as const;

  it('allows an empty → empty transition', () => {
    expect(() => { validateTransition([], [], noUsage); }).not.toThrow();
  });

  it('allows adding a brand new field', () => {
    expect(() => { validateTransition([], [predefined('barrio')], noUsage); }).not.toThrow();
  });

  it('rejects duplicate keys in the next form', () => {
    let caught: unknown;
    try {
      validateTransition([], [predefined('barrio'), predefined('barrio', false)], noUsage);
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('failed-precondition');
    expect((caught as HttpsError).message).toMatch(/duplicada/);
  });

  it('allows removing a field that no member has answered', () => {
    const prev: PrevField[] = [{ source: 'predefined', key: 'barrio' }];
    expect(() => { validateTransition(prev, [], noUsage); }).not.toThrow();
  });

  it('rejects removing a field that members have already answered', () => {
    const prev: PrevField[] = [{ source: 'predefined', key: 'barrio' }];
    const used = { barrio: new Set(['Centro']) };
    let caught: unknown;
    try {
      validateTransition(prev, [], used);
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('failed-precondition');
    expect((caught as HttpsError).message).toMatch(/eliminar el campo "barrio"/);
  });

  it('rejects changing the source of an existing field', () => {
    const prev: PrevField[] = [{ source: 'predefined', key: 'barrio' }];
    const next: ProfileFormField[] = [customField({ key: 'barrio', label: 'Barrio' })];
    let caught: unknown;
    try {
      validateTransition(prev, next, noUsage);
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('failed-precondition');
    expect((caught as HttpsError).message).toMatch(/origen/);
  });

  it('rejects changing the type of an existing custom field', () => {
    const prev: PrevField[] = [{ source: 'custom', key: 'occupation', type: 'text' }];
    const next: ProfileFormField[] = [customField({ key: 'occupation', type: 'number' })];
    let caught: unknown;
    try {
      validateTransition(prev, next, noUsage);
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('failed-precondition');
    expect((caught as HttpsError).message).toMatch(/tipo/);
  });

  it('rejects removing a select option that members have already chosen', () => {
    const prev: PrevField[] = [
      { source: 'custom', key: 'occupation', type: 'select', options: ['agri', 'pesca'] },
    ];
    const next: ProfileFormField[] = [
      customField({ key: 'occupation', type: 'select', options: ['agri'] }),
    ];
    const used = { occupation: new Set(['pesca']) };
    let caught: unknown;
    try {
      validateTransition(prev, next, used);
    } catch (e) {
      caught = e;
    }
    expect(code(caught)).toBe('failed-precondition');
    expect((caught as HttpsError).message).toMatch(/eliminar la opción "pesca"/);
  });

  it('allows removing a select option that no member has chosen', () => {
    const prev: PrevField[] = [
      { source: 'custom', key: 'occupation', type: 'select', options: ['agri', 'pesca'] },
    ];
    const next: ProfileFormField[] = [
      customField({ key: 'occupation', type: 'select', options: ['agri'] }),
    ];
    expect(() => { validateTransition(prev, next, noUsage); }).not.toThrow();
  });
});
