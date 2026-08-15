#!/usr/bin/env node
/**
 * WARN-ONLY coverage lint for the backfill registry.
 *
 * Flags scripts that look like backfills but have not opted into the harness,
 * so they are invisible to `backfills:list` and to the deploy gate. Emits
 * GitHub Actions `::warning::` annotations and ALWAYS exits 0 — this repo has
 * ~25 legacy backfill scripts and failing CI on all of them would just get the
 * check disabled. Converting a script (export `meta`/`run`, call the harness
 * entrypoint) clears its warning.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SENTINEL, SENTINEL_RE } from './lib/backfill-harness.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = [path.join(REPO_ROOT, 'scripts'), path.join(REPO_ROOT, 'scripts/backfill')];
const LOOKS_LIKE_BACKFILL = /(backfill|migrate|cleanup)/i;
const EXCLUDE = new Set(['backfills-cli.mjs', 'lint-backfill-meta.mjs']);

const uncovered = [];
for (const dir of SCAN_DIRS) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.mjs') || EXCLUDE.has(name)) continue;
    if (!LOOKS_LIKE_BACKFILL.test(name)) continue;
    const file = path.join(dir, name);
    if (!statSync(file).isFile()) continue;
    if (SENTINEL_RE.test(readFileSync(file, 'utf8'))) continue;
    uncovered.push(path.relative(REPO_ROOT, file));
  }
}

if (uncovered.length === 0) {
  console.log('✅ backfill registry: every backfill/migration/cleanup script is on the harness.');
  process.exit(0);
}

for (const file of uncovered) {
  console.log(
    `::warning file=${file}::Not on the backfill registry — export \`meta\`/\`run\` and call \`${SENTINEL}\` ` +
      `so it appears in \`pnpm backfills:list\` and the deploy gate can verify it.`,
  );
}
console.log(`\n⚠️  ${uncovered.length} script(s) not on the backfill registry (warning only, not a failure):`);
for (const file of uncovered) console.log(`   - ${file}`);
process.exit(0);
