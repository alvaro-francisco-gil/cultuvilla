# App versioning + force-update gate

**Goal:** Adopt a coherent app version scheme, tag releases, surface the running version in-app, and add a server-controlled force-update gate — so the move from continuous web deploys to store-published binaries doesn't leave old clients breaking silently against a moving backend.

## Context

Today the app ships only via Firebase Hosting (continuous web deploys: `main` deploys and everyone is instantly on latest). Next month it moves to the App Store / Play Store, which introduces one new hard constraint web never had: **many client versions run in the wild simultaneously, and a bad build can't be recalled.** A user can run a months-old binary indefinitely; there is no redeploy that fixes them.

This matters acutely here because `AGENTS.md` mandates a **no-retrocompat rule** — we deliberately ship client-breaking Firestore schema / rules / callable-signature changes. On web that's fine (everyone's on latest instantly). In the stores, an old client hits the new backend and breaks with no recourse unless we can gate it.

Current versioning state (as surveyed):

- `apps/mobile/app.config.ts` hardcodes `version: '0.1.0'` — one value across dev/beta/prod, with no discipline about when/why it changes.
- `apps/mobile/eas.json` already sets `appVersionSource: "remote"` + `autoIncrement: true` for the `production` profile, so the **build number** (iOS `buildNumber` / Android `versionCode`) is handled by EAS remotely. No change needed there.
- Root `package.json` is `1.0.0` and never moves (meaningless); `apps/mobile/package.json` is `0.1.0`.
- **0 git tags.** CHANGELOG uses dated sections and explicitly states "not semver releases."
- No crash reporting / analytics wired yet.
- Branch model: `develop → beta → main`, each auto-deploying to its Firebase env (dev `villa-events` / beta `cultuvilla-beta` / prod `cultuvilla-prod`). `main` forbids direct pushes.

## Design / approach

### 1. Version scheme

- **Single source of truth = `app.config.ts` `version`**, semver `MAJOR.MINOR.PATCH`. The `package.json` version fields are irrelevant to stores; sync `apps/mobile/package.json` to match for tidiness, leave root `package.json` alone.
- **Bump semantics:** MAJOR = redesign or user-visible breaking migration; MINOR = new feature/screen/flow; PATCH = fixes/polish.
- **First store release: `0.1.0` → `1.0.0`** at the first `main` promotion that ships to stores.
- **Build number:** unchanged — EAS `appVersionSource: "remote"` + `autoIncrement` continues to own it.

### 2. Release process (mapped to develop → beta → main)

- **The marketing version is set in the `develop → beta` promotion PR** (beta is the release candidate). It rides unchanged into `main`. Multiple beta builds of one version are fine — build numbers auto-increment independently (v1.2.0 build 41, 42, …).
- **Tag `vX.Y.Z` on the `main` merge commit** and push it — the audit trail currently missing (0 tags).
- **CHANGELOG stays dated**, but a cut release gets a version marker in the heading: `## v1.2.0 — YYYY-MM-DD`. `[Unreleased]` becomes that section on cut. No format change, just a stamp.
- Kept **manual** initially; a `scripts/` helper can follow if it becomes repetitive.

### 3. Version visibility

- Surface **marketing version + build number** on the existing profile screen via `expo-application` (`nativeApplicationVersion` / `nativeBuildVersion`) — the true installed-binary values.
- The same read feeds the gate (§4), so it lives in one shared helper.
- **Native rebuild caveat:** adding `expo-application` is a native module install → run a clean prebuild (`expo-native-rebuild` skill). Expected, since native builds are being cut anyway.

### 4. Force-update gate

- **Config source:** a new top-level `config` collection, doc `config/appVersion`:
  ```
  { ios:     { minSupported, latest },
    android: { minSupported, latest },
    storeUrl: { ios, android } }
  ```
  World-readable, updated only by admin/console/script (never client-written).
- **Model + service + rules** per the `add-firestore-collection` skill:
  - Zod model at `packages/shared/src/models/config/appVersion.ts`.
  - `getAppVersionConfig()` in a new `packages/shared/src/services/appConfigService.ts` (strict `makeConverter`).
  - Rules: `config/{doc}` → `allow read: if true; allow write: if false;` + a rules test.
  - `_services-map.md` entry.
