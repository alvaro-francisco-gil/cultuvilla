# Unify the Test Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm test` boot the Firebase emulator once and run every node-side test (shared + functions + mobile jest) in one pass, with a fast emulator-free `pnpm test:unit` fallback and per-config `VITEST_RETRY_COUNT` flake absorption.

**Architecture:** `scripts/run-tests-with-emulators.mjs` grows a `--label <name> <cmd>` flag so it can run multiple child commands sequentially under a single emulator boot. New `vitest.config.all.*` per package includes every test category for that package; new `test:all` scripts run them. The root `pnpm test` invokes the orchestrator with one `--label` per package. CI replaces its three-script `emulator-tests` job with a single `pnpm test` step.

**Tech Stack:** Node.js orchestrator, vitest (shared + functions), jest (mobile), Firebase Local Emulator Suite, `@firebase/rules-unit-testing`, `firebase-admin/firestore` (new integration harness), GitHub Actions.

---

### Spec

See [docs/superpowers/specs/2026-05-29-unify-test-pipeline-design.md](../specs/2026-05-29-unify-test-pipeline-design.md).

### File Structure

- `scripts/run-tests-with-emulators.mjs` — **modify**. Add multi-command `--label <name> <cmd>` mode; sets `VITEST_RETRY_COUNT=1` in the emulator-child env if not already set; runs `pnpm functions:build` before launch if `functions/lib/index.js` is missing or stale; quick `java -version` probe.
- `packages/shared/vitest.config.all.ts` — **new**. `include`s unit + integration + e2e patterns; `fileParallelism: false`, `maxConcurrency: 1`; reads `VITEST_RETRY_COUNT`; merges the unit-config `env` block so module-load env checks pass.
- `packages/shared/vitest.config.ts`, `vitest.config.integration.ts`, `vitest.config.e2e.ts` — **modify**. Each reads `VITEST_RETRY_COUNT` and sets `test.retry` accordingly.
- `packages/shared/package.json` — **modify**. Add `"test:all": "vitest run --config vitest.config.all.ts"`.
- `functions/vitest.config.all.mjs` — **new**. `include`s `src/__tests__/**` (both unit and handlers); `fileParallelism: false`, `maxConcurrency: 1`; reads `VITEST_RETRY_COUNT`.
- `functions/vitest.config.mjs`, `vitest.config.integration.mjs` — **modify**. Each reads `VITEST_RETRY_COUNT`.
- `functions/package.json` — **modify**. Add `"test:all": "vitest run --config vitest.config.all.mjs"`.
- `packages/shared/test/integration/villageMemberServiceIntegration.test.ts` — **new**. Worked example using `firebase-admin/firestore` against the emulator.
- `packages/shared/test/integration/README.md` — **new**. One-page pattern doc for service integration tests.
- `package.json` (root) — **modify**. Rewrite `test`, add `test:unit`, leave the existing `test:rules` / `test:integration` / `test:functions` / `test:emulators` escape hatches intact.
- `.github/workflows/ci.yml` — **modify**. Replace the `emulator-tests` job's three test steps with one `pnpm test` step that itself orchestrates the emulator. Drop the redundant `Test (unit)` step from the `ci` job, or leave it as `pnpm test:unit` for fast PR feedback before the heavier emulator job runs.

---

### Task 1: Orchestrator multi-command + retry env + functions build pre-step

**Files:**
- Modify: `scripts/run-tests-with-emulators.mjs`

- [ ] **Step 1: Read the current orchestrator end-to-end**

Run: `cat scripts/run-tests-with-emulators.mjs`
You should see a ~115-line script that takes one positional command and runs it under a single emulator boot. Understand the `waitForPort`, `shutdown`, and `emulatorEnv` plumbing — your edit preserves all of it.

- [ ] **Step 2: Rewrite the script to support `--label NAME CMD [args...]` repeated, plus single-command back-compat**

Replace the existing file contents with:

