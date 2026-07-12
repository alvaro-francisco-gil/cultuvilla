import { describe, it, expect } from 'vitest';
import {
  getMessages,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
} from '../index';

/**
 * Flatten a nested catalog to a map of dotted leaf paths -> string values.
 * Non-string leaves are surfaced by `flattenWithTypes`; here we keep only the
 * shape the app actually resolves (dotted path -> string).
 */
function flatten(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, path);
      } else if (typeof value === 'string') {
        out[path] = value;
      }
    }
  };
  walk(obj, '');
  return out;
}

/** Every leaf path with a flag for whether it is a string leaf. */
function flattenWithTypes(
  obj: Record<string, unknown>,
): Array<{ path: string; isString: boolean; isEmpty: boolean }> {
  const out: Array<{ path: string; isString: boolean; isEmpty: boolean }> = [];
  const walk = (node: Record<string, unknown>, prefix: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, path);
      } else {
        const isString = typeof value === 'string';
        out.push({
          path,
          isString,
          isEmpty: isString && (value as string).trim() === '',
        });
      }
    }
  };
  walk(obj, '');
  return out;
}

describe('i18n catalog invariants', () => {
  it('DEFAULT_LOCALE is a supported locale', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('every supported locale has a non-empty catalog', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = getMessages(locale);
      expect(catalog, `getMessages('${locale}') should return an object`).toBeTypeOf(
        'object',
      );
      expect(catalog).not.toBeNull();
      expect(
        Object.keys(catalog).length,
        `catalog for '${locale}' should be non-empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('no leaf value is an empty string, and no leaf is a non-string', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const leaves = flattenWithTypes(getMessages(locale));
      const nonStrings = leaves.filter((l) => !l.isString).map((l) => l.path);
      const empties = leaves.filter((l) => l.isEmpty).map((l) => l.path);
      expect(
        nonStrings,
        `locale '${locale}' has non-string leaves: ${nonStrings.join(', ')}`,
      ).toEqual([]);
      expect(
        empties,
        `locale '${locale}' has empty-string leaves: ${empties.join(', ')}`,
      ).toEqual([]);
    }
  });

  // Trivially satisfied while only `es` exists, but the invariant that matters
  // the moment a second locale is added: every locale must expose the exact
  // same set of leaf keys as the default locale.
  it('every locale has the same leaf keys as the default locale', () => {
    const defaultKeys = new Set(Object.keys(flatten(getMessages(DEFAULT_LOCALE))));

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      const localeKeys = new Set(Object.keys(flatten(getMessages(locale as Locale))));

      const missing = [...defaultKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !defaultKeys.has(k));

      expect(
        missing,
        `locale '${locale}' is MISSING keys present in '${DEFAULT_LOCALE}': ${missing.join(', ')}`,
      ).toEqual([]);
      expect(
        extra,
        `locale '${locale}' has EXTRA keys absent from '${DEFAULT_LOCALE}': ${extra.join(', ')}`,
      ).toEqual([]);
    }
  });
});
