# Firebase App Check Rollout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable [Firebase App Check](https://firebase.google.com/docs/app-check) on cultuvilla so Firebase rejects requests that don't come from our real Web app. This limits the abuse surface that the public API keys (apiKey, projectId, etc.) currently expose — App Check is the "is this request from my real app?" layer that the rules can't enforce alone.

**Status:** Not started. Code wiring deferred until the user is ready to set up reCAPTCHA Enterprise keys in each Firebase project.

**Architecture:** A single per-env opt-in via `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV>`. The shared Firebase init (`packages/shared/src/firebase/firebaseApp.ts`) reads the site key from the resolved env config and, when present and running in a browser, calls `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })` BEFORE `getAuth/getFirestore/getStorage/getFunctions`. When the env var is blank, App Check is silently skipped — allows phased rollout per env.

**Tech Stack:** Firebase SDK (`firebase/app-check`, included in the existing `firebase@^11` dep), reCAPTCHA Enterprise (GCP Security service), TypeScript, Vitest.

---

## Why later, not now

- Each Firebase project needs a reCAPTCHA Enterprise site key created in GCP Console first; until that exists, App Check tokens can't be minted.
- Enabling App Check too eagerly with "enforced" mode would block all legit traffic until tokens were verified — must observe in "unenforced" mode first.
- Cultuvilla has no abusive traffic today (small pilot), so the urgency is low. App Check becomes load-bearing when the app has real users and the apiKey is being scraped.

## File Map

### Modify

- `packages/shared/src/config/environments.ts` — add optional `recaptchaSiteKey?: string` field on `FirebaseWebConfig`; read from `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV>` in each `readConfig` branch.
- `packages/shared/src/firebase/firebaseApp.ts` — import `initializeAppCheck` and `ReCaptchaEnterpriseProvider` from `firebase/app-check`; init App Check after `initializeApp` but before `getAuth` (browser-only via `typeof window !== "undefined"` guard).
- `packages/shared/test/config/environments.test.ts` — extend tests to cover the new field (passthrough when set, undefined when not set).
- `apps/web/.env.example` — add `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV>=` rows under each env block with a short comment explaining where to obtain the value.
- `apps/web/.env.local` — same, locally (gitignored).
- `docs/ENVIRONMENTS.md` — new "App Check" section with reCAPTCHA Enterprise setup steps, Firebase console registration, env-var wiring, and the unenforced → enforced rollout sequence. Add step 9 in "Setting up a new Firebase project" pointing at it.

### No changes needed

- No new dependencies — `firebase/app-check` ships with the `firebase` package already pinned in `apps/web/package.json` and `packages/shared/package.json`.
- No CI changes — App Check is opt-in via env var; CI's placeholder `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_DEV` being blank means App Check is skipped during the test build.

## Console prerequisites (per env)

Each Firebase project (`villa-events`, `cultuvilla-beta`, `cultuvilla-prod`) needs:

1. **reCAPTCHA Enterprise key** in GCP console:
   - Security → reCAPTCHA Enterprise → Create key
   - Key type: **Website**
   - Domains: `localhost`, the Firebase Hosting domains (`villa-events.web.app` / `cultuvilla-beta.web.app` / `cultuvilla-prod.web.app` plus their `.firebaseapp.com` aliases), and any apex domain in use
   - Copy the **site key**

2. **App Check provider registration** in Firebase console:
   - App Check → Apps tab → Web app → "reCAPTCHA Enterprise"
   - Paste site key → save

Without both of these, the client code will fail to fetch tokens.

## Tasks

### Task 1: Add `recaptchaSiteKey` to the config schema

**Files:**
- Modify: `packages/shared/src/config/environments.ts:24-33` (the `FirebaseWebConfig` interface)
- Modify: `packages/shared/src/config/environments.ts:53-86` (the three `readConfig` branches)
- Test: `packages/shared/test/config/environments.test.ts`

- [ ] **Step 1: Write failing test for recaptchaSiteKey passthrough**

Add to `getFirebaseConfig` describe block:

```ts
it('includes recaptchaSiteKey when set', () => {
  stubEnv('PROD', { NEXT_PUBLIC_RECAPTCHA_SITE_KEY_PROD: '6Lc-XXX-test-key' });
  expect(getFirebaseConfig('prod').recaptchaSiteKey).toBe('6Lc-XXX-test-key');
});

it('omits recaptchaSiteKey when not set (App Check stays disabled)', () => {
  stubEnv('DEV');
  expect(getFirebaseConfig('dev').recaptchaSiteKey).toBeUndefined();
});
```

Also extend the existing `'returns the dev config when env vars are present'` test's expected object to include `recaptchaSiteKey: undefined`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @cultuvilla/shared test test/config/environments.test.ts`
Expected: FAIL with "Property 'recaptchaSiteKey' does not exist on type 'FirebaseWebConfig'".