```js
#!/usr/bin/env node
/**
 * Starts the Firebase emulator suite in the background, waits for ports,
 * runs one or more test commands SEQUENTIALLY under that single emulator,
 * then shuts the emulators down.
 *
 * Usage (single command, backwards-compatible):
 *   node scripts/run-tests-with-emulators.mjs pnpm --filter @cultuvilla/shared test:rules
 *
 * Usage (multi-command):
 *   node scripts/run-tests-with-emulators.mjs \
 *     --label shared    pnpm --filter @cultuvilla/shared test:all \
 *     --label functions pnpm --prefix functions run test:all
 *
 * Env:
 *   TEST_PROJECT_ID     Project id passed to the emulator (default: cultuvilla-test)
 *   ONLY                Comma list passed to `firebase emulators:start --only`
 *                       (default: auth,firestore,functions,storage)
 *   WAIT_TIMEOUT_MS     Per-port wait timeout (default: 180000)
 *   VITEST_RETRY_COUNT  Defaulted to "1" in the child env if not set by caller.
 *                       Each vitest config reads it and passes to `test.retry`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || 'cultuvilla-test';
const ONLY = process.env.ONLY || 'auth,firestore,functions,storage';
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 180_000);
const WAIT_INTERVAL_MS = 500;

const PORTS_BY_SERVICE = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  storage: 9199,
};
const portsToWaitFor = ONLY.split(',').map((s) => PORTS_BY_SERVICE[s.trim()]).filter(Boolean);

// --- arg parsing: multi-command (--label) or single positional ---
const rawArgs = process.argv.slice(2);
if (rawArgs.length === 0) {
  console.error('Usage: run-tests-with-emulators.mjs [--label NAME CMD ARGS...]... | <cmd args...>');
  process.exit(2);
}

/** @type {{label: string, cmd: string, args: string[]}[]} */
const commands = [];
if (rawArgs[0] === '--label') {
  for (let i = 0; i < rawArgs.length; ) {
    if (rawArgs[i] !== '--label') {
      console.error(`expected --label at position ${i}, got "${rawArgs[i]}"`);
      process.exit(2);
    }
    const label = rawArgs[i + 1];
    if (!label) { console.error('--label requires a name'); process.exit(2); }
    // Collect until the next --label or end.
    let j = i + 2;
    while (j < rawArgs.length && rawArgs[j] !== '--label') j++;
    const segment = rawArgs.slice(i + 2, j);
    if (segment.length === 0) { console.error(`--label ${label} requires a command`); process.exit(2); }
    commands.push({ label, cmd: segment[0], args: segment.slice(1) });
    i = j;
  }
} else {
  commands.push({ label: rawArgs[0], cmd: rawArgs[0], args: rawArgs.slice(1) });
}

// --- JDK probe (Firestore emulator needs Java) ---
const java = spawnSync('java', ['-version'], { stdio: 'pipe' });
if (java.status !== 0) {
  console.error('[emulators] java not found on PATH. The Firestore emulator requires JDK 21+.');
  process.exit(1);
}

// --- functions build pre-step if lib/ missing or stale ---
const fnsLib = path.join(ROOT, 'functions', 'lib', 'index.js');
const fnsSrc = path.join(ROOT, 'functions', 'src', 'index.ts');
function libIsStale() {
  if (!existsSync(fnsLib)) return true;
  if (!existsSync(fnsSrc)) return false; // no src? trust lib.
  return statSync(fnsSrc).mtimeMs > statSync(fnsLib).mtimeMs;
}
if (libIsStale()) {
  console.log('[functions] lib/ missing or stale; building before emulator start');
  const build = spawnSync('pnpm', ['functions:build'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('[functions] build failed (exit ' + build.status + ')');
    process.exit(build.status ?? 1);
  }
}

const emulatorEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001',
  GCLOUD_PROJECT: TEST_PROJECT_ID,
  TEST_PROJECT_ID,
  VITEST_RETRY_COUNT: process.env.VITEST_RETRY_COUNT ?? '1',
};

console.log(`[emulators] starting (project=${TEST_PROJECT_ID}, only=${ONLY})`);
const emu = spawn(
  'firebase',
  ['emulators:start', '--project', TEST_PROJECT_ID, '--only', ONLY],
  { cwd: ROOT, env: emulatorEnv, stdio: ['ignore', 'inherit', 'inherit'] },
);

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!emu.killed) emu.kill('SIGINT');
  setTimeout(() => process.exit(code ?? 0), 1500);
}
process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

emu.once('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[emulators] exited unexpectedly (code=${code})`);
    process.exit(code ?? 1);
  }
});

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        return;
      }
      const sock = new net.Socket();
      sock.setTimeout(2000);
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => { sock.destroy(); setTimeout(tryOnce, WAIT_INTERVAL_MS); });
      sock.once('timeout', () => { sock.destroy(); setTimeout(tryOnce, WAIT_INTERVAL_MS); });
      sock.connect(port, '127.0.0.1');
    };
    tryOnce();
  });
}

