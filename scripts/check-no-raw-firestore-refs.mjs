#!/usr/bin/env node
/**
 * CI grep gate: forbid raw Firestore ref construction outside the typed-ref
 * factories in `packages/shared/src/firebase/refs/`. Without this gate the
 * typed-converter discipline rots one PR at a time — someone adds a
 * `db.collection('users')` in a new service, the converter is bypassed, and
 * we're back to untyped reads.
 *
 * Detects (in scope files):
 *   1. `collection(getDb(), '...')` / `collection(db, '...')`
 *      — client SDK call sites that should use a typed factory.
 *   2. `doc(getDb(), '...', ...)` / `doc(db, '...', ...)` with a string-literal
 *      collection segment — same problem on the doc side.
 *   3. `db.collection('...')` / `firestore.collection('...')` — admin SDK.
 *   4. `db.doc('a/b')` — admin SDK doc path with literal.
 *
 * Scope (default):
 *   - packages/shared/src/services/**\/*.ts
 *   - functions/src/**\/*.ts (excluding __tests__/)
 *
 * Excluded:
 *   - packages/shared/src/firebase/refs/{client,admin}.ts — the only legal
 *     home for these calls.
 *   - Test files (test/ and __tests__/) — seed code often needs raw refs.
 *   - Anything tagged `// typed-refs: allowed` on the line above.
 *
 * Exits 0 with "OK" if clean, 1 with violations otherwise.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const ALLOWLIST_COMMENT = 'typed-refs: allowed';

const ALLOWED_PATHS = new Set([
  'packages/shared/src/firebase/refs/client.ts',
  'packages/shared/src/firebase/refs/admin.ts',
]);

function listScopeFiles() {
  const out = execSync(
    `git ls-files -- 'packages/shared/src/services/*.ts' 'packages/shared/src/services/**/*.ts' 'functions/src/**/*.ts'`,
    { cwd: repoRoot, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !ALLOWED_PATHS.has(p))
    .filter((p) => !p.includes('__tests__/'))
    .filter((p) => !p.endsWith('.d.ts'));
}

function isAllowlisted(lines, idx) {
  for (let j = idx - 1; j >= Math.max(0, idx - 3); j--) {
    if (lines[j].includes(ALLOWLIST_COMMENT)) return true;
    if (lines[j].trim() === '') continue;
    if (lines[j].trim().startsWith('//')) continue;
    return false;
  }
  return false;
}

// Patterns paired with `doc(getDb(), '...')` that are intentionally untyped:
// updateDoc and batch.update both bypass the converter at the SDK level, so
// the converter-bound ref provides no benefit (and rejects the partial-payload
// + FieldValue + dot-path shapes these calls need).
const ALLOWED_PAIRINGS = /\b(?:updateDoc\s*\(\s*doc\s*\(|\w+\.update\s*\(\s*(?:doc|db\.doc)\s*\()/;

const RULES = [
  {
    rule: 'collection(getDb(), "..."): use a typed factory in firebase/refs/',
    re: /\bcollection\s*\(\s*(?:getDb\s*\(\s*\)|db|firestore)\s*,\s*['"`]/,
  },
  {
    rule: 'doc(getDb(), "...", ...): use a typed factory in firebase/refs/',
    re: /\bdoc\s*\(\s*(?:getDb\s*\(\s*\)|db|firestore)\s*,\s*['"`]/,
    allowPairing: true,
  },
  {
    rule: 'db.collection("..."): use a typed factory in firebase/refs/admin.ts',
    re: /\b(?:db|firestore|adminDb|getFirestore\s*\(\s*\))\.collection\s*\(\s*['"`]/,
  },
  {
    rule: 'db.doc("a/b"): use a typed factory in firebase/refs/admin.ts',
    re: /\b(?:db|firestore|adminDb|getFirestore\s*\(\s*\))\.doc\s*\(\s*['"`]/,
    allowPairing: true,
  },
];

const violations = [];

for (const path of listScopeFiles()) {
  const abs = join(repoRoot, path);
  const source = await readFile(abs, 'utf8');
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isAllowlisted(lines, i)) continue;
    for (const { rule, re, allowPairing } of RULES) {
      if (re.test(line)) {
        if (allowPairing && ALLOWED_PAIRINGS.test(line)) continue;
        violations.push({
          path,
          line: i + 1,
          rule,
          excerpt: line.trim(),
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log('OK — no raw Firestore refs outside firebase/refs/');
  process.exit(0);
}

console.error(`Found ${violations.length} raw Firestore ref violation(s):\n`);
for (const v of violations) {
  console.error(`  ${v.path}:${v.line}`);
  console.error(`    rule: ${v.rule}`);
  console.error(`    code: ${v.excerpt}`);
  console.error('');
}
console.error('Use the typed factories in packages/shared/src/firebase/refs/');
console.error('(client.ts for the client SDK, admin.ts for the admin SDK).');
console.error('To allowlist a specific line, add `// typed-refs: allowed`');
console.error('on the line above it.');
process.exit(1);
