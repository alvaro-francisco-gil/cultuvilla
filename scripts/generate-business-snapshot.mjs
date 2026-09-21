#!/usr/bin/env node
/**
 * Generate the business dashboard's data from the `project/` registry.
 *
 * The output lands in `functions/`, NOT in a client bundle: the panel is private,
 * so the data is served by an authenticated callable and never shipped to a
 * browser that has not proved it may see it.
 *
 *   pnpm business:snapshot          # write it
 *   pnpm business:snapshot --check  # fail if the committed file is stale
 *
 * The output is committed, so the app build never depends on running this — and
 * `--check` in CI is what stops it drifting from the markdown it came from.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './opportunities-cli.mjs';
import { buildSnapshot } from './lib/business-snapshot.mjs';
import { BusinessSnapshotSchema } from '../packages/shared/dist/models/business/BusinessSnapshot.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = join(ROOT, 'functions/src/business/snapshot.json');

/** `generatedAt` is a date, not a timestamp: a timestamp would make every run a diff. */
const today = () => new Date().toISOString().slice(0, 10);

function main() {
  const { records, errors } = loadRegistry();
  if (errors.length) {
    console.error('✗ the registry has problems — fix them first:\n');
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }

  const snapshot = buildSnapshot(records, today());

  // Parsed against the shared schema the panel and the callable also use, so a
  // generator bug fails here instead of rendering as a silently missing section.
  const parsed = BusinessSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    console.error('✗ the generated snapshot does not match BusinessSnapshotSchema:\n');
    for (const issue of parsed.error.issues.slice(0, 10)) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    return 1;
  }

  const serialised = `${JSON.stringify(snapshot, null, 2)}\n`;

  if (process.argv.includes('--check')) {
    let current = null;
    try {
      current = readFileSync(OUTPUT, 'utf8');
    } catch {
      console.error(`✗ ${OUTPUT} is missing — run \`pnpm business:snapshot\``);
      return 1;
    }
    // Compare everything but the date: the registry not having changed today is
    // not a reason to fail CI.
    const strip = (text) => text.replace(/"generatedAt": "[^"]*"/, '"generatedAt": "-"');
    if (strip(current) !== strip(serialised)) {
      console.error('✗ functions/src/business/snapshot.json is stale — run `pnpm business:snapshot`');
      return 1;
    }
    console.log('✓ business snapshot is current');
    return 0;
  }

  writeFileSync(OUTPUT, serialised);
  console.log(`✓ wrote ${snapshot.urgente.length} urgent, ${records.length} records → functions/src/business/snapshot.json`);
  return 0;
}

process.exit(main());
