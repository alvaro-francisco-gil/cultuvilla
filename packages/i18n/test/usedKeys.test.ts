import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessages, DEFAULT_LOCALE } from '../index';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/i18n/test -> repo root -> apps/mobile
const MOBILE_ROOT = join(HERE, '..', '..', '..', 'apps', 'mobile');

const SKIP_DIRS = new Set([
  'node_modules',
  '.expo',
  '.expo-shared',
  'dist',
  'build',
  '__tests__',
  '__mocks__',
  'test',
  'coverage',
]);

const SOURCE_EXT = /\.(ts|tsx)$/;

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...walk(join(dir, entry.name)));
    } else if (SOURCE_EXT.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

/** Resolve a dotted key against a nested catalog; string leaf or undefined. */
function resolveKey(catalog: Record<string, unknown>, key: string): string | undefined {
  let current: unknown = catalog;
  for (const seg of key.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return typeof current === 'string' ? current : undefined;
}

// Standalone `t(` calls only: `\b` before a lowercase `t` excludes `useT(`,
// `format(`, `parseInt(`, etc. (those have no word boundary before the `t`).
const STATIC_KEY_RE = /\bt\(\s*(['"])((?:[^'"\\]|\\.)*)\1/g;
// Same call shape but the first argument is a template literal or an
// identifier/expression — a key we cannot resolve statically.
const DYNAMIC_KEY_RE = /\bt\(\s*[`$A-Za-z_]/g;

interface Extraction {
  staticKeys: Set<string>;
  dynamicCount: number;
}

function extract(files: string[]): Extraction {
  const staticKeys = new Set<string>();
  let dynamicCount = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(STATIC_KEY_RE)) {
      staticKeys.add(m[2]);
    }
    for (const _ of src.matchAll(DYNAMIC_KEY_RE)) {
      dynamicCount += 1;
    }
  }
  return { staticKeys, dynamicCount };
}

describe('mobile app translation keys resolve against the catalog', () => {
  const files = walk(MOBILE_ROOT);
  const { staticKeys, dynamicCount } = extract(files);
  const catalog = getMessages(DEFAULT_LOCALE);

  it('scanned source files and found translation-key literals', () => {
    // Guard against a broken regex / wrong path silently passing by matching
    // nothing.
    expect(files.length, `no source files found under ${MOBILE_ROOT}`).toBeGreaterThan(
      0,
    );
    expect(
      staticKeys.size,
      'no static t(\'...\') keys extracted — the regex or path is likely wrong',
    ).toBeGreaterThan(0);
  });

  it('every statically-used key resolves in the default-locale catalog', () => {
    if (dynamicCount > 0) {
      // Dynamically-constructed keys can't be checked statically; report, skip.
      // eslint-disable-next-line no-console
      console.warn(
        `[usedKeys] skipped ${dynamicCount} dynamically-constructed t(...) call(s) — not statically verifiable`,
      );
    }

    const missing = [...staticKeys]
      .filter((key) => resolveKey(catalog, key) === undefined)
      .sort();

    expect(
      missing,
      `keys used in apps/mobile but MISSING from the '${DEFAULT_LOCALE}' catalog:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });
});