- **Pure logic in shared** (this is where the real logic lives; the RN piece stays thin):
  - `compareVersions(a, b)` semver comparator util.
  - `resolveVersionGate(running, config, platform) → 'block' | 'nudge' | 'ok'`.
  - Both unit-tested (vitest): all tiers, per-platform, malformed input.
- **`AppVersionGate` component** wrapping the app tree (near `AuthContext` in the root layout), runs once on launch:
  - `block` (running < minSupported) → full-screen non-dismissible blocker, CTA → store URL.
  - `nudge` (minSupported ≤ running < latest) → app renders + dismissible "update available" banner.
  - `ok` → app renders normally.
  - **Fails open:** config read error / offline → render the app. Never lock a user out over a network blip.
  - **No-ops on web** (`Platform.OS === 'web'`) — web is always latest.
- **Strings** via i18n (`packages/i18n/messages/es.json`, `useT()`).
- **Bump discipline:** tied to the no-retrocompat rule — when a client-breaking backend change ships, bump `minSupported` to the version carrying the client fix, at release time. Document this in the `AGENTS.md` no-retrocompat section.

### 5. Testing

- vitest: `compareVersions` + `resolveVersionGate` (all tiers, platform split, malformed input).
- vitest: `appVersion` model/schema.
- rules test (`packages/shared/test/e2e`): config doc world-readable, not client-writable.
- Mobile jest: light `AppVersionGate` render test if tractable.

### 6. Docs touched in the same change

`_services-map.md`, `AGENTS.md` (new "Versioning & releases" section + no-retrocompat note), CHANGELOG `[Unreleased]`.

## Out of scope (deliberate — YAGNI)

- **Per-package semver** on `@cultuvilla/shared` / `@cultuvilla/i18n` — internal-only, no external consumer. Root `package.json` version stays meaningless.
- **CI release automation** (auto-tag, auto-changelog) — start manual; script if it recurs.
- **Version tagging into analytics / crash reporting** — no crash reporting exists yet; separate future decision.

## Phase 2 (deferred, explicitly not this plan): OTA / EAS Update

Ship JS-only bundles to installed apps without a store review, via `expo-updates` + a `runtimeVersion` policy + channels mapped to `develop`/`beta`/`main`. Complements the force-update gate: OTA fixes JS bugs in minutes (often downgrading a "force everyone to update" emergency to a silent hotfix); the gate handles what OTA can't (native bugs, broken data contracts).

Key facts settled during brainstorming, recorded so phase 2 doesn't relitigate them:

- **Opt-in and configured**, not automatic. Today the JS bundle is baked into the binary at build time and never phones home. OTA is only active once `expo-updates` + config are added.
- **Does not break offline.** Update bundles are downloaded once and cached persistently; the app always runs from a local bundle (embedded or last-downloaded). Network is used only to *discover/download* a newer bundle. Recommended config launches instantly from cache and updates in the background for next launch.
- **Standard practice** for Expo/RN apps, permitted by store rules (Apple 3.3.2) as long as it doesn't change the app's core purpose or add features needing fresh review. Pair with staged rollout + rollback.
- Adds a third "what code is the user running" axis (native shell version vs. OTA bundle id) — log both when this lands.

## Resolved during brainstorming

- Version set at the `develop → beta` promotion; first store release `0.1.0 → 1.0.0`; fail-open gate; `config/appVersion` shape as above.
- **Version visibility uses `expo-constants` (already a dependency), not `expo-application`** — so §3's native-rebuild caveat does not apply. `Constants.nativeAppVersion` / `nativeBuildVersion` (with `expoConfig.version` fallback) give the values.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Architecture:** Pure comparison logic (`compareVersions`, `resolveVersionGate`) and the config model live in `@cultuvilla/shared` and are fully unit-tested; the mobile `AppVersionGate` is a thin consumer that reads `config/appVersion` through `appConfigService`, resolves a gate decision, and renders a blocker, a nudge, or the app. Version-scheme changes are process + docs, not code.

**Tech Stack:** TypeScript (strict), Zod + `makeConverter`, Firestore client SDK, Expo/React Native, `expo-constants`, vitest (shared), `@firebase/rules-unit-testing` (rules), jest (mobile), `firebase-admin` (dev seed).

## Global Constraints

