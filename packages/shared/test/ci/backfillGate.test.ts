import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Code deploys automatically when it reaches an environment; the data migration
// it depends on does NOT. Before this gate, "has the backfill run on beta?" was
// a `**Migration:**` line in CHANGELOG.md that a human had to notice during a
// promotion — a convention with no enforcement. The deploy workflow now fails
// when a `pre-deploy` backfill has no completion marker for the target env, and
// run-backfill.yml is the credentialed endpoint that clears it.
//
// These invariant tests fail the build if that wiring is removed, un-guarded,
// or reordered after a deploy step. Parsed as text (no YAML dep), in the same
// spirit as conformanceGate.test.ts. See AGENTS.md "Backfills".
//
// Also covers set-app-version.yml, the sibling credential-free endpoint for
// `config/appVersion`: same WIF mechanism, same dry-run-by-default posture, and
// the same reason for existing — a release step that needs Firestore
// credentials nobody holds locally.

const repoRoot = resolve(__dirname, '../../../..');
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf-8');
const deployWorkflow = read('.github/workflows/deploy-firebase.yml');
const runWorkflow = read('.github/workflows/run-backfill.yml');
const ciWorkflow = read('.github/workflows/ci.yml');
const appVersionWorkflow = read('.github/workflows/set-app-version.yml');

/** Split a workflow's steps into per-step blocks so `if:`/`run:` attribute correctly. */
function stepBlockContaining(workflow: string, needle: string): string {
  const blocks = workflow.split(/^ {6}- name:/m);
  const match = blocks.find((b) => b.includes(needle));
  if (!match) throw new Error(`No workflow step contains "${needle}"`);
  return match;
}

describe('deploy backfill gate invariant', () => {
  it('verifies backfills as a step in the deploy pipeline, against the target env', () => {
    const gate = stepBlockContaining(deployWorkflow, 'backfills-cli.mjs verify');
    expect(gate).toContain('--env ${{ inputs.firebase_alias }}');
  });

  it('is guarded to beta/prod (skips dev)', () => {
    // Matches the conformance gate: dev data churns constantly and its WIF SA
    // may lack Firestore read.
    const gate = stepBlockContaining(deployWorkflow, 'backfills-cli.mjs verify');
    expect(gate).toMatch(/if:.*inputs\.firebase_alias != 'dev'/);
  });

  it('runs before any firebase deploy, so a missing migration blocks the whole deploy', () => {
    const gatePos = deployWorkflow.indexOf('backfills-cli.mjs verify');
    const firstDeployPos = deployWorkflow.search(/^\s*run: firebase deploy/m);
    expect(gatePos, 'backfill gate step not found').toBeGreaterThanOrEqual(0);
    expect(firstDeployPos, '`firebase deploy` step not found').toBeGreaterThanOrEqual(0);
    expect(gatePos).toBeLessThan(firstDeployPos);
  });

  it('auto-applies opted-in backfills before verifying, so they can satisfy the gate', () => {
    const autoPos = deployWorkflow.indexOf('backfills-cli.mjs auto-apply');
    const verifyPos = deployWorkflow.indexOf('backfills-cli.mjs verify');
    expect(autoPos, 'auto-apply step not found').toBeGreaterThanOrEqual(0);
    expect(autoPos).toBeLessThan(verifyPos);
  });
});

