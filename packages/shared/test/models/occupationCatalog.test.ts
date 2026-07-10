import { describe, it, expect } from 'vitest';
import {
  OCCUPATION_CATALOG,
  isCatalogOccupation,
  occupationI18nKey,
} from '../../src/models/occupation/occupationCatalog';
import esMessages from '../../../i18n/messages/es.json';

const KEBAB_CASE = /^[a-z]+(-[a-z]+)*$/;

describe('OCCUPATION_CATALOG', () => {
  it('is non-empty', () => {
    expect(OCCUPATION_CATALOG.length).toBeGreaterThan(0);
  });

  it('has unique keys', () => {
    expect(new Set(OCCUPATION_CATALOG).size).toBe(OCCUPATION_CATALOG.length);
  });

  it('has lowercase-kebab-case keys only', () => {
    for (const key of OCCUPATION_CATALOG) {
      expect(key).toMatch(KEBAB_CASE);
    }
  });
});

describe('isCatalogOccupation', () => {
  it('returns true for a catalog key', () => {
    expect(isCatalogOccupation('profesor')).toBe(true);
  });

  it('returns false for a non-catalog value', () => {
    expect(isCatalogOccupation('astronaut-xyz')).toBe(false);
  });
});

describe('occupationI18nKey', () => {
  it('builds the namespaced i18n key', () => {
    expect(occupationI18nKey('profesor')).toBe('occupations.catalog.profesor');
  });
});

describe('es.json labels', () => {
  it('has a label for every catalog key', () => {
    const catalog = (esMessages as Record<string, unknown>).occupations as
      | { catalog?: Record<string, unknown> }
      | undefined;
    const labels = catalog?.catalog ?? {};

    for (const key of OCCUPATION_CATALOG) {
      expect(typeof labels[key]).toBe('string');
      expect((labels[key] as string).length).toBeGreaterThan(0);
    }
  });
});
