#!/usr/bin/env node
/**
 * Read the business-opportunity registry under `project/`.
 *
 *   pnpm opportunities:list   [--kind=convocatoria] [--window=30] [--json]
 *   pnpm opportunities:verify [--today=YYYY-MM-DD]
 *
 * `list` is what an agent calls to learn the current state in one shot; the
 * frontmatter is the machine surface and the Markdown body is for humans.
 * `verify` runs in `pnpm check` via `scripts:test`'s sibling wiring.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIRS,
  KINDS,
  findDuplicateIds,
  findStranded,
  findUpcoming,
  parseFrontmatter,
  validateRecord,
} from './lib/opportunities.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_DIR = join(ROOT, 'project');

const arg = (name, fallback = null) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const today = () => arg('today', new Date().toISOString().slice(0, 10));

/** @returns {{records: object[], errors: string[]}} */
export function loadRegistry() {
  const records = [];
  const errors = [];
  for (const dir of DIRS) {
    const abs = join(PROJECT_DIR, dir);
    if (!existsSync(abs)) continue;
    for (const file of readdirSync(abs).sort()) {
      if (!file.endsWith('.md') || file === 'README.md') continue;
      const slug = file.slice(0, -3);
      const path = `project/${dir}/${file}`;
      let parsed;
      try {
        parsed = parseFrontmatter(readFileSync(join(abs, file), 'utf8'));
      } catch (error) {
        errors.push(`${path}: ${error.message}`);
        continue;
      }
      for (const problem of validateRecord({ dir, slug, data: parsed.data })) {
        errors.push(`${path}: ${problem}`);
      }
      records.push({ path, dir, slug, data: parsed.data, body: parsed.body });
    }
  }
  for (const { id, paths } of findDuplicateIds(records)) {
    errors.push(`duplicate id \`${id}\` in ${paths.join(' and ')}`);
  }
  return { records, errors };
}

const label = (record) => {
  const d = record.data;
  const state = d.status ?? d.relacion ?? '?';
  const when = d.deadline ? `  ⏳ ${d.deadline}` : '';
  return `  ${state.padEnd(12)} fit:${(d.fit ?? '?').padEnd(7)} ${d.titulo}${when}\n      ${record.path}`;
};

function list() {
  const { records, errors } = loadRegistry();
  const kind = arg('kind');
  const shown = kind ? records.filter((r) => r.data.kind === kind) : records;

  if (flag('json')) {
    console.log(JSON.stringify(shown.map((r) => ({ ...r.data, path: r.path })), null, 2));
    return 0;
  }

  for (const k of KINDS) {
    const group = shown.filter((r) => r.data.kind === k);
    if (!group.length) continue;
    console.log(`\n${k.toUpperCase()} (${group.length})`);
    for (const record of group) console.log(label(record));
  }
  if (!shown.length) console.log('\nRegistry is empty.');

  const window = Number(arg('window', '30'));
  const upcoming = findUpcoming(records, today(), window);
  if (upcoming.length) {
    console.log(`\n⚠ DEADLINE IN THE NEXT ${window} DAYS`);
    for (const record of upcoming) {
      console.log(`  ${String(record.days).padStart(3)}d  ${record.data.titulo}  (${record.path})`);
    }
  }

  const stranded = findStranded(records, today());
  if (stranded.length) {
    console.log('\n⚠ DEADLINE LAPSED WHILE STILL OPEN — expire it or advance it');
    for (const record of stranded) console.log(`  ${record.data.deadline}  ${record.data.titulo}  (${record.path})`);
  }
  if (errors.length) console.log(`\n✗ ${errors.length} structural problem(s) — run \`pnpm opportunities:verify\``);
  return 0;
}

function verify() {
  const { records, errors } = loadRegistry();
  if (errors.length) {
    console.error(`✗ ${errors.length} problem(s) in the opportunity registry:\n`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }

  // Warnings only. A deadline lapses on its own, with no commit to blame, so
  // failing here would redden an unrelated PR on a Tuesday. Same posture as
  // `backfills:lint` toward the legacy scripts.
  const stranded = findStranded(records, today());
  for (const record of stranded) {
    console.warn(`⚠ ${record.path}: deadline ${record.data.deadline} lapsed but status is \`${record.data.status}\``);
  }
  console.log(`✓ ${records.length} record(s) valid${stranded.length ? `, ${stranded.length} stranded` : ''}`);
  return 0;
}

const command = process.argv[2];
const commands = { list, verify };
if (!commands[command]) {
  console.error(`Usage: node scripts/opportunities-cli.mjs <list|verify> [flags]`);
  process.exit(2);
}
process.exit(commands[command]());
