import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The native Android E2E job is the ONLY thing in CI that runs the real app on a
// real device. Everything it proves — native boot, the deep-link intent path,
// AsyncStorage auth persistence, the native Firebase SDK, RN modals and the soft
// keyboard, and `Alert.alert` (a NO-OP under react-native-web, so the Playwright
// suite has never once executed it) — is invisible to every other job.
//
// It is also the job that made the E2E auth bypass reachable from a native
// bundle for the first time, which is why half of this file is about hygiene
// rather than coverage. Invariant tests in the spirit of storeRelease.test.ts:
// they fail the build if the arrangement is quietly undone.

const repoRoot = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const workflow = read('.github/workflows/android-e2e.yml');
const appConfig = read('apps/mobile/app.config.ts');
const apkScript = read('scripts/build-android-e2e-apk.mjs');
const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
const flowsDir = resolve(repoRoot, 'apps/mobile/e2e/native/flows');

describe('android-e2e workflow gating', () => {
  // Same gate as web-e2e: a Gradle build plus an AVD boot is far too slow for
  // day-to-day develop PRs, and beta is the release candidate — the last point
  // where a native-only regression can be caught before it is a store binary.
  it('runs on the beta/main release paths only', () => {
    const triggers = workflow.slice(workflow.indexOf('on:'), workflow.indexOf('permissions:'));
    expect(triggers).toMatch(/pull_request:\s*\n\s*branches:\s*\[beta, main\]/);
    expect(triggers).toMatch(/push:\s*\n\s*branches:\s*\[beta, main\]/);
    // Only the comment may mention develop; no `branches:` list may.
    expect(triggers).not.toMatch(/branches:.*develop/);
  });

  // Without the udev rule the AVD falls back to software emulation and the suite
  // times out instead of failing with a usable message.
  it('enables KVM before booting the AVD', () => {
    expect(workflow).toMatch(/99-kvm4all\.rules/);
    expect(workflow.indexOf('99-kvm4all.rules')).toBeLessThan(
      workflow.indexOf('android-emulator-runner'),
    );
  });

  // One emulator boot for the whole suite: the AVD action's `script:` runs the
  // very command a developer runs locally, so a green CI run and a green local
  // run mean the same thing.
  it('drives the suite through the same entrypoint a developer uses', () => {
    expect(workflow).toContain('script: pnpm test:e2e:android');
    expect(rootPkg.scripts['test:e2e:android']).toContain('run-tests-with-emulators.mjs');
    expect(rootPkg.scripts['test:e2e:android']).toContain('pnpm seed:e2e');
    expect(rootPkg.scripts['test:e2e:android']).toContain('run-android-e2e.mjs');
  });
});

describe('E2E auth-bypass hygiene', () => {
  // THE load-bearing one. `Platform.OS === 'web'` used to make it structurally
  // impossible for the fixture-login to exist in a store binary. The native
  // driver removed that accident, so app.config.ts is now the deliberate wall —
  // and it holds on EVERY build path, EAS included, because every path evaluates
  // app.config.ts. Deleting it silently re-opens the hole.
  it('refuses to build a beta/prod bundle with the bypass armed', () => {
    expect(appConfig).toMatch(
      /USE_FIREBASE_EMULATOR'\]\s*===\s*'1'\s*&&\s*env\s*!==\s*'dev'[\s\S]{0,400}?throw new Error/,
    );
  });

  // The APK the suite installs must be a `dev` bundle pointed at the emulator.
  // Setting the flag for prebuild but not for the Gradle bundle task (or the
  // reverse) yields an APK that looks correct and talks to real Firebase.
  it('builds the E2E APK as dev + emulator-armed, for both build phases', () => {
    expect(apkScript).toMatch(/APP_ENV:\s*'dev'/);
    expect(apkScript).toMatch(/USE_FIREBASE_EMULATOR:\s*'1'/);
    expect(apkScript).toMatch(/EXPO_PUBLIC_EMULATOR_HOST/);
    // One env object, used for prebuild AND gradle — not two.
    expect(apkScript.match(/const buildEnv = \{/g)).toHaveLength(1);
    expect(apkScript).toMatch(/spawnSync\(cmd, args, \{ cwd, env: buildEnv/);
  });

  // The AVD's alias for the host loopback. `127.0.0.1` inside an emulator is the
  // device itself, so a default-host build finds no emulator, silently falls
  // through to real Firebase, and the fail-closed guard is the only thing left.
  it('bakes the AVD host alias, not loopback', () => {
    expect(apkScript).toMatch(/'10\.0\.2\.2'/);
  });

  // Cleartext is re-enabled by writing into the GENERATED, gitignored android/
  // tree. If it ever moves into app.config.ts or a committed manifest it would
  // ride into `eas build` and ship a store binary that accepts plain HTTP.
  it('confines the cleartext-HTTP opt-in to the generated android tree', () => {
    expect(apkScript).toMatch(/usesCleartextTraffic/);
    expect(appConfig).not.toMatch(/usesCleartextTraffic/);
  });
});

describe('native flow suite', () => {
  const flows = readdirSync(flowsDir).filter((f) => f.endsWith('.yaml'));

  it('runs against the dev package, the only one allowed to arm the bypass', () => {
    for (const flow of flows) {
      expect(read(`apps/mobile/e2e/native/flows/${flow}`)).toContain(
        'appId: com.cultuvilla.app.dev',
      );
    }
  });

  // Maestro orders flows by filename and the suite depends on it: 22 unregisters
  // what 20 registered. A flow added without a numeric prefix would sort
  // unpredictably against the rest and break that pairing.
  it('keeps every flow numerically ordered', () => {
    for (const flow of flows) expect(flow).toMatch(/^\d{2}-/);
    expect(flows.length).toBeGreaterThanOrEqual(8);
  });

  // The substrate's whole point (docs/decisions/e2e-testing-substrate.md): the
  // stable assertion is Firestore emulator state, not the view hierarchy. A
  // suite that only ever asserted on screen text would be the fragile half only.
  it('asserts on backend state, not only on the screen', () => {
    const withBackendAssertions = flows.filter((f) =>
      read(`apps/mobile/e2e/native/flows/${f}`).includes('runScript'),
    );
    expect(withBackendAssertions.length).toBeGreaterThanOrEqual(4);
  });
});
