import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Hosting has two targets: `app` (the Expo web export, on all three envs) and
// `panel` (the internal founders' panel, on dev only). A bare `--only hosting`
// deploys EVERY target, so from beta or prod it would fail on a target that does
// not exist there, and from dev it would fail whenever the panel had not been
// built — turning an internal tool into a blocker for the app's promotion.
//
// Every deploy path must therefore name its target explicitly. This test fails
// the build if any of them regresses to a bare `--only hosting`.

const repoRoot = resolve(__dirname, '../../../..');
const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf-8');

describe('hosting deploys name their target', () => {
  // Comment lines are stripped before matching: the workflow explains this very
  // rule in prose, and prose about a bare `--only hosting` must not trip the
  // check that forbids running one.
  const runnableLines = (yaml: string): string =>
    yaml
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');

  it('the reusable deploy workflow deploys hosting:app, never bare hosting', () => {
    const workflow = runnableLines(read('.github/workflows/deploy-firebase.yml'));
    expect(workflow).toContain('--only hosting:app');
    expect(workflow).not.toMatch(/--only hosting(?![:\w])/);
  });

  it('every package.json hosting deploy script names a target', () => {
    const pkg = read('package.json');
    const bare = [...pkg.matchAll(/--only hosting(?![:\w])/g)];
    expect(bare).toHaveLength(0);
  });

  it('declares both targets in firebase.json as an array', () => {
    const config = JSON.parse(read('firebase.json')) as { hosting: { target?: string }[] };
    expect(Array.isArray(config.hosting)).toBe(true);
    expect(config.hosting.map((h) => h.target).sort()).toEqual(['app', 'panel']);
  });

  it('maps app on all three projects and panel on dev alone', () => {
    // Values typed as possibly-absent on purpose: a project missing from
    // `.firebaserc` is exactly what these assertions are here to catch.
    const rc = JSON.parse(read('.firebaserc')) as {
      targets: Record<string, { hosting: Record<string, string[] | undefined> } | undefined>;
    };
    for (const project of ['villa-events', 'cultuvilla-beta', 'cultuvilla-prod']) {
      expect(rc.targets[project]?.hosting.app).toBeDefined();
    }
    // The panel is internal and deliberately has no release path.
    expect(rc.targets['villa-events']?.hosting.panel).toEqual(['cultuvilla-panel']);
    expect(rc.targets['cultuvilla-beta']?.hosting.panel).toBeUndefined();
    expect(rc.targets['cultuvilla-prod']?.hosting.panel).toBeUndefined();
  });

  it('keeps the panel out of the public app build, which is why it exists', () => {
    const config = JSON.parse(read('firebase.json')) as { hosting: { target?: string; public: string }[] };
    const app = config.hosting.find((h) => h.target === 'app');
    const panel = config.hosting.find((h) => h.target === 'panel');
    expect(app?.public).toBe('apps/mobile/dist');
    expect(panel?.public).toBe('apps/panel/dist');
  });
});
