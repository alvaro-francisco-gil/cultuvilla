/**
 * The marketing version in `apps/mobile/app.config.ts` is the single source of
 * truth for the app's version (AGENTS.md "Versioning & releases"). Anything
 * that needs to know it reads it from here rather than hardcoding a constant
 * that silently goes stale.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const APP_CONFIG_PATH = path.join(REPO_ROOT, 'apps/mobile/app.config.ts');

/**
 * Extract the single top-level `version: '...'` from an app.config.ts source.
 * Throws when absent or ambiguous rather than guessing — picking the wrong
 * match would silently publish a wrong version.
 */
export function extractVersion(source, label = 'app.config.ts') {
  const matches = [...source.matchAll(/^\s*version:\s*['"]([^'"]+)['"]/gm)];
  if (matches.length === 0) throw new Error(`No \`version:\` line found in ${label}`);
  if (matches.length > 1) {
    throw new Error(`Ambiguous: ${matches.length} \`version:\` lines in ${label} — tighten the matcher.`);
  }
  return matches[0][1];
}

/** Read the version out of an app.config.ts on disk. */
export function readVersionFrom(filePath) {
  return extractVersion(readFileSync(filePath, 'utf8'), filePath);
}

/** The current app version from apps/mobile/app.config.ts. */
export function currentAppVersion() {
  return readVersionFrom(APP_CONFIG_PATH);
}