try {
  await Promise.all(portsToWaitFor.map((p) => waitForPort(p, WAIT_TIMEOUT_MS)));
  console.log(`[emulators] ready on ports ${portsToWaitFor.join(', ')}`);
} catch (err) {
  console.error('[emulators] failed to start:', err.message);
  shutdown(1);
  process.exit(1);
}

let firstFailureCode = 0;
for (const { label, cmd, args } of commands) {
  console.log(`\n[tests] ${label}: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd: ROOT, env: emulatorEnv, stdio: 'inherit' });
  const code = result.status ?? (result.signal ? 1 : 0);
  if (code !== 0 && firstFailureCode === 0) firstFailureCode = code;
}

shutdown(firstFailureCode);
```

- [ ] **Step 3: Smoke-test the orchestrator still works in single-command mode**

Run: `pnpm test:rules`

Expected: emulator boots, vitest runs the 7 e2e files, all 61 tests pass, emulator shuts down cleanly. (Existing behaviour, unchanged.)

- [ ] **Step 4: Smoke-test the multi-command mode**

Run:
```bash
node scripts/run-tests-with-emulators.mjs \
  --label rules-a pnpm --filter @cultuvilla/shared test:rules \
  --label rules-b pnpm --filter @cultuvilla/shared test:rules
```

(Running the same suite twice keeps the smoke-test self-contained — both runs share one emulator boot. Integration suite is empty until Task 5; using it here would fail vitest's no-test-files check.)

Expected: one `[emulators] starting` line, one `[emulators] ready` line, then two labelled test runs back-to-back inside the same emulator session, both green, exit 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/run-tests-with-emulators.mjs
git commit -m "chore(scripts): emulator orchestrator gains --label multi-command + retry env + functions build"
```

---

### Task 2: Wire `VITEST_RETRY_COUNT` into existing vitest configs

**Files:**
- Modify: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/vitest.config.integration.ts`
- Modify: `packages/shared/vitest.config.e2e.ts`
- Modify: `functions/vitest.config.mjs`
- Modify: `functions/vitest.config.integration.mjs`

- [ ] **Step 1: Add the retry helper inline to each config and wire it**

Edit `packages/shared/vitest.config.ts` — replace the `defineConfig({...})` block so the `test` object includes `retry`:

```ts
import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NEXT_PUBLIC_APP_ENV: 'dev',
      NEXT_PUBLIC_FIREBASE_API_KEY_DEV: 'AIzaSyTEST_DUMMY_PLACEHOLDER_KEY_0000000',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV: 'test.example.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID_DEV: 'test-app-id',
    },
    include: [
      'test/config/**/*.test.ts',
      'test/models/**/*.test.ts',
      'test/services/**/*.test.ts',
      'test/firebase/**/*.test.ts',
      'test/eslint/**/*.test.ts',
      'test/design-system/**/*.test.ts',
      'test/utils/**/*.test.ts',
    ],
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

Edit `packages/shared/vitest.config.integration.ts` — add the same `RETRY` constant and `retry` field:

```ts
import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['test/setup/integration.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

Edit `packages/shared/vitest.config.e2e.ts` — same shape:

```ts
import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    setupFiles: ['test/setup/e2e.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

Edit `functions/vitest.config.mjs`:

```js
import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/handlers/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

Edit `functions/vitest.config.integration.mjs`:

```js
import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/handlers/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup/admin.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

- [ ] **Step 2: Verify the configs still load**

Run: `pnpm shared:test 2>&1 | tail -5`

Expected: all existing shared unit tests pass; no config-syntax errors.

Run: `pnpm test:rules 2>&1 | tail -5`

Expected: 61/61 passing; emulator shutdown clean.

- [ ] **Step 3: Verify retry takes effect when VITEST_RETRY_COUNT is set**

Run: `VITEST_RETRY_COUNT=2 pnpm shared:test 2>&1 | grep -iE "retry|fail|pass" | head`

Expected: no test FAILs (suite is green). The retry knob is silent on success — to actually witness retry behaviour, you'd have to introduce a flaky test, which is out of scope. The verification here is just "config loaded with VITEST_RETRY_COUNT=2 without errors".

- [ ] **Step 4: Commit**

```bash
git add packages/shared/vitest.config.ts packages/shared/vitest.config.integration.ts packages/shared/vitest.config.e2e.ts functions/vitest.config.mjs functions/vitest.config.integration.mjs
git commit -m "test(vitest): read VITEST_RETRY_COUNT from env to absorb emulator flakes"
```

---

### Task 3: Add `vitest.config.all.ts` + `test:all` script for `packages/shared`

**Files:**
- Create: `packages/shared/vitest.config.all.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Create the all-categories vitest config**

Create `packages/shared/vitest.config.all.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Runs every test category in @cultuvilla/shared under a single vitest
// invocation. Intended for orchestration by scripts/run-tests-with-emulators.mjs
// where the Firebase emulator suite is already running. Standalone use also
// works but the emulator must be up for integration/e2e tests to pass.
const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Same module-load env as the unit config so files that import
    // packages/shared/src/firebase.ts at module load don't blow up.
    env: {
      NEXT_PUBLIC_APP_ENV: 'dev',
      NEXT_PUBLIC_FIREBASE_API_KEY_DEV: 'AIzaSyTEST_DUMMY_PLACEHOLDER_KEY_0000000',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV: 'test.example.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID_DEV: 'test-app-id',
    },
    include: [
      // Unit (mirrors vitest.config.ts):
      'test/config/**/*.test.ts',
      'test/models/**/*.test.ts',
      'test/services/**/*.test.ts',
      'test/firebase/**/*.test.ts',
      'test/eslint/**/*.test.ts',
      'test/design-system/**/*.test.ts',
      'test/utils/**/*.test.ts',
      // Integration (mirrors vitest.config.integration.ts):
      'test/integration/**/*.test.ts',
      // E2E rules (mirrors vitest.config.e2e.ts):
      'test/e2e/**/*.test.ts',
    ],
    setupFiles: [
      // Aggregate of integration + e2e setup files. Both are idempotent
      // (they configure global env + Firebase RulesTestEnvironment), so
      // running both in the same process is safe.
      'test/setup/integration.setup.ts',
      'test/setup/e2e.setup.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Emulator state is shared across files; serial keeps the e2e and
    // integration suites from stomping on each other.
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

- [ ] **Step 2: Add the `test:all` script to `packages/shared/package.json`**

In `packages/shared/package.json`, add the line to the `scripts` block (alongside the existing `test:integration` and `test:rules`):

```json
    "test:all": "vitest run --config vitest.config.all.ts",
```

- [ ] **Step 3: Verify standalone (no emulator) — unit subset should still pass**

Run: `pnpm --filter @cultuvilla/shared test:all 2>&1 | tail -10`

Expected: unit tests pass; integration + e2e tests FAIL because the emulator isn't running. The relevant assertion here is that vitest LOADS the config and finds the tests — failures from missing emulator are expected.

- [ ] **Step 4: Verify under the orchestrator — everything green**

Run:
```bash
node scripts/run-tests-with-emulators.mjs \
  pnpm --filter @cultuvilla/shared test:all
```

Expected: all 7 unit + 7 e2e + (whatever integration is currently there — likely zero) test files pass under a single emulator boot. Final `Test Files  N passed` line, no failures.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/vitest.config.all.ts packages/shared/package.json
git commit -m "test(shared): add vitest.config.all.ts + test:all script for unified runs"
```

---

### Task 4: Add `vitest.config.all.mjs` + `test:all` script for `functions/`

**Files:**
- Create: `functions/vitest.config.all.mjs`
- Modify: `functions/package.json`

- [ ] **Step 1: Create the all-categories vitest config**

Create `functions/vitest.config.all.mjs`:

```js
import { defineConfig } from 'vitest/config';

// Runs every test category in functions/ under a single vitest invocation.
// Intended for orchestration by scripts/run-tests-with-emulators.mjs where
// the Firebase emulator suite is already running.
const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Both unit and integration trees:
    include: ['src/__tests__/**/*.test.ts'],
    // Integration handlers need the admin SDK setup; the unit config
    // excludes handlers but the all-config doesn't.
    setupFiles: ['src/__tests__/setup/admin.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
```

- [ ] **Step 2: Add the `test:all` script to `functions/package.json`**

In `functions/package.json` `scripts` block:

```json
    "test:all": "vitest run --config vitest.config.all.mjs",
```

- [ ] **Step 3: Verify under the orchestrator**

Run:
```bash
node scripts/run-tests-with-emulators.mjs \
  pnpm --prefix functions run test:all
```

Expected: all functions unit + handler tests pass under one emulator boot.

- [ ] **Step 4: Commit**

```bash
git add functions/vitest.config.all.mjs functions/package.json
git commit -m "test(functions): add vitest.config.all.mjs + test:all script for unified runs"
```

---

### Task 5: Seed the service integration harness (worked example + README)

**Files:**
- Create: `packages/shared/test/integration/villageMemberServiceIntegration.test.ts`
- Create: `packages/shared/test/integration/README.md`

- [ ] **Step 1: Read the existing integration setup to understand the env wiring**

Run: `cat packages/shared/test/setup/integration.setup.ts`

You should see whatever module-load wiring exists for `FIRESTORE_EMULATOR_HOST` etc. The orchestrator already sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` in the child env, so tests just need to consume it.

- [ ] **Step 2: Write the integration test**

Create `packages/shared/test/integration/villageMemberServiceIntegration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { initializeApp, deleteApp, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';

const PROJECT_ID = process.env.TEST_PROJECT_ID ?? 'cultuvilla-test';
const EMU_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let adminApp: App;

beforeAll(() => {
  // Admin SDK targets the emulator via FIRESTORE_EMULATOR_HOST automatically.
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'integration-admin');
});

afterAll(async () => {
  await deleteApp(adminApp);
});

afterEach(async () => {
  // Wipe Firestore between tests via the emulator REST endpoint so each test
  // sees a clean slate.
  const res = await fetch(
    `http://${EMU_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    throw new Error(`emulator wipe failed: ${res.status} ${res.statusText}`);
  }
});

describe('villageMemberService — getUserMemberships', () => {
  it('returns memberships for the caller across municipalities', async () => {
    const db = getFirestore(adminApp);
    const now = Timestamp.now();
    await db.doc('municipalities/m1/members/alice').set({
      userId: 'alice', role: 'member', joinedAt: now, profileCompletedAt: null,
    });
    await db.doc('municipalities/m2/members/alice').set({
      userId: 'alice', role: 'admin', joinedAt: now, profileCompletedAt: null,
    });
    await db.doc('municipalities/m3/members/bob').set({
      userId: 'bob', role: 'member', joinedAt: now, profileCompletedAt: null,
    });

    const memberships = await getUserMemberships('alice');

    expect(memberships.map((m) => m.municipalityId).sort()).toEqual(['m1', 'm2']);
    expect(memberships.find((m) => m.municipalityId === 'm2')?.role).toBe('admin');
  });

  it('returns empty for a user with no memberships', async () => {
    const memberships = await getUserMemberships('nobody');
    expect(memberships).toEqual([]);
  });
});
```

- [ ] **Step 3: Write the README pattern doc**

Create `packages/shared/test/integration/README.md`:

```markdown
# Service integration tests

Tests that exercise a service function (from `packages/shared/src/services/`) against the **real Firebase emulator** rather than mocks.

## When to write one

Write an integration test for a service function when **the shape of the query matters**: a wrong collection name, missing `where` clause, wrong field name, or stale denormalized read model. Pure unit tests with mocked Firestore can't catch these — the mock always returns whatever you tell it to.

Specifically, write one when:

- The service issues a `collectionGroup(...)` query — the path through the rule engine is non-trivial; a real Firestore catches typos in the CG name.
- The service uses `where(...)` filters whose field name is also referenced in `firestore.rules` — drift between the two surfaces as a permission-denied in prod.
- The service depends on a composite index — missing index returns `FAILED_PRECONDITION` from the emulator.

If the function is a pure helper (no Firestore call), use a regular unit test under `test/services/`.

## How to write one

1. File lives at `packages/shared/test/integration/<service>Integration.test.ts`.
2. Picked up automatically by `vitest.config.integration.ts` and `vitest.config.all.ts`.
3. Uses `firebase-admin` to seed data so rules don't gate writes (the test is about the service, not the rules — rules have their own coverage under `test/e2e/`).
4. Uses the service function (which uses the JS SDK) to read; both SDKs target the same emulator via `FIRESTORE_EMULATOR_HOST`.
5. Wipe Firestore between tests via the emulator's REST endpoint (see `villageMemberServiceIntegration.test.ts` for the canonical shape).

## How to run

```bash
pnpm test:integration   # this file only, one emulator boot
pnpm test               # everything (unit + integration + e2e + functions) under one emulator boot
```
```

- [ ] **Step 4: Run the integration suite under the orchestrator**

Run: `pnpm test:integration 2>&1 | tail -15`

Expected: 2 tests in `villageMemberServiceIntegration.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/test/integration/villageMemberServiceIntegration.test.ts packages/shared/test/integration/README.md
git commit -m "test(integration): seed service integration harness with villageMemberService"
```

---

### Task 6: Rewrite root `pnpm test` and add `pnpm test:unit`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read the current root scripts block**

Run: `grep -nE '"(test|check)' package.json`

Confirm `test`, `test:integration`, `test:rules`, `test:functions`, `test:emulators`, `check` are present and laid out as expected (lines ~27-32).

- [ ] **Step 2: Rewrite `test`, add `test:unit`, keep escape hatches**

Use `node` to edit `package.json` in-place (preserves JSON formatting):

```bash
node -e '
const fs = require("fs");
const p = "package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const s = j.scripts;
// Fast inner loop: pure-JS tests, no emulator.
s["test:unit"] = "pnpm shared:test && pnpm app:test && pnpm functions:test";
// Default test: boots emulator once, runs all node-side tests inside.
s["test"] = "node scripts/run-tests-with-emulators.mjs --label shared pnpm --filter @cultuvilla/shared test:all --label functions pnpm --prefix functions run test:all --label mobile pnpm app:test";
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
'
grep -E '"(test|test:unit|test:integration|test:rules|test:functions|test:emulators|check)' package.json
```

Expected output (after the grep):

```
    "test": "node scripts/run-tests-with-emulators.mjs --label shared pnpm --filter @cultuvilla/shared test:all --label functions pnpm --prefix functions run test:all --label mobile pnpm app:test",
    "test:unit": "pnpm shared:test && pnpm app:test && pnpm functions:test",
    "test:integration": "node scripts/run-tests-with-emulators.mjs pnpm --filter @cultuvilla/shared test:integration",
    "test:rules": "ONLY=firestore node scripts/run-tests-with-emulators.mjs pnpm --filter @cultuvilla/shared test:rules",
    "test:functions": "node scripts/run-tests-with-emulators.mjs npm --prefix functions run test:integration",
    "test:emulators": "pnpm test:integration && pnpm test:rules && pnpm test:functions",
    "check": "pnpm typecheck && pnpm test && pnpm build",
```

- [ ] **Step 3: Verify `pnpm test:unit` runs without an emulator**

Run: `pnpm test:unit 2>&1 | tail -10`

Expected: shared vitest unit suite + mobile jest suite + functions vitest unit suite all pass; no Firebase emulator process started.

- [ ] **Step 4: Verify the unified `pnpm test` runs all three labels under one emulator**

Run: `pnpm test 2>&1 | tail -25`

Expected:
- One `[emulators] starting` line.
- One `[emulators] ready` line.
- Three `[tests] <label>:` headers (shared, functions, mobile) in order.
- All three children green.
- One `[emulators]` shutdown sequence at the end.
- Exit code 0.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore(test): pnpm test boots emulator once + runs all node-side tests; add pnpm test:unit"
```

---

### Task 7: Consolidate CI emulator job into the unified `pnpm test`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the current CI workflow**

Run: `cat .github/workflows/ci.yml`

The current shape: two jobs — `ci` (lint/typecheck/unit/build) and `emulator-tests` (integration + rules + functions in three separate emulator boots).

- [ ] **Step 2: Update the `ci` job's test step to run only the fast unit suite**

In `.github/workflows/ci.yml`, change line 60 from:

```yaml
      - name: Test (unit — shared, mobile, functions)
        run: pnpm test
```

to:

```yaml
      - name: Test (unit — shared, mobile, functions)
        run: pnpm test:unit
```

(`pnpm test` now boots the emulator, which the `ci` job doesn't have set up. Unit-only here keeps the fast PR-feedback intent of this job.)

- [ ] **Step 3: Replace the three test steps in `emulator-tests` with a single `pnpm test`**

In the `emulator-tests` job, replace these three steps:

```yaml
      - name: Integration tests (@cultuvilla/shared)
        run: pnpm test:integration

      - name: Firestore rules tests
        run: pnpm test:rules

      - name: Cloud Functions tests
        run: pnpm test:functions
```

with this single step:

```yaml
      - name: All emulator-backed tests (shared + functions + mobile, one emulator boot)
        run: pnpm test
        env:
          VITEST_RETRY_COUNT: '1'
```

(The orchestrator already defaults `VITEST_RETRY_COUNT=1` for its children, but setting it at the workflow level documents the intent and lets a future maintainer bump it without editing the script.)

- [ ] **Step 4: Yaml-lint the change**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"` — if `js-yaml` isn't available, fall back to:

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`

Expected: exit 0 (file is valid YAML).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: emulator-tests job runs unified pnpm test (single emulator boot)"
```

---

### Task 8: Final verification + open PR

**Files:** none modified.

- [ ] **Step 1: Run the full canonical command set locally**

Run each of these and confirm exit 0:

```bash
pnpm test:unit
pnpm test
pnpm test:rules
pnpm test:integration
pnpm test:functions
pnpm typecheck
pnpm build
```

Capture the final tail of each output for the PR description.

- [ ] **Step 2: Sanity-check the git log**

Run: `git log --oneline main..HEAD`

Expected: 7 commits, one per task (1–7), in order.

- [ ] **Step 3: Push the branch**

Run:
```bash
git push -u origin worktree-unify-test-pipeline
```

- [ ] **Step 4: Open the PR via gh**

Run:
```bash
gh pr create --base main --head worktree-unify-test-pipeline \
  --title "test: unify pipeline — pnpm test boots emulator once" \
  --body "$(cat <<'EOF'
## Summary

- `pnpm test` now boots the Firebase emulator once and runs every node-side test (shared + functions + mobile jest) in a single pass.
- New `pnpm test:unit` skips the emulator for the fast inner loop.
- Each vitest config reads `VITEST_RETRY_COUNT` (orchestrator-defaulted to `1`) so transient gRPC stutters don't redden CI.
- Service-level integration harness seeded with `villageMemberServiceIntegration.test.ts` — exactly the surface of the bug fixed in the previous PR.
- CI emulator-tests job replaces three sequential boots with one `pnpm test` step.

See [docs/superpowers/specs/2026-05-29-unify-test-pipeline-design.md](docs/superpowers/specs/2026-05-29-unify-test-pipeline-design.md) for the design.

## Test plan

- [ ] `pnpm test:unit` exits 0, no emulator process started.
- [ ] `pnpm test` boots emulator exactly once and runs shared (all) + functions (all) + mobile jest; exits 0.
- [ ] `pnpm test:rules`, `pnpm test:integration`, `pnpm test:functions` all still work (each boots its own emulator).
- [ ] `pnpm check` (typecheck + test + build) green.
- [ ] CI green on both `ci` and `emulator-tests` jobs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report the PR URL back to the user.**

---