- `strict: true`, **no `any`**, no `@ts-nocheck`. (AGENTS.md §5)
- **No `firebase/*` imports** in mobile screens/components — all Firebase access via a service. (AGENTS.md §1)
- User-facing strings via `useT()` / `@cultuvilla/i18n`. (AGENTS.md i18n)
- The gate **fails open**: any read error, missing doc, or malformed/unparseable version resolves to `'ok'` (app renders). Never lock a user out over a network blip.
- Gate **no-ops on web** (`Platform.OS === 'web'`).
- Version strings are semver `MAJOR.MINOR.PATCH`.
- New collection follows the `add-firestore-collection` skill (model + converter + service + index re-exports + services-map + rules + rules test).

## File Structure

**Create:**
- `packages/shared/src/utils/semver.ts` — `compareVersions`.
- `packages/shared/test/utils/semver.test.ts`
- `packages/shared/src/models/config/AppVersionConfigModel.ts` — Zod schema + type.
- `packages/shared/src/models/config/index.ts` — re-export.
- `packages/shared/test/models/appVersionConfig.test.ts`
- `packages/shared/src/utils/versionGate.ts` — `resolveVersionGate`.
- `packages/shared/test/utils/versionGate.test.ts`
- `packages/shared/src/firebase/converters/appVersionConfigConverter.client.ts`
- `packages/shared/src/services/appConfigService.ts` — `getAppVersionConfig`.
- `packages/shared/test/e2e/appConfigRules.test.ts`
- `scripts/seed-app-version-config.mjs` — idempotent dev seed of `config/appVersion`.
- `apps/mobile/lib/appVersion.ts` — running version/build/platform helpers.
- `apps/mobile/components/AppVersionGate.tsx`
- `apps/mobile/components/__tests__/AppVersionGate.test.tsx`

**Modify:**
- `packages/shared/src/models/index.ts` — `export * from './config'`.
- `packages/shared/src/services/index.ts` — export `appConfigService`.
- `packages/shared/src/services/_services-map.md` — add `config/appVersion` row.
- `firestore.rules` — `config/{docId}` match block.
- `apps/mobile/app/_layout.tsx` — wrap the tree in `AppVersionGate`.
- `apps/mobile/app/(tabs)/profile.tsx` — version + build row.
- `apps/mobile/app/(tabs)/__tests__/profile.test.tsx` — assert the row renders.
- `packages/i18n/messages/es.json` — `appUpdate.*` + `profile.version` strings.
- `AGENTS.md` — new "Versioning & releases" section + no-retrocompat note.
- `CHANGELOG.md` — `[Unreleased]` entry.

---

### Task 1: `compareVersions` semver util

**Files:**
- Create: `packages/shared/src/utils/semver.ts`
- Test: `packages/shared/test/utils/semver.test.ts`

