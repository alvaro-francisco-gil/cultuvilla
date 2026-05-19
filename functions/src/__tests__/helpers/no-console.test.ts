import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Cloud Functions log to Cloud Logging. Using `console.log` produces an
// unstructured `textPayload` that filters and dashboards can't easily query;
// `firebase-functions/v2`'s `logger.{info,warn,error}` produces a structured
// `jsonPayload` instead, and the second arg becomes searchable fields.
// This invariant test fails the build if any console.* slips back into
// Cloud Function source.
//
// See AGENTS.md "Cloud Functions logging" for the convention.

const FUNCTIONS_SRC = resolve(__dirname, '../..');

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const CONSOLE_CALL = /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/;

describe('Cloud Functions structured logging invariant', () => {
  it('forbids console.* calls under functions/src/ (use firebase-functions logger instead)', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(FUNCTIONS_SRC)) {
      const lines = readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (CONSOLE_CALL.test(line)) {
          offenders.push(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      [
        'Cloud Function source must use `logger` from `firebase-functions/v2`,',
        'not `console.*`. The structured second arg becomes searchable fields in',
        'Cloud Logging (`jsonPayload`). Example:',
        '',
        "  import { logger } from 'firebase-functions/v2';",
        "  logger.info('Migrated persons', { handler, proposalId, migratedCount });",
        '',
        'Offending call sites:',
        ...offenders,
      ].join('\n'),
    ).toEqual([]);
  });
});