describe('run-backfill endpoint invariant', () => {
  it('is manually dispatchable with id, env and mode inputs', () => {
    expect(runWorkflow).toContain('workflow_dispatch');
    for (const input of ['      id:', '      env:', '      mode:']) {
      expect(runWorkflow).toContain(input);
    }
  });

  it('defaults to dry-run', () => {
    // The destructive mode must be opt-in; a mis-dispatch should write nothing.
    expect(runWorkflow).toMatch(/default: dry-run/);
  });

  it('only writes when mode is explicitly apply', () => {
    const applyStep = stepBlockContaining(runWorkflow, '--apply');
    expect(applyStep).toMatch(/if:\s*inputs\.mode == 'apply'/);
  });

  it('always dry-runs first, before any apply step', () => {
    const dryPos = runWorkflow.indexOf('run: node scripts/backfills-cli.mjs run --id="$ID" --env="$ENV" --confirm --verbose');
    const applyPos = runWorkflow.indexOf('--apply');
    expect(dryPos, 'unconditional dry-run step not found').toBeGreaterThanOrEqual(0);
    expect(dryPos).toBeLessThan(applyPos);
  });

  it('authenticates keylessly via Workload Identity Federation, never a stored SA key', () => {
    // beta/prod enforce iam.disableServiceAccountKeyCreation, so there is no
    // key to store; and a secrets-based picker can fall through to the wrong
    // environment's credential when one secret is unset.
    expect(runWorkflow).toContain('google-github-actions/auth@v2');
    expect(runWorkflow).toContain('workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}');
    expect(runWorkflow).toContain('service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}');
    expect(runWorkflow).not.toMatch(/credentials_json:|secrets\.FIREBASE_SA/);
  });

  it('requests the id-token permission WIF needs', () => {
    expect(runWorkflow).toMatch(/id-token: write/);
  });

  it('binds credentials to a GitHub Environment chosen by the target env input', () => {
    // The environment name — not a runtime pick between two secrets — is what
    // decides which project's credential the job holds.
    expect(runWorkflow).toMatch(/environment: \$\{\{ inputs\.env ==/);
  });

  it('serializes runs per environment and never cancels one mid-flight', () => {
    // A half-applied backfill leaves no marker and an unknown data state.
    expect(runWorkflow).toContain('group: backfill-${{ inputs.env }}');
    expect(runWorkflow).toContain('cancel-in-progress: false');
  });
});

describe('registry coverage lint invariant', () => {
  it('runs the warn-only coverage lint in CI', () => {
    expect(ciWorkflow).toContain('pnpm backfills:lint');
  });
});

describe('set-app-version endpoint invariant', () => {
  // config/appVersion is the force-update gate clients read on launch. It is
  // the one release step that is neither a code deploy nor a data migration, so
  // without this endpoint a release cannot be cut without local credentials.
  it('is manually dispatchable with env, latest, min_supported and mode inputs', () => {
    expect(appVersionWorkflow).toContain('workflow_dispatch');
    for (const input of ['      env:', '      latest:', '      min_supported:', '      mode:']) {
      expect(appVersionWorkflow).toContain(input);
    }
  });

  it('defaults to dry-run and only writes when mode is explicitly apply', () => {
    expect(appVersionWorkflow).toMatch(/default: dry-run/);
    const applyStep = appVersionWorkflow.split(/^ {6}- name:/m).find((b) => b.includes('--confirm'));
    expect(applyStep, 'apply step not found').toBeDefined();
    expect(applyStep).toMatch(/if:\s*inputs\.mode == 'apply'/);
  });

  it('always previews before writing', () => {
    const dryPos = appVersionWorkflow.indexOf('--dry-run');
    const applyPos = appVersionWorkflow.indexOf('--confirm');
    expect(dryPos).toBeGreaterThanOrEqual(0);
    expect(dryPos).toBeLessThan(applyPos);
  });

  it('authenticates keylessly via WIF, never a stored SA key', () => {
    expect(appVersionWorkflow).toContain('workload_identity_provider: ${{ vars.GCP_WIF_PROVIDER }}');
    expect(appVersionWorkflow).toContain('service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}');
    expect(appVersionWorkflow).not.toMatch(/credentials_json:|secrets\.FIREBASE_SA/);
    expect(appVersionWorkflow).toMatch(/id-token: write/);
  });

  it('serializes runs per environment and never cancels one mid-flight', () => {
    expect(appVersionWorkflow).toContain('group: app-version-${{ inputs.env }}');
    expect(appVersionWorkflow).toContain('cancel-in-progress: false');
  });

  it('omits a blank input rather than passing an empty flag value', () => {
    // `--latest=` would be parsed as an explicit empty version. The ${VAR:+...}
    // form drops the flag entirely when the input is blank.
    expect(appVersionWorkflow).toContain('${LATEST:+--latest="$LATEST"}');
    expect(appVersionWorkflow).toContain('${MIN:+--min="$MIN"}');
  });
});
