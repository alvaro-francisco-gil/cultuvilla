import { describe, it, expect } from 'vitest';
import { slugifyFieldKey } from '../../src/models/municipality/CensoTypes';

describe('slugifyFieldKey', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slugifyFieldKey('Pueblo de origen')).toBe('pueblo_de_origen');
  });

  it('strips diacritics', () => {
    expect(slugifyFieldKey('Año de llegada')).toBe('ano_de_llegada');
  });

  it('collapses repeated non-alphanumerics to a single underscore', () => {
    expect(slugifyFieldKey('a   b!!!c')).toBe('a_b_c');
  });

  it('trims leading and trailing underscores', () => {
    expect(slugifyFieldKey('   foo bar   ')).toBe('foo_bar');
    expect(slugifyFieldKey('---hello---')).toBe('hello');
  });

  it('truncates to 40 characters', () => {
    const long = 'a'.repeat(60);
    expect(slugifyFieldKey(long).length).toBe(40);
  });

  it('returns empty string for input with no alphanumerics', () => {
    expect(slugifyFieldKey('!!!')).toBe('');
  });
});
