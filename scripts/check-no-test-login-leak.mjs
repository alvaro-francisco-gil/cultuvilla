#!/usr/bin/env node
/**
 * CI grep gate: forbid the E2E test-auth bypass from escaping its seam files.
 *
 * The web-e2e suite drives a real login without Google OAuth via a test-only
 * seam (see apps/mobile/lib/auth/AuthContext.tsx) that is gated by the
 * build-time `USE_FIREBASE_EMULATOR` flag. That flag ALSO repoints the client
 * SDK at 127.0.0.1 emulators (apps/mobile/lib/firebaseInit.ts), so the bypass
 * fails closed in any build a real user could load. This gate is the third
 * defence layer (after "one flag" and "fail-closed physics"): it makes it a
 * build failure for the flag, the emulator-connect calls, or the E2E login
 * symbol to appear anywhere in shipped app code outside the tiny allowlist.
 *
 * Detects (in scope files, outside ALLOWED_PATHS):
 *   1. `USE_FIREBASE_EMULATOR`          — the build-time bypass flag env var.
 *   2. `useEmulator`                    — its surfaced `extra.useEmulator` form.
 *   3. `connect{Auth,Firestore,Functions,Storage}Emulator` — emulator wiring.
 *   4. `__cultuvillaE2E`                — the window-exposed test-login helper.
 *
 * Scope (the code that gets bundled/deployed):
 *   - apps/mobile/**\/*.{ts,tsx}  (excluding e2e/, tests, dist, .expo)
 *   - packages/shared/src/**\/*.ts
 *   - functions/src/**\/*.ts      (excluding __tests__/)
 *
 * Excluded:
 *   - The three seam files in ALLOWED_PATHS — the only legal home.
 *   - apps/mobile/e2e/** — the Playwright suite that legitimately drives the seam.
 *   - Test files (test/, __tests__/, *.test.*) — never shipped.
 *   - Anything tagged `// test-login: allowed` on the line above.
 *
 * CI workflows (.github/workflows/*.yml) and docs are NOT scanned — they
 * reference the flag on purpose (the web-e2e job sets it; deploy jobs assert
 * it is unset).
 *
 * The pure pieces (LEAK_RULES / ALLOWED_PATHS / scanForLeaks) are exported and
 * unit-tested in packages/shared/test/validation/testLoginLeakGate.test.ts.
 * Exits 0 with "OK" if clean, 1 with violations otherwise.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

export const ALLOWLIST_COMMENT = 'test-login: allowed';

export const ALLOWED_PATHS = new Set([
  'apps/mobile/app.config.ts',
  'apps/mobile/lib/firebaseInit.ts',
  'apps/mobile/lib/auth/AuthContext.tsx',
]);

export const LEAK_RULES = [
  {
    rule: 'USE_FIREBASE_EMULATOR: E2E bypass flag; only app.config.ts may read it',
    re: /USE_FIREBASE_EMULATOR/,
  },
  {
    rule: 'useEmulator: E2E bypass flag; confined to firebaseInit.ts + AuthContext.tsx',
    re: /\buseEmulator\b/,
  },
  {
    rule: 'connect*Emulator: emulator wiring belongs only in firebaseInit.ts',
    re: /\bconnect(?:Auth|Firestore|Functions|Storage)Emulator\b/,
  },
  {
    rule: '__cultuvillaE2E: the test-login seam; confined to AuthContext.tsx',
    re: /__cultuvillaE2E/,
  },
];

export function isAllowlisted(lines, idx) {
  for (let j = idx - 1; j >= Math.max(0, idx - 3); j--) {
    if (lines[j].includes(ALLOWLIST_COMMENT)) return true;
    if (lines[j].trim() === '') continue;
    if (lines[j].trim().startsWith('//')) continue;
    return false;
  }
  return false;
}

/**
 * Pure scan over `[{ path, content }]`; returns the list of violations.
 * Separated from filesystem/git access so it is unit-testable.
 */
export function scanForLeaks(files) {
  const violations = [];
  for (const { path, content } of files) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (isAllowlisted(lines, i)) continue;
      for (const { rule, re } of LEAK_RULES) {
        if (re.test(lines[i])) {
          violations.push({ path, line: i + 1, rule, excerpt: lines[i].trim() });
        }
      }
    }
  }
  return violations;
}

function listScopeFiles() {
  const out = execSync(
    `git ls-files -- 'apps/mobile/**/*.ts' 'apps/mobile/**/*.tsx' 'packages/shared/src/**/*.ts' 'functions/src/**/*.ts'`,
    { cwd: repoRoot, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !ALLOWED_PATHS.has(p))
    .filter((p) => !p.startsWith('apps/mobile/e2e/'))
    .filter((p) => !p.includes('__tests__/'))
    .filter((p) => !p.includes('/test/'))
    .filter((p) => !/\.test\.[cm]?tsx?$/.test(p))
    .filter((p) => !p.endsWith('.d.ts'));
}

async function main() {
  const files = [];
  for (const path of listScopeFiles()) {
    files.push({ path, content: await readFile(join(repoRoot, path), 'utf8') });
  }
  const violations = scanForLeaks(files);

  if (violations.length === 0) {
    console.log('OK — no E2E test-login bypass symbols outside their seam files');
    process.exit(0);
  }

  console.error(`Found ${violations.length} test-login leak violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.path}:${v.line}`);
    console.error(`    rule: ${v.rule}`);
    console.error(`    code: ${v.excerpt}`);
    console.error('');
  }
  console.error('The E2E emulator/fixture-login seam must stay confined to:');
  for (const p of ALLOWED_PATHS) console.error(`  - ${p}`);
  console.error('If a line is a genuine exception, add `// test-login: allowed` above it.');
  process.exit(1);
}

// Run the CLI only when invoked directly, not when imported by the test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