**Interfaces:**
- Produces: `compareVersions(a: string, b: string): -1 | 0 | 1` — throws `Error` on a non-`X.Y.Z` (non-negative integers) input.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { compareVersions } from '../../src/utils/semver';

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
  });

  it('throws on malformed input', () => {
    expect(() => compareVersions('1.2', '1.2.3')).toThrow();
    expect(() => compareVersions('1.2.x', '1.2.3')).toThrow();
    expect(() => compareVersions('', '1.2.3')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/utils/semver.test.ts`
Expected: FAIL — cannot find `../../src/utils/semver`.

- [ ] **Step 3: Write minimal implementation**

```ts
function parse(v: string): [number, number, number] {
  const parts = v.split('.').map((s) => Number(s));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Invalid semver: "${v}"`);
  }
  return [parts[0], parts[1], parts[2]];
}

/** Compare two `MAJOR.MINOR.PATCH` strings numerically. Throws on malformed input. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/utils/semver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/semver.ts packages/shared/test/utils/semver.test.ts
git commit -m "feat(shared): add compareVersions semver util"
```

---

### Task 2: `AppVersionConfig` model + converter

**Files:**
- Create: `packages/shared/src/models/config/AppVersionConfigModel.ts`
- Create: `packages/shared/src/models/config/index.ts`
- Create: `packages/shared/src/firebase/converters/appVersionConfigConverter.client.ts`
- Modify: `packages/shared/src/models/index.ts`
- Test: `packages/shared/test/models/appVersionConfig.test.ts`

**Interfaces:**
- Produces: `AppVersionConfigSchema` (Zod), `type AppVersionConfig = { ios: PlatformVersions; android: PlatformVersions; storeUrl: { ios: string; android: string } }` where `PlatformVersions = { minSupported: string; latest: string }`; `appVersionConfigConverterClient`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { AppVersionConfigSchema } from '../../src/models/config';

const valid = {
  ios: { minSupported: '1.0.0', latest: '1.2.0' },
  android: { minSupported: '1.0.0', latest: '1.2.0' },
  storeUrl: { ios: 'https://apps.apple.com/app/id0', android: 'https://play.google.com/store/apps/details?id=x' },
};

describe('AppVersionConfigSchema', () => {
  it('accepts a well-formed config', () => {
    expect(AppVersionConfigSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a config missing a platform', () => {
    const { android: _drop, ...rest } = valid;
    expect(() => AppVersionConfigSchema.parse(rest)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/models/appVersionConfig.test.ts`
Expected: FAIL — cannot find `../../src/models/config`.

- [ ] **Step 3: Write the model, index, converter, and re-export**

`packages/shared/src/models/config/AppVersionConfigModel.ts`:
```ts
import { z } from 'zod';

const PlatformVersionsSchema = z.object({
  minSupported: z.string(),
  latest: z.string(),
});

export const AppVersionConfigSchema = z.object({
  ios: PlatformVersionsSchema,
  android: PlatformVersionsSchema,
  storeUrl: z.object({
    ios: z.string(),
    android: z.string(),
  }),
});
export type AppVersionConfig = z.infer<typeof AppVersionConfigSchema>;
```

`packages/shared/src/models/config/index.ts`:
```ts
export * from './AppVersionConfigModel';
```

`packages/shared/src/firebase/converters/appVersionConfigConverter.client.ts` (mirror the imports in `personConverter.client.ts` — `clientSdkCtors` comes from `./sdkAdapters.client`):
```ts
import { AppVersionConfigSchema } from '../../models/config';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';

export const appVersionConfigConverterClient = makeConverter(AppVersionConfigSchema, clientSdkCtors);
```

Append to `packages/shared/src/models/index.ts`:
```ts
export * from './config'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/models/appVersionConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/config packages/shared/src/models/index.ts \
  packages/shared/src/firebase/converters/appVersionConfigConverter.client.ts \
  packages/shared/test/models/appVersionConfig.test.ts
git commit -m "feat(shared): add AppVersionConfig model + client converter"
```

---

### Task 3: `resolveVersionGate` decision function

**Files:**
- Create: `packages/shared/src/utils/versionGate.ts`
- Test: `packages/shared/test/utils/versionGate.test.ts`

**Interfaces:**
- Consumes: `compareVersions` (Task 1), `AppVersionConfig` (Task 2).
- Produces: `type GateDecision = 'block' | 'nudge' | 'ok'`; `resolveVersionGate(running: string, config: AppVersionConfig | null, platform: 'ios' | 'android' | 'web'): GateDecision`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveVersionGate } from '../../src/utils/versionGate';
import type { AppVersionConfig } from '../../src/models/config';

const config: AppVersionConfig = {
  ios: { minSupported: '1.2.0', latest: '1.5.0' },
  android: { minSupported: '1.1.0', latest: '1.5.0' },
  storeUrl: { ios: 'x', android: 'y' },
};

describe('resolveVersionGate', () => {
  it('blocks below minSupported', () => {
    expect(resolveVersionGate('1.1.0', config, 'ios')).toBe('block');
  });
  it('nudges between minSupported and latest', () => {
    expect(resolveVersionGate('1.3.0', config, 'ios')).toBe('nudge');
  });
  it('is ok at or above latest', () => {
    expect(resolveVersionGate('1.5.0', config, 'ios')).toBe('ok');
    expect(resolveVersionGate('2.0.0', config, 'ios')).toBe('ok');
  });
  it('uses the per-platform floor', () => {
    expect(resolveVersionGate('1.1.0', config, 'android')).toBe('nudge');
  });
  it('fails open on web', () => {
    expect(resolveVersionGate('0.0.1', config, 'web')).toBe('ok');
  });
  it('fails open on null config or malformed version', () => {
    expect(resolveVersionGate('1.0.0', null, 'ios')).toBe('ok');
    expect(resolveVersionGate('garbage', config, 'ios')).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/utils/versionGate.test.ts`
Expected: FAIL — cannot find `../../src/utils/versionGate`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { compareVersions } from './semver';
import type { AppVersionConfig } from '../models/config';

export type GateDecision = 'block' | 'nudge' | 'ok';

/**
 * Decide whether a running client must update. Fails open ('ok') on web, a
 * missing config, or any unparseable version — the gate must never brick the
 * app over a bad read.
 */
export function resolveVersionGate(
  running: string,
  config: AppVersionConfig | null,
  platform: 'ios' | 'android' | 'web',
): GateDecision {
  if (platform === 'web' || !config) return 'ok';
  const { minSupported, latest } = config[platform];
  try {
    if (compareVersions(running, minSupported) < 0) return 'block';
    if (compareVersions(running, latest) < 0) return 'nudge';
    return 'ok';
  } catch {
    return 'ok';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared exec vitest run test/utils/versionGate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/versionGate.ts packages/shared/test/utils/versionGate.test.ts
git commit -m "feat(shared): add resolveVersionGate decision logic"
```

---

### Task 4: `appConfigService.getAppVersionConfig`

**Files:**
- Create: `packages/shared/src/services/appConfigService.ts`
- Modify: `packages/shared/src/services/index.ts`, `packages/shared/src/services/_services-map.md`

**Interfaces:**
- Consumes: `appVersionConfigConverterClient` (Task 2), `getDb` from `../firebase`.
- Produces: `getAppVersionConfig(): Promise<AppVersionConfig | null>` — returns `null` on missing doc or any error (fail open).

- [ ] **Step 1: Write the service**

`packages/shared/src/services/appConfigService.ts`:
```ts
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '../firebase';
import { appVersionConfigConverterClient } from '../firebase/converters/appVersionConfigConverter.client';
import type { AppVersionConfig } from '../models/config';

const CONFIG_COLLECTION = 'config';
const APP_VERSION_DOC = 'appVersion';

/**
 * Read the published min/latest version config. Returns null on a missing doc
 * or ANY error (network, malformed doc) — the force-update gate treats null as
 * 'ok' so a bad read can never brick the app.
 */
export async function getAppVersionConfig(): Promise<AppVersionConfig | null> {
  try {
    const ref = doc(getDb(), CONFIG_COLLECTION, APP_VERSION_DOC).withConverter(
      appVersionConfigConverterClient,
    );
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Export it**

Append to `packages/shared/src/services/index.ts` (match the file's existing export style):
```ts
export * from './appConfigService'
```

- [ ] **Step 3: Document the collection**

Add a row to `packages/shared/src/services/_services-map.md` under the collection catalogue:
```
| `config/appVersion` | `appConfigService` | Public read-only min/latest app version + store URLs, per platform. Written by admin/seed script only. Read by the mobile force-update gate. |
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @cultuvilla/shared exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/appConfigService.ts packages/shared/src/services/index.ts \
  packages/shared/src/services/_services-map.md
git commit -m "feat(shared): add appConfigService.getAppVersionConfig (fail-open)"
```

---

### Task 5: Firestore rules for `config/{docId}` + rules test

**Files:**
- Modify: `firestore.rules`
- Test: `packages/shared/test/e2e/appConfigRules.test.ts`

**Interfaces:**
- Produces: `config/{docId}` is world-readable, never client-writable.

- [ ] **Step 1: Write the failing rules test** (mirror the harness setup of a sibling in `packages/shared/test/e2e/`, e.g. `usersRules.test.ts` — `initializeTestEnvironment`, `assertSucceeds`, `assertFails`; copy its exact rules-path + options):

```ts
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'cultuvilla-rules-test',
    firestore: { rules: readFileSync('../../firestore.rules', 'utf8') },
  });
});
afterAll(async () => env.cleanup());
beforeEach(async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config/appVersion'), {
      ios: { minSupported: '1.0.0', latest: '1.0.0' },
      android: { minSupported: '1.0.0', latest: '1.0.0' },
      storeUrl: { ios: 'x', android: 'y' },
    });
  });
});

describe('config rules', () => {
  it('allows an unauthenticated client to read config', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'config/appVersion')));
  });
  it('denies client writes to config', async () => {
    const db = env.authenticatedContext('u1').firestore();
    await assertFails(setDoc(doc(db, 'config/appVersion'), { ios: {} }));
  });
});
```

> Confirm the `firestore.rules` relative path and `initializeTestEnvironment` options against the sibling test before running — copy them verbatim if they differ.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:rules` (emulator-backed — **ask the user to run it** if the emulator isn't already up; do not boot it yourself per AGENTS.md).
Expected: the read test fails (default-deny) until the rule is added.

- [ ] **Step 3: Add the rule**

In `firestore.rules`, inside `match /databases/{database}/documents { … }`, add:
```
    // Public read-only app config (force-update gate). Written by admin/seed
    // script via the admin SDK, never by clients.
    match /config/{docId} {
      allow read: if true;
      allow write: if false;
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:rules`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules packages/shared/test/e2e/appConfigRules.test.ts
git commit -m "feat(rules): public-read/no-client-write config/{docId}"
```

---

### Task 6: Seed the dev `config/appVersion` doc

**Files:**
- Create: `scripts/seed-app-version-config.mjs`

**Interfaces:** none exported — a one-off idempotent admin script (see `firebase-admin-dev` skill; mirror `scripts/backfill-municipality-namelower.mjs` for the project-id guard + admin init).

- [ ] **Step 1: Write the script**

```js
// Idempotent: seeds config/appVersion in the dev project only.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DEV_PROJECT = 'villa-events';

const app = initializeApp({
  credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
});
const db = getFirestore(app);

if (app.options.projectId && app.options.projectId !== DEV_PROJECT) {
  throw new Error(`Refusing to seed non-dev project: ${app.options.projectId}`);
}

const ref = db.collection('config').doc('appVersion');
await ref.set(
  {
    ios: { minSupported: '1.0.0', latest: '1.0.0' },
    android: { minSupported: '1.0.0', latest: '1.0.0' },
    storeUrl: {
      ios: 'https://apps.apple.com/app/id000000000',
      android: 'https://play.google.com/store/apps/details?id=com.cultuvilla.app',
    },
  },
  { merge: true },
);
console.log('Seeded config/appVersion');
process.exit(0);
```

- [ ] **Step 2: Run it** (dev is autonomous per AGENTS.md; needs `GOOGLE_APPLICATION_CREDENTIALS`)

Run: `node scripts/seed-app-version-config.mjs`
Expected: `Seeded config/appVersion`.

- [ ] **Step 3: Verify conformance**

Run: `pnpm check:dev-conformance`
Expected: `config/appVersion` conforms (no nonconforming docs reported for it).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-app-version-config.mjs
git commit -m "chore(scripts): seed dev config/appVersion doc"
```

---

### Task 7: Mobile running-version helper

**Files:**
- Create: `apps/mobile/lib/appVersion.ts`
- Test: `apps/mobile/lib/__tests__/appVersion.test.ts`

**Interfaces:**
- Produces: `getRunningVersion(): string`, `getRunningBuild(): string`, `getGatePlatform(): 'ios' | 'android' | 'web'`.

- [ ] **Step 1: Write the failing test** (mock `expo-constants`)

```ts
import { getRunningVersion, getRunningBuild } from '../appVersion';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { nativeAppVersion: '1.4.0', nativeBuildVersion: '42', expoConfig: { version: '1.4.0' } },
}));

describe('appVersion', () => {
  it('reads the native application version', () => {
    expect(getRunningVersion()).toBe('1.4.0');
  });
  it('reads the native build version', () => {
    expect(getRunningBuild()).toBe('42');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm app:test -- appVersion`
Expected: FAIL — cannot find `../appVersion`.

- [ ] **Step 3: Write the helper**

```ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Marketing version of the running binary (falls back to the config value in dev/Expo Go). */
export function getRunningVersion(): string {
  return Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

/** Build number of the running binary. */
export function getRunningBuild(): string {
  return Constants.nativeBuildVersion ?? '0';
}

export function getGatePlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm app:test -- appVersion`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/appVersion.ts apps/mobile/lib/__tests__/appVersion.test.ts
git commit -m "feat(mobile): add running-version helpers via expo-constants"
```

---

### Task 8: `AppVersionGate` component + i18n + wire into layout

**Files:**
- Create: `apps/mobile/components/AppVersionGate.tsx`
- Test: `apps/mobile/components/__tests__/AppVersionGate.test.tsx`
- Modify: `packages/i18n/messages/es.json`, `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `getAppVersionConfig` (Task 4), `resolveVersionGate` + `GateDecision` (Task 3), `getRunningVersion`/`getGatePlatform` (Task 7), `useT`.
- Produces: `<AppVersionGate>{children}</AppVersionGate>`.

- [ ] **Step 1: Add i18n strings**

In `packages/i18n/messages/es.json`, add a top-level `appUpdate` namespace:
```json
"appUpdate": {
  "blockTitle": "Actualización necesaria",
  "blockBody": "Esta versión ya no es compatible. Actualiza para seguir usando Cultuvilla.",
  "nudge": "Hay una versión nueva disponible.",
  "cta": "Actualizar"
}
```
And under the existing `profile` object add: `"version": "Versión {version} ({build})"`.

- [ ] **Step 2: Ensure the shared barrel re-exports the gate logic**

Confirm `resolveVersionGate`, `GateDecision`, and `getAppVersionConfig` are exported from `@cultuvilla/shared` (via the barrels reached by `packages/shared/src/index.ts`). If `resolveVersionGate`/`GateDecision` aren't re-exported yet, add the utils re-export in this commit.

- [ ] **Step 3: Write the component**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { getAppVersionConfig, resolveVersionGate, type GateDecision } from '@cultuvilla/shared';
import { getRunningVersion, getGatePlatform } from '../lib/appVersion';
import { useT } from '../lib/i18n';

export function AppVersionGate({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [decision, setDecision] = useState<GateDecision | 'loading'>('loading');
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const platform = getGatePlatform();
      const config = await getAppVersionConfig();
      if (!active) return;
      setDecision(resolveVersionGate(getRunningVersion(), config, platform));
      if (config && platform !== 'web') setStoreUrl(config.storeUrl[platform]);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Fail open: while resolving (and on 'ok'/'loading') we render children. The
  // full-screen blocker only appears once we KNOW the client is too old.
  if (decision === 'block') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface p-6">
        <Text className="text-center text-lg font-bold">{t('appUpdate.blockTitle')}</Text>
        <Text className="text-center text-body">{t('appUpdate.blockBody')}</Text>
        {storeUrl ? (
          <Pressable className="rounded-md bg-primary px-4 py-2" onPress={() => Linking.openURL(storeUrl)}>
            <Text className="text-white">{t('appUpdate.cta')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {decision === 'nudge' ? (
        <Pressable
          className="bg-primary px-4 py-2"
          onPress={() => storeUrl && Linking.openURL(storeUrl)}
        >
          <Text className="text-center text-white">{t('appUpdate.nudge')} {t('appUpdate.cta')}</Text>
        </Pressable>
      ) : null}
      {children}
    </>
  );
}
```

- [ ] **Step 4: Write a light render test** (mock the service to force the 'ok' path)

```tsx
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppVersionGate } from '../AppVersionGate';

jest.mock('@cultuvilla/shared', () => ({
  getAppVersionConfig: jest.fn().mockResolvedValue(null),
  resolveVersionGate: jest.fn().mockReturnValue('ok'),
}));
jest.mock('../../lib/appVersion', () => ({
  getRunningVersion: () => '1.0.0',
  getGatePlatform: () => 'ios',
}));
jest.mock('../../lib/i18n', () => ({ useT: () => (k: string) => k }));

it('renders children when the gate is ok', async () => {
  const { getByText } = render(
    <AppVersionGate><Text>child</Text></AppVersionGate>,
  );
  await waitFor(() => expect(getByText('child')).toBeTruthy());
});
```

- [ ] **Step 5: Wire into the layout**

In `apps/mobile/app/_layout.tsx`, wrap the tree so the gate sits inside `I18nProvider` (it needs `useT`) and around the auth providers:
```tsx
<I18nProvider>
  <AppVersionGate>
    <CallableErrorProvider>
      {/* …existing AuthProvider / RegisterGateProvider / AuthGate… */}
    </CallableErrorProvider>
  </AppVersionGate>
</I18nProvider>
```
Add the import: `import { AppVersionGate } from '../components/AppVersionGate';`

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm app:test -- AppVersionGate` then `pnpm app:typecheck`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/AppVersionGate.tsx apps/mobile/components/__tests__/AppVersionGate.test.tsx \
  apps/mobile/app/_layout.tsx packages/i18n/messages/es.json packages/shared/src/index.ts
git commit -m "feat(mobile): add AppVersionGate force-update gate + wire into layout"
```

---

### Task 9: Show the version on the profile screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/(tabs)/__tests__/profile.test.tsx`

**Interfaces:**
- Consumes: `getRunningVersion`, `getRunningBuild` (Task 7), `useT`.

- [ ] **Step 1: Add a failing assertion** to `profile.test.tsx` (mock `../../../lib/appVersion` to return `1.4.0` / `42`, then assert the string renders). Match the file's existing render + mock setup.

```tsx
// add near the other mocks
jest.mock('../../../lib/appVersion', () => ({
  getRunningVersion: () => '1.4.0',
  getRunningBuild: () => '42',
}));
// add inside the describe (use the file's existing render helper)
it('shows the app version', () => {
  const { getByText } = renderProfile();
  expect(getByText(/1\.4\.0/)).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm app:test -- profile`
Expected: FAIL — version text not found.

- [ ] **Step 3: Add the version row** near the bottom of the profile screen JSX:
```tsx
import { getRunningVersion, getRunningBuild } from '../../lib/appVersion';
// …in render, e.g. under the sign-out button:
<Text className="text-center text-caption text-muted">
  {t('profile.version', { version: getRunningVersion(), build: getRunningBuild() })}
</Text>
```
> Confirm the `useT` interpolation syntax against `apps/mobile/lib/i18n.tsx` — if the adapter doesn't interpolate `{version}`, build the string inline instead.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm app:test -- profile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(tabs)/profile.tsx" "apps/mobile/app/(tabs)/__tests__/profile.test.tsx"
git commit -m "feat(mobile): show app version + build on profile screen"
```

---

### Task 10: Document the versioning + release process

**Files:**
- Modify: `AGENTS.md`, `CHANGELOG.md`

**Interfaces:** docs only.

- [ ] **Step 1: Add a "Versioning & releases" subsection** under `## Conventions` in `AGENTS.md`:

```markdown
### Versioning & releases

- **Marketing version** (`app.config.ts` `version`, semver `MAJOR.MINOR.PATCH`) is the single source of truth; `apps/mobile/package.json` mirrors it. MAJOR = redesign/breaking migration, MINOR = new feature, PATCH = fixes.
- **Set the version in the `develop → beta` promotion PR** (beta = release candidate); it rides unchanged into `main`. Build numbers auto-increment (EAS `appVersionSource: remote`).
- **Tag `vX.Y.Z` on the `main` merge commit** and push it.
- **CHANGELOG:** on a cut release, stamp the version into the section heading (`## vX.Y.Z — YYYY-MM-DD`).
- **Force-update gate:** clients read `config/appVersion` on launch (`appConfigService`) and block/nudge via `resolveVersionGate`. When you ship a client-breaking backend change (see *No retrocompat shims*), bump that doc's `minSupported` to the version carrying the client fix, at release time.
```

- [ ] **Step 2: Cross-link from the no-retrocompat rule.** In the `### No retrocompat shims unless asked` section, append a bullet:
```markdown
- If the change breaks older store clients, raise `config/appVersion.minSupported` to the fixed version at release time (see *Versioning & releases*).
```

- [ ] **Step 3: Add a CHANGELOG entry** under `## [Unreleased]` → `### Added`:
```markdown
- **App versioning + force-update gate**: semver marketing version (set at beta promotion, tagged on `main`), in-app version display on the profile screen, and a Firestore-backed (`config/appVersion`) force-update gate (`AppVersionGate` + `resolveVersionGate`, fail-open, no-op on web). OTA/EAS Update deferred to a follow-up.
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CHANGELOG.md
git commit -m "docs: document versioning + release process and force-update gate"
```

---

## Final verification

- [ ] `pnpm check` passes (lint + typecheck + test + build).
- [ ] `pnpm app:test` and `pnpm app:typecheck` pass.
- [ ] Ask the user to run `pnpm test:rules` (emulator) and confirm the `config` rules test is green.
- [ ] Manual: with the dev doc seeded, temporarily set `minSupported` above the running version → blocker renders; set `latest` above running (min below) → nudge banner; restore the doc.
