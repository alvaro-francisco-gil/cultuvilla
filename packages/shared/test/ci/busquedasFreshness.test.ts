import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../..');
const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf-8');

/**
 * Same invariants as fiestas-freshness.yml, for the same reasons. Duplicated on
 * purpose: the two jobs answer different questions on different cadences, and a
 * shared abstraction would couple an annual bulletin refresh to a weekly funding
 * sweep. If a third appears, merge them then.
 */
describe('busquedas-freshness.yml passes the report safely', () => {
  const workflow = read('.github/workflows/busquedas-freshness.yml');

  it('reads the report from the environment, not from GitHub interpolation', () => {
    expect(workflow).toMatch(/REPORT:\s*\$\{\{\s*steps\.check\.outputs\.report\s*\}\}/);
    expect(workflow).toMatch(/process\.env\.REPORT/);
  });

  // Interpolating the report into the `github-script` template literal closes the
  // literal on the first backtick and fails with a syntax error — precisely on the
  // overdue runs the job exists for.
  it('never interpolates the report into the script body', () => {
    const script = workflow.slice(workflow.indexOf('script: |'));
    expect(script).not.toMatch(/\$\{\{\s*steps\.check\.outputs\.report\s*\}\}/);
  });

  it('does not fence the report with backticks, which the report itself contains', () => {
    expect(read('scripts/opportunities-cli.mjs')).toContain('`research-opportunities`');
    const script = workflow.slice(workflow.indexOf('script: |'));
    expect(script).not.toContain("'```'");
  });

  // Without --strict the verifier exits 0 on an overdue sweep, so the job would
  // pass forever and silently.
  it('runs the verifier in --strict mode, or it could never fail', () => {
    expect(workflow).toContain('opportunities:verify --strict');
  });

  // The gate must stay OUT of `pnpm check`: a sweep comes due on a calendar
  // boundary, so a PR gate would red `develop` for something nobody in that PR
  // did — the trap `business:snapshot:check` already falls into.
  it('keeps the PR gate non-strict so a calendar boundary cannot red develop', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('pnpm opportunities:verify');
    expect(ci).not.toContain('opportunities:verify --strict');
  });
});
