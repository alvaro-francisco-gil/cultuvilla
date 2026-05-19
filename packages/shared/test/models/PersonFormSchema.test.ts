import { describe, it, expect } from 'vitest';
import { PersonFormSchema, assemblePartialDate } from '../../src/models/person/PersonFormSchema';

const validBase = {
  givenName: 'Juan',
  middleNames: '',
  firstSurname: '',
  secondSurname: '',
  nickname: '',
  sex: '' as const,
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  deathYear: '',
  deathMonth: '',
  deathDay: '',
  biography: '',
};

describe('PersonFormSchema', () => {
  it('parses a minimal valid input', () => {
    const result = PersonFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.givenName).toBe('Juan');
    expect(result.data.firstSurname).toBeNull();
    expect(result.data.sex).toBeNull();
    expect(result.data.middleNames).toEqual([]);
  });

  it('rejects a missing givenName', () => {
    const result = PersonFormSchema.safeParse({ ...validBase, givenName: '   ' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const err = result.error.issues.find((i) => i.path[0] === 'givenName');
    expect(err?.message).toBe('El nombre es obligatorio');
  });

  it('splits middleNames on commas and trims', () => {
    const result = PersonFormSchema.safeParse({
      ...validBase,
      middleNames: ' Carlos , María ,, José ',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.middleNames).toEqual(['Carlos', 'María', 'José']);
  });

  it('accepts valid sex enum and rejects unknown', () => {
    const ok = PersonFormSchema.safeParse({ ...validBase, sex: 'female' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.sex).toBe('female');

    const bad = PersonFormSchema.safeParse({ ...validBase, sex: 'mystery' });
    expect(bad.success).toBe(false);
  });

  it('rejects out-of-range month', () => {
    const result = PersonFormSchema.safeParse({ ...validBase, birthMonth: '13' });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range day', () => {
    const result = PersonFormSchema.safeParse({ ...validBase, birthDay: '32' });
    expect(result.success).toBe(false);
  });

  it('parses partial-date values as numbers', () => {
    const result = PersonFormSchema.safeParse({
      ...validBase,
      birthYear: '1980',
      birthMonth: '6',
      birthDay: '15',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.birthYear).toBe(1980);
    expect(result.data.birthMonth).toBe(6);
    expect(result.data.birthDay).toBe(15);
  });

  it('keeps empty date parts as null', () => {
    const result = PersonFormSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.birthYear).toBeNull();
    expect(result.data.birthMonth).toBeNull();
    expect(result.data.birthDay).toBeNull();
  });

  it('trims surnames and biography, null when empty', () => {
    const ok = PersonFormSchema.safeParse({
      ...validBase,
      firstSurname: '  García  ',
      biography: '  Una vida tranquila  ',
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.firstSurname).toBe('García');
    expect(ok.data.biography).toBe('Una vida tranquila');
    expect(ok.data.secondSurname).toBeNull();
  });
});

describe('assemblePartialDate', () => {
  it('returns null when all parts are null', () => {
    expect(assemblePartialDate(null, null, null)).toBeNull();
  });

  it('returns a PartialDate when at least one part is set', () => {
    expect(assemblePartialDate(1990, null, null)).toEqual({ year: 1990, month: null, day: null });
    expect(assemblePartialDate(null, 6, 15)).toEqual({ year: null, month: 6, day: 15 });
  });
});