- [ ] **Step 3: Add the field and the env-var reads**

In `packages/shared/src/config/environments.ts`:

```ts
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Only set when the project has Google Analytics enabled. */
  measurementId?: string;
  /**
   * reCAPTCHA Enterprise site key for Firebase App Check. When set,
   * the browser-side Firebase init wires App Check with this site key;
   * when omitted, App Check is skipped (requests reach Firebase without
   * App Check tokens, which is fine while enforcement is disabled in
   * the Firebase console).
   */
  recaptchaSiteKey?: string;
}
```

Then in each of the three `case` branches in `readConfig`, add the matching env-var read as the last field. Example for `'dev'`:

```ts
return {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_DEV ?? '',
  // ... existing fields ...
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_DEV,
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY_DEV,
};
```

(Same pattern for `'beta'` → `_BETA`, `'prod'` → `_PROD`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test test/config/environments.test.ts`
Expected: PASS (all tests, including the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/config/environments.ts packages/shared/test/config/environments.test.ts
git commit -m "feat(env): add optional recaptchaSiteKey to FirebaseWebConfig for App Check"
```

### Task 2: Wire `initializeAppCheck` in firebaseApp.ts

**Files:**
- Modify: `packages/shared/src/firebase/firebaseApp.ts`

- [ ] **Step 1: Add the import + init block**

Replace the contents with:

```ts
import { initializeApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getFirebaseConfig } from "../config/environments";

const firebaseConfig = getFirebaseConfig(process.env.NEXT_PUBLIC_APP_ENV);

export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase App Check — browser-only, opt-in via NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV>.
// Initialised BEFORE auth/firestore/storage/functions so the first service
// calls already carry App Check tokens. ReCaptchaEnterpriseProvider touches
// window/document so it must not run during SSR.
if (
  typeof window !== "undefined" &&
  typeof firebaseConfig.recaptchaSiteKey === "string" &&
  firebaseConfig.recaptchaSiteKey.length > 0
) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(firebaseConfig.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');
```

- [ ] **Step 2: Verify build still passes with App Check skipped (no site key set)**

Run: `pnpm check`
Expected: All tests pass; web build generates static pages without errors. App Check is silently skipped because no `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_*` env vars are set during the build.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/firebase/firebaseApp.ts
git commit -m "feat(security): wire Firebase App Check (opt-in via recaptchaSiteKey)"
```

### Task 3: Update env templates

**Files:**
- Modify: `apps/web/.env.example`
- Modify: `apps/web/.env.local` (locally only; gitignored)

- [ ] **Step 1: Add the new lines to `.env.example`**

Under each env block, add:

```
NEXT_PUBLIC_RECAPTCHA_SITE_KEY_DEV=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY_BETA=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY_PROD=
```

Plus a short note in the header comment about how to obtain values (Firebase console → App Check → Web app → reCAPTCHA Enterprise → register, paste site key).

- [ ] **Step 2: Mirror the lines in local `.env.local`**

Add the same three lines blank (or with real values if you've already set up reCAPTCHA Enterprise for any env).

- [ ] **Step 3: Commit `.env.example` only**

```bash
git add apps/web/.env.example
git commit -m "docs(env): add NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV> placeholders"
```

### Task 4: Document App Check in `docs/ENVIRONMENTS.md`

**Files:**
- Modify: `docs/ENVIRONMENTS.md`

- [ ] **Step 1: Add an "App Check" section after "Firebase Auth providers"**

Content covers:
1. What App Check is and why we use it.
2. That client wiring is in `firebaseApp.ts` and opt-in via `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV>`.
3. **Setup per environment** numbered steps: (a) create reCAPTCHA Enterprise key in GCP, (b) register provider in Firebase console, (c) add site key to env vars, (d) redeploy, (e) leave unenforced for ≥24h then flip to enforced.
4. **Local development debug tokens** — how to use `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` for localhost.

- [ ] **Step 2: Update the "Setting up a new Firebase project" section**

Add a step 9: "(Recommended) **App Check** — see the next section for the per-env setup."

- [ ] **Step 3: Commit**

```bash
git add docs/ENVIRONMENTS.md
git commit -m "docs(env): document Firebase App Check setup"
```

### Task 5: Per-env enablement (manual, when ready)

Repeat for each of `villa-events`, `cultuvilla-beta`, `cultuvilla-prod`. Start with **prod** (highest abuse risk), then beta, then dev.

- [ ] **Step 1: Create reCAPTCHA Enterprise key in GCP console**

   - GCP console → switch to project (`cultuvilla-prod`, etc.) → Security → reCAPTCHA Enterprise → "Create key"
   - Key type: **Website**
   - Domains:
     - For prod: apex domain (when configured), `cultuvilla-prod.web.app`, `cultuvilla-prod.firebaseapp.com`
     - For beta: `cultuvilla-beta.web.app`, `cultuvilla-beta.firebaseapp.com` (plus beta subdomain if/when configured)
     - For dev: `localhost`, `villa-events.web.app`, `villa-events.firebaseapp.com`
   - Copy the site key (looks like `6Lc...`).

- [ ] **Step 2: Register the provider in Firebase console**

   - Firebase console → App Check → Apps tab → click the Web app → "reCAPTCHA Enterprise"
   - Paste site key → Save
   - Set token TTL to default (1 hour).

- [ ] **Step 3: Add the site key to env vars**

   - Local + deploys: edit `apps/mobile/.env` and fill `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_<ENV>`. Expo bakes the value into the static bundle at build time, so the deployer's local env is the source of truth — there is no central secret store for Hosting.

- [ ] **Step 4: Redeploy**

   - Run `pnpm deploy:hosting:<env>` from the deployer's machine.
   - Local: restart the Expo dev server.

- [ ] **Step 5: Verify in browser**

   - Open the deployed (or local) app.
   - Open dev tools → Network tab → filter `appcheck`.
   - First Firebase request should have an `X-Firebase-AppCheck` header.
   - No JS console errors related to App Check.

- [ ] **Step 6: Watch metrics in unenforced mode**

   - Firebase console → App Check → Firestore tab → "Metrics".
   - Leave "Enforce" toggle **off** for ≥24h.
   - The metric "Verified requests / Total" should climb to ~100% as new sessions adopt tokens.

- [ ] **Step 7: Enforce**

   - Once verified rate is at 100% and you've checked beta/dev are also serving valid tokens:
     - Firebase console → App Check → Firestore → toggle "Enforce" on.
     - Same for Storage and Cloud Functions.
   - Watch for spikes in rejected requests — if legit traffic gets blocked, toggle back to unenforced and investigate which clients aren't sending tokens.

- [ ] **Step 8: (Optional) Set up debug tokens for local dev**

   - In a dev tools console with the app loaded: `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`, reload.
   - The console prints a UUID. Paste it into Firebase console → App Check → Apps → "Manage debug tokens" with a descriptive name (e.g. "alvaro-laptop-2026-05").
   - Localhost can now use Firestore/Storage in enforced mode without a real reCAPTCHA challenge.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Enabling enforce too early blocks legit traffic | Always leave unenforced for ≥24h before flipping. Watch the "verified requests" metric climb to 100% first. |
| reCAPTCHA Enterprise key restricted to wrong domains | The key is domain-scoped at creation. If wrong, can be edited in GCP console — add the missing domain and wait a few minutes for propagation. |
| SSR builds fail because `ReCaptchaEnterpriseProvider` touches `window` | Code guards with `typeof window !== "undefined"`. Verify with `pnpm check` after Task 2. |
| Cloud Functions can also enforce App Check (`onCall` functions accept `enforceAppCheck: true` option) | Out of scope for this plan. Document as a separate follow-up once Firestore/Storage are enforced. |
| Debug tokens leak via Slack/email | Treat as secrets. Per-developer-per-laptop; rotate via Firebase console if leaked. |

## Acceptance criteria

- [ ] `FirebaseWebConfig.recaptchaSiteKey` exists as an optional field, documented inline.
- [ ] Tests cover both passthrough (env var set → field populated) and opt-out (env var blank → field undefined).
- [ ] `firebaseApp.ts` calls `initializeAppCheck` only when running in a browser AND `recaptchaSiteKey` is a non-empty string.
- [ ] `pnpm check` passes with `NEXT_PUBLIC_RECAPTCHA_SITE_KEY_DEV` blank (App Check skipped during the test build).
- [ ] `apps/web/.env.example` lists the new var under each env block with a header comment pointing to console setup.
- [ ] `docs/ENVIRONMENTS.md` has a dedicated App Check section with setup + rollout sequence; "Setting up a new Firebase project" references it.
- [ ] At least one env (prod) has the full console setup done, tokens are minted in the browser, and metrics show ~100% verified requests.
- [ ] Enforce mode is enabled on Firestore + Storage on at least one env.

## Follow-ups (out of scope)

- **App Check on Cloud Functions** (`onCall` HTTPS callables). `acceptInvite` and `updateCenso` in `functions/src/` would accept an `{ enforceAppCheck: true }` option. Defer until Firestore/Storage enforce mode is stable.
- **App Check token observability**. If/when we want to attribute traffic to clients, we could log App Check verdicts in Firestore rules via `request.appCheckToken`. Useful for incident investigation, not needed day-one.
- **Mobile App Check** (DeviceCheck / Play Integrity). When `apps/mobile` arrives, App Check has analogous providers; the design here doesn't constrain mobile.
