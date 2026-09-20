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
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIRS,
  KINDS,
  NESTED_DIRS,
  PROPOSAL_FILE,
  countPlaceholders,
  findDanglingProposals,
  findDuplicateIds,
  findFalseReady,
  findStranded,
  findUpcoming,
  parseFrontmatter,
  resolveProposalDeadlines,
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

/**
 * Every `[[...]]` hole in a proposal's whole folder, not just its state file —
 * the holes that matter live in the form answers next to it.
 */
function countFolderHoles(abs) {
  let holes = 0;
  for (const file of readdirSync(abs)) {
    if (!file.endsWith('.md')) continue;
    holes += countPlaceholders(readFileSync(join(abs, file), 'utf8'));
  }
  return holes;
}

/** Locate every record file: flat `*.md`, plus one folder per proposal. */
function* walk(dir) {
  const abs = join(PROJECT_DIR, dir);
  if (!existsSync(abs)) return;
  const nested = NESTED_DIRS.includes(dir);
  for (const entry of readdirSync(abs).sort()) {
    if (nested) {
      const folder = join(abs, entry);
      if (!statSync(folder).isDirectory()) continue;
      const state = join(folder, PROPOSAL_FILE);
      if (!existsSync(state)) continue;
      yield { dir, slug: entry, file: state, path: `project/${dir}/${entry}/${PROPOSAL_FILE}`, holes: countFolderHoles(folder) };
    } else {
      if (!entry.endsWith('.md') || entry === 'README.md') continue;
      const file = join(abs, entry);
      yield { dir, slug: entry.slice(0, -3), file, path: `project/${dir}/${entry}`, holes: countPlaceholders(readFileSync(file, 'utf8')) };
    }
  }
}

/** @returns {{records: object[], errors: string[]}} */
export function loadRegistry() {
  const records = [];
  const errors = [];
  for (const dir of DIRS) {
    for (const found of walk(dir)) {
      let parsed;
      try {
        parsed = parseFrontmatter(readFileSync(found.file, 'utf8'));
      } catch (error) {
        errors.push(`${found.path}: ${error.message}`);
        continue;
      }
      for (const problem of validateRecord({ dir, slug: found.slug, data: parsed.data })) {
        errors.push(`${found.path}: ${problem}`);
      }
      records.push({ ...found, data: parsed.data, body: parsed.body });
    }
  }
  for (const { id, paths } of findDuplicateIds(records)) {
    errors.push(`duplicate id \`${id}\` in ${paths.join(' and ')}`);
  }
  for (const { path, para } of findDanglingProposals(records)) {
    errors.push(`${path}: \`para: ${para}\` does not match any record`);
  }
  return { records, errors };
}

const label = (record, deadlines = new Map()) => {
  const d = record.data;
  const state = d.status ?? d.relacion ?? '?';
  const deadline = d.deadline ?? deadlines.get(d.id) ?? null;
  const when = deadline ? `  ⏳ ${deadline}` : '';
  // A proposal's readiness is the hole count, not its own claim about itself.
  const extra =
    d.kind === 'propuesta'
      ? record.holes === 0
        ? '  ✓ sin huecos'
        : `  ${record.holes} hueco${record.holes === 1 ? '' : 's'}`
      : `fit:${(d.fit ?? '?').padEnd(7)}`;
  return `  ${state.padEnd(12)} ${extra} ${d.titulo}${when}\n      ${record.path}`;
};

/**
 * A copy of the registry where each proposal carries its inherited deadline and
 * an open status, so the existing deadline sweeps cover proposals too without
 * teaching them a second status vocabulary.
 */
function withInheritedDeadlines(records) {
  const inherited = new Map(
    resolveProposalDeadlines(records)
      .filter((p) => p.deadline)
      .map((p) => [p.proposal.data.id, p.deadline]),
  );
  return records.map((record) => {
    const deadline = inherited.get(record.data.id);
    if (!deadline) return record;
    const open = ['borrador', 'lista'].includes(record.data.status);
    return { ...record, data: { ...record.data, deadline, status: open ? 'candidate' : record.data.status } };
  });
}

function list() {
  const { records, errors } = loadRegistry();
  const kind = arg('kind');
  const shown = kind ? records.filter((r) => r.data.kind === kind) : records;

  if (flag('json')) {
    console.log(JSON.stringify(shown.map((r) => ({ ...r.data, path: r.path })), null, 2));
    return 0;
  }

  const deadlines = new Map(
    resolveProposalDeadlines(records)
      .filter((p) => p.deadline)
      .map((p) => [p.proposal.data.id, p.deadline]),
  );

  for (const k of KINDS) {
    const group = shown.filter((r) => r.data.kind === k);
    if (!group.length) continue;
    console.log(`\n${k.toUpperCase()} (${group.length})`);
    for (const record of group) console.log(label(record, deadlines));
  }
  if (!shown.length) console.log('\nRegistry is empty.');

  const window = Number(arg('window', '30'));
  const upcoming = findUpcoming(withInheritedDeadlines(records), today(), window);
  if (upcoming.length) {
    console.log(`\n⚠ DEADLINE IN THE NEXT ${window} DAYS`);
    for (const record of upcoming) {
      console.log(`  ${String(record.days).padStart(3)}d  ${record.data.titulo}  (${record.path})`);
    }
  }

  const stranded = findStranded(withInheritedDeadlines(records), today());
  if (stranded.length) {
    console.log('\n⚠ DEADLINE LAPSED WHILE STILL OPEN — expire it or advance it');
    for (const record of stranded) console.log(`  ${record.data.deadline}  ${record.data.titulo}  (${record.path})`);
  }

  const falseReady = findFalseReady(records);
  if (falseReady.length) {
    console.log('\n⚠ MARCADA `lista` PERO CON HUECOS SIN RELLENAR');
    for (const record of falseReady) console.log(`  ${record.holes} huecos  ${record.data.titulo}  (${record.path})`);
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
  const stranded = findStranded(withInheritedDeadlines(records), today());
  for (const record of stranded) {
    console.warn(`⚠ ${record.path}: deadline ${record.data.deadline} lapsed but status is \`${record.data.status}\``);
  }
  for (const record of findFalseReady(records)) {
    console.warn(`⚠ ${record.path}: marked \`lista\` but still has ${record.holes} unresolved [[...]]`);
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
