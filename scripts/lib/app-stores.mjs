/**
 * Reads the store URLs out of `apps/mobile/lib/appStores.ts` — the single
 * source of truth for where the native apps live — so a Node script can check
 * them without a TypeScript toolchain.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const APP_STORES_PATH = path.join(REPO_ROOT, 'apps/mobile/lib/appStores.ts');

/**
 * The URL for one platform key (`ios` | `android`), or `''` when it has no
 * listing yet. A matcher that silently returns `''` reads exactly like "not
 * shipped", which is how a broken one went unnoticed — hence the real-file test.
 */
export function storeUrlFrom(source, key) {
  return source.match(new RegExp(`^\\s*${key}:\\s*'([^']*)'`, 'm'))?.[1] ?? '';
}

export function currentStoreUrl(key) {
  return storeUrlFrom(readFileSync(APP_STORES_PATH, 'utf8'), key);
}
