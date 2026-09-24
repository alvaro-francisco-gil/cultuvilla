import { describe, it, expect } from 'vitest';
import { minimumBopYear } from '../../src/models/business/BusinessSnapshot';

// The provincial bulletin publishes year Y+1's local holidays in about September
// of year Y (2026's resolution: 16-09-2025, published 19-09-2025). So from
// October the next year's list should exist, and a dataset still on the current
// year is going stale.
describe('minimumBopYear', () => {
  it('requires only the current year before October', () => {
    expect(minimumBopYear('2026-09-24')).toBe(2026);
    expect(minimumBopYear('2026-01-02')).toBe(2026);
  });

  it('requires next year from 1 October, once the resolution is out', () => {
    expect(minimumBopYear('2026-10-01')).toBe(2027);
    expect(minimumBopYear('2026-12-31')).toBe(2027);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../..');
const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf-8');

// The verifier's stale message names the skill in backticks. Interpolating that
// text into a `github-script` template literal with `${{ }}` closes the literal
// and fails the script with a syntax error — exactly on the stale runs the job
// exists for. The report must reach the script through the environment.
describe('fiestas-freshness.yml passes the report safely', () => {
  const workflow = read('.github/workflows/fiestas-freshness.yml');

  it('reads the report from the environment, not from GitHub interpolation', () => {
    expect(workflow).toMatch(/REPORT:\s*\$\{\{\s*steps\.check\.outputs\.report\s*\}\}/);
    expect(workflow).toMatch(/process\.env\.REPORT/);
  });

  it('never interpolates the report into the script body', () => {
    const script = workflow.slice(workflow.indexOf('script: |'));
    expect(script).not.toMatch(/\$\{\{\s*steps\.check\.outputs\.report\s*\}\}/);
  });

  it('does not fence the report with backticks, which the report itself contains', () => {
    const verifier = read('scripts/fiestas-verify.mjs');
    expect(verifier).toContain('`research-village-fiestas`');
    const script = workflow.slice(workflow.indexOf('script: |'));
    expect(script).not.toContain("'```'");
  });

  it('runs the verifier in --strict mode, or it could never fail', () => {
    expect(workflow).toContain('fiestas:verify --strict');
  });
});
