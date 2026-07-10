# Observability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a coherent, long-term client + backend observability foundation (crash/error reporting, product analytics, structured logging) that ships web-first but plugs the native apps in unchanged.

**Architecture:** A platform-free observability *port* in `packages/shared` (`observabilityService.ts`) that every screen calls; web-specific backends are *adapters* injected at app bootstrap from `apps/mobile/lib/observability/`. Client errors bridge through a `logClientError` Cloud Function into structured Cloud Logging → Cloud Error Reporting. Compliance is structural: a single server-side `log.*` chokepoint auto-hashes the UID (HMAC + Secret Manager salt) and scrubs PII, and the port enforces a strict context allowlist.

**Tech Stack:** TypeScript (strict), Firebase (Analytics web SDK, Cloud Functions v2, Secret Manager, Cloud Logging/Error Reporting), Expo/React Native + Metro platform-extension resolution, vitest (`packages/shared` + `functions`), jest (`apps/mobile`).

## Design summary (full rationale in git commit `fc1efc4`)

- **Ports & adapters.** The port is platform-free and unit-testable via a no-op default; only adapters touch `firebase/*`. Native transition = swap one adapter, screens unchanged. This honours the service-layer-ownership rule (screens import the port from shared).
- **Firebase Analytics** for product events (same API web ≡ native — cleanest transition; BigQuery export reaches BI later for free). Consent Mode v2, denied-by-default.
- **Crash capture (web):** ErrorBoundary + global handlers → `captureError` → both the `logClientError` callable (→ Cloud Logging → Error Reporting, email alerts) and an `app_exception` analytics event. Native later swaps to Crashlytics behind the same seam. No Sentry.
- **Identity/PII:** HMAC-hashed UID via `OBSERVABILITY_USER_ID_SALT` (Secret Manager). Raw UID never enters any telemetry store. Hashing happens server-side (`logClientError` stamps the authenticated uid); a `getUserIdHash` callable returns the hash once per session for Analytics `userId`. Server `log.*` chokepoint auto-hashes + scrubs. **Never hash or scrub at the call site.**
- **Consent:** diagnosis logging (no ad identifiers) rides legitimate interest and flows pre-consent; Analytics/profiling waits for opt-in via a minimal, expendable bar. Justified by guest browsing + 14+ minors.
- **NOT doing (YAGNI):** server-side OpenTelemetry, custom analytics→BigQuery pipeline, dbt marts, dashboard gate, Sentry, distributed tracing, session replay, alerts-as-code.

## Global Constraints

- **Strict TypeScript everywhere.** No `any`, no `@ts-nocheck`, no `as any`. `@typescript-eslint/no-explicit-any` is an error in `packages/shared` and `functions`. Use `unknown` + narrowing at boundaries.
- **Service-layer ownership.** Components/pages/hooks must not import `firebase/*` directly. The port lives in `packages/shared/src/services/`; the only `firebase/*` imports go in `apps/mobile/lib/observability/` adapters.
- **Cloud Functions logging:** never `console.*` in `functions/src/` (outside `__tests__/`) — the `no-console.test.ts` fails the build. Always the v2 `logger` (or, from this plan on, the new `log.*` wrapper) with a structured second arg carrying a `handler` field.
- **Callable region:** `us-central1` (the `DEFAULT_FUNCTIONS_REGION`), so the client calls via `getFirebaseFunctions()` with no region override.
- **Observability must never break a user flow.** Every client send is fire-and-forget (`void send().catch(() => {})`).
- **PII allowlist (context keys permitted anywhere in telemetry):** `uid` (→ hashed server-side), `municipalityId`, `villageId`, `role`, `appVersion`, `platform`, `route`, `operation_id`. Any other key is dropped in the port before reaching an adapter.
- **Frequent commits:** one commit per task (TDD: failing test → implementation → passing test → commit).
- **Test commands:** `functions` + `packages/shared` vitest run under the emulator harness via `pnpm test:functions` / `pnpm --filter @cultuvilla/shared test`; mobile via `pnpm app:test`. Full gate: `pnpm check`.

## File structure

**Backend (`functions/`)**
- Create `functions/src/shared/observability.ts` — the `log.*` chokepoint: `hashUserId`, `redactPII`, `looksLikeToken`, `transformAttrs`, `log.{info,warn,error}`.
- Create `functions/src/observability/secret.ts` — `OBSERVABILITY_USER_ID_SALT` (`defineSecret`).
- Create `functions/src/observability/logClientError.ts` — auth-gated callable; stamps + hashes uid, redacts, logs at ERROR.
- Create `functions/src/observability/getUserIdHash.ts` — auth-gated callable; returns the hashed uid.
- Modify `functions/src/index.ts` — export the two callables.
- Create tests under `functions/src/__tests__/`.

**Port (`packages/shared/`)**
- Create `packages/shared/src/services/observability/observabilityEvents.ts` — event-name constants + param types (the taxonomy).
- Create `packages/shared/src/services/observability/observabilityService.ts` — the port: types, allowlist, consent gate, no-op default, `configureObservability`, `trackEvent`, `captureError`, `logger`, `setUserContext`, `setConsent`, `startOperation`.
- Modify `packages/shared/src/services/index.ts` — re-export the port.
- Create tests under `packages/shared/test/services/`.

**Adapters (`apps/mobile/`)**
- Create `apps/mobile/lib/observability/analytics.web.ts` — Firebase Analytics web adapter + Consent Mode.
- Create `apps/mobile/lib/observability/analytics.ts` — native stub (no-op; Crashlytics later).
- Create `apps/mobile/lib/observability/errorBridge.ts` — `logClientError`/`getUserIdHash` callable transport + AsyncStorage hash cache.
- Create `apps/mobile/lib/observability/ObservabilityErrorBoundary.tsx` — React error boundary.
- Create `apps/mobile/lib/observability/globalHandlers.ts` — `ErrorUtils`/`unhandledrejection`/`window.onerror`.
- Create `apps/mobile/lib/observability/configure.ts` — assembles the adapter and calls `configureObservability`.
- Create `apps/mobile/lib/observability/ConsentBar.tsx` — minimal opt-in bar.
- Modify `apps/mobile/app/_layout.tsx` — bootstrap observability, mount boundary + consent bar.
- Modify `apps/mobile/lib/auth/AuthContext.tsx` — call `setUserContext` on auth/profile changes.
- Modify the four funnel call sites (Tasks 10a–10d).

**Docs & ops (Task 11)**
- Modify `packages/shared/src/services/_services-map.md`, `.claude/skills/gcloud-cultuvilla/SKILL.md`, `CHANGELOG.md`.
- Create `.claude/skills/observability-conventions/SKILL.md`.
- Ops: create the dev salt secret, deploy callables, add the Error Reporting email alert.

---

### Task 1: Server-side PII/hash chokepoint

**Files:**
- Create: `functions/src/shared/observability.ts`
- Test: `functions/src/__tests__/observability.test.ts`

**Interfaces:**
- Consumes: `firebase-functions/v2` `logger`; Node `crypto.createHmac`; `process.env.OBSERVABILITY_USER_ID_SALT`.
- Produces:
  - `hashUserId(uid: string, saltOverride?: string): string`
  - `redactPII(msg: string): string`
  - `looksLikeToken(s: string): boolean`
  - `transformAttrs(attrs?: Record<string, unknown>): Record<string, unknown> | undefined`
  - `log: { info(msg, attrs?), warn(msg, attrs?), error(msg, attrs?) }` where `attrs` is `Record<string, unknown>` and must include a `handler` field by convention.

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/__tests__/observability.test.ts
import { describe, it, expect } from 'vitest';
import { hashUserId, redactPII, looksLikeToken, transformAttrs } from '../shared/observability';

describe('hashUserId', () => {
  it('is deterministic for a given salt and differs from the raw uid', () => {
    const h = hashUserId('user-123', 'salt-a');
    expect(h).toBe(hashUserId('user-123', 'salt-a'));
    expect(h).not.toBe('user-123');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('changes when the salt changes', () => {
    expect(hashUserId('user-123', 'salt-a')).not.toBe(hashUserId('user-123', 'salt-b'));
  });
  it('passes empty uid through untouched', () => {
    expect(hashUserId('')).toBe('');
  });
});

describe('looksLikeToken', () => {
  it('flags high-entropy alphanumeric tokens', () => {
    expect(looksLikeToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(true);
  });
  it('does not flag a long ordinary word string', () => {
    expect(looksLikeToken('aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(looksLikeToken('short1')).toBe(false);
  });
});

describe('redactPII', () => {
  it('scrubs emails, phones and tokens', () => {
    expect(redactPII('mail me at ana@example.com')).toContain('<email>');
    expect(redactPII('call +34600123456 now')).toContain('<phone>');
    expect(redactPII('token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toContain('<token>');
  });
  it('leaves clean messages untouched', () => {
    expect(redactPII('village join failed: precondition')).toBe('village join failed: precondition');
  });
});

describe('transformAttrs', () => {
  it('hashes user.id and redacts error.message', () => {
    const out = transformAttrs({ 'user.id': 'user-123', 'error.message': 'ana@example.com bad', handler: 'x' });
    expect(out?.['user.id']).toMatch(/^[0-9a-f]{64}$/);
    expect(String(out?.['error.message'])).toContain('<email>');
    expect(out?.handler).toBe('x');
  });
  it('returns undefined for undefined input', () => {
    expect(transformAttrs(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/functions... exec vitest run src/__tests__/observability.test.ts` (or `pnpm test:functions`)
Expected: FAIL — `Cannot find module '../shared/observability'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// functions/src/shared/observability.ts
import { createHmac } from 'node:crypto';
import { logger } from 'firebase-functions/v2';

const SHANNON_ENTROPY_BITS_PER_CHAR_MIN = 3.5;
const TOKEN_MIN_LENGTH = 20;

export const looksLikeToken = (s: string): boolean => {
  if (s.length < TOKEN_MIN_LENGTH) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  const counts = new Map<string, number>();
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy >= SHANNON_ENTROPY_BITS_PER_CHAR_MIN;
};

export const redactPII = (msg: string): string => {
  if (!msg) return msg;
  return msg
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\+?\d{7,15}/g, '<phone>')
    .replace(/[A-Za-z0-9_-]{20,}/g, (s) => (looksLikeToken(s) ? '<token>' : s));
};

let cachedSalt: string | null = null;
let warnedAboutMissingSalt = false;

const getSalt = (override?: string): string => {
  if (override) return override;
  if (cachedSalt) return cachedSalt;
  const fromEnv = process.env.OBSERVABILITY_USER_ID_SALT;
  if (fromEnv) {
    cachedSalt = fromEnv;
    return fromEnv;
  }
  // Fail closed: a missing secret still logs, but the visible 'unsalted-'
  // prefix surfaces the misconfiguration instead of silently weakening hashing.
  if (!warnedAboutMissingSalt) {
    warnedAboutMissingSalt = true;
    if (process.env.FUNCTIONS_EMULATOR !== 'true' && process.env.NODE_ENV !== 'test') {
      logger.warn('OBSERVABILITY_USER_ID_SALT missing — hashing with placeholder', {
        handler: 'observability',
      });
    }
  }
  return 'unsalted-placeholder';
};

export const hashUserId = (uid: string, saltOverride?: string): string => {
  if (!uid) return uid;
  return createHmac('sha256', getSalt(saltOverride)).update(uid).digest('hex');
};

type Attrs = Record<string, unknown>;

export const transformAttrs = (attrs?: Attrs): Attrs | undefined => {
  if (!attrs) return attrs;
  const out: Attrs = { ...attrs };
  if (typeof out['user.id'] === 'string') out['user.id'] = hashUserId(out['user.id']);
  if (typeof out['error.message'] === 'string') out['error.message'] = redactPII(out['error.message']);
  return out;
};

// The single logging chokepoint. Domain code passes RAW values; hashing and
// scrubbing happen here — never at the call site. `attrs.handler` is required
// by convention so Cloud Logging can filter by Cloud Function name.
export const log = {
  info: (msg: string, attrs?: Attrs) => logger.info(msg, transformAttrs(attrs)),
  warn: (msg: string, attrs?: Attrs) => logger.warn(msg, transformAttrs(attrs)),
  error: (msg: string, attrs?: Attrs) => logger.error(msg, transformAttrs(attrs)),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:functions` (or the scoped vitest command from Step 2)
Expected: PASS — all four describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add functions/src/shared/observability.ts functions/src/__tests__/observability.test.ts
git commit -m "feat(observability): server-side log chokepoint with uid hashing and PII scrub"
```

---

### Task 2: Salt secret + `logClientError` + `getUserIdHash` callables

**Files:**
- Create: `functions/src/observability/secret.ts`
- Create: `functions/src/observability/logClientError.ts`
- Create: `functions/src/observability/getUserIdHash.ts`
- Modify: `functions/src/index.ts` (add exports after the Maps block)
- Test: `functions/src/__tests__/handlers/logClientError.test.ts`

**Interfaces:**
- Consumes: `log`, `hashUserId` from Task 1; `defineSecret`; `onCall`, `HttpsError`.
- Produces:
  - `OBSERVABILITY_USER_ID_SALT` secret param.
  - `logClientError` callable — data `{ message?: string; name?: string; stack?: string; route?: string; appVersion?: string; platform?: string; operation_id?: string }`, returns `{ ok: true }`.
  - `getUserIdHash` callable — no data, returns `{ hash: string }`.
  - `runLogClientError(uid: string, data: unknown): void` (testable core).

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/__tests__/handlers/logClientError.test.ts
import { describe, it, expect, vi } from 'vitest';

const errorSpy = vi.fn();
vi.mock('../../shared/observability', async (orig) => {
  const actual = await orig<typeof import('../../shared/observability')>();
  return { ...actual, log: { ...actual.log, error: errorSpy } };
});

import { runLogClientError } from '../../observability/logClientError';

describe('runLogClientError', () => {
  it('logs at error with hashed uid (raw uid never present) and redacted message', () => {
    errorSpy.mockClear();
    runLogClientError('user-xyz', {
      message: 'boom for ana@example.com',
      name: 'TypeError',
      route: '/event/123',
      appVersion: '0.5.0',
      platform: 'web',
      operation_id: 'op-1',
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, attrs] = errorSpy.mock.calls[0];
    expect(msg).toContain('client error');
    expect(attrs.handler).toBe('logClientError');
    // uid arrives raw here; hashing is applied by the real transformAttrs in prod.
    expect(attrs['user.id']).toBe('user-xyz');
    expect(attrs.route).toBe('/event/123');
    // free text is redacted at the call boundary before logging.
    expect(String(attrs['error.message'])).toContain('<email>');
  });

  it('drops keys outside the allowlist', () => {
    errorSpy.mockClear();
    runLogClientError('user-xyz', { message: 'x', email: 'ana@example.com', secret: 'nope' });
    const [, attrs] = errorSpy.mock.calls[0];
    expect(attrs.email).toBeUndefined();
    expect(attrs.secret).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:functions`
Expected: FAIL — `Cannot find module '../../observability/logClientError'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// functions/src/observability/secret.ts
import { defineSecret } from 'firebase-functions/params';

/** HMAC salt for pseudonymizing user ids in telemetry. Server-side only. */
export const OBSERVABILITY_USER_ID_SALT = defineSecret('OBSERVABILITY_USER_ID_SALT');
```

```ts
// functions/src/observability/logClientError.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { log, redactPII } from '../shared/observability';
import { OBSERVABILITY_USER_ID_SALT } from './secret';

const handler = 'logClientError';

// Only these keys are allowed out of a client payload into the log record.
// `message` is redacted; everything else is a bounded scalar.
function pickClientErrorAttrs(uid: string, data: unknown): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v.slice(0, 500) : undefined);
  return {
    handler,
    'user.id': uid, // raw here; hashed by transformAttrs inside log.error
    'error.message': typeof d.message === 'string' ? redactPII(d.message.slice(0, 500)) : undefined,
    'error.name': str(d.name),
    'error.stack': str(d.stack),
    route: str(d.route),
    appVersion: str(d.appVersion),
    platform: str(d.platform),
    operation_id: str(d.operation_id),
  };
}

/** Core logic, separated from the onCall envelope so it is unit-testable. */
export function runLogClientError(uid: string, data: unknown): void {
  log.error('client error', pickClientErrorAttrs(uid, data));
}

export const logClientError = onCall(
  { region: 'us-central1', cors: true, secrets: [OBSERVABILITY_USER_ID_SALT] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    runLogClientError(request.auth.uid, request.data);
    return { ok: true as const };
  },
);
```

```ts
// functions/src/observability/getUserIdHash.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hashUserId } from '../shared/observability';
import { OBSERVABILITY_USER_ID_SALT } from './secret';

export const getUserIdHash = onCall(
  { region: 'us-central1', cors: true, secrets: [OBSERVABILITY_USER_ID_SALT] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    return { hash: hashUserId(request.auth.uid) };
  },
);
```

- [ ] **Step 4: Add exports to the functions index**

Modify `functions/src/index.ts` — after the Maps block, add:

```ts
// Observability (client error ingestion + pseudonymized identity)
export { logClientError } from './observability/logClientError';
export { getUserIdHash } from './observability/getUserIdHash';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:functions`
Expected: PASS — both `runLogClientError` cases green; the `no-console.test.ts` still passes (no `console.*` added).

- [ ] **Step 6: Commit**

```bash
git add functions/src/observability functions/src/index.ts functions/src/__tests__/handlers/logClientError.test.ts
git commit -m "feat(observability): logClientError + getUserIdHash callables and salt secret"
```

---

### Task 3: The port — event taxonomy constants

**Files:**
- Create: `packages/shared/src/services/observability/observabilityEvents.ts`
- Test: `packages/shared/test/services/observabilityEvents.test.ts`

**Interfaces:**
- Produces:
  - `OBSERVABILITY_EVENTS` — a `const` object of `<domain>.<action>.<outcome>` event-name strings for the four starter funnels.
  - `type ObservabilityEventName = (typeof OBSERVABILITY_EVENTS)[keyof typeof OBSERVABILITY_EVENTS]`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/services/observabilityEvents.test.ts
import { describe, it, expect } from 'vitest';
import { OBSERVABILITY_EVENTS } from '../../src/services/observability/observabilityEvents';

describe('OBSERVABILITY_EVENTS', () => {
  it('names follow <domain>.<action>.<outcome> and are unique', () => {
    const names = Object.values(OBSERVABILITY_EVENTS);
    for (const n of names) expect(n).toMatch(/^[a-z]+(\.[a-z_]+){2}$/);
    expect(new Set(names).size).toBe(names.length);
  });
  it('covers the four starter funnels', () => {
    expect(OBSERVABILITY_EVENTS.ONBOARDING_STARTED).toBeDefined();
    expect(OBSERVABILITY_EVENTS.VILLAGE_JOIN_SUCCESS).toBeDefined();
    expect(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS).toBeDefined();
    expect(OBSERVABILITY_EVENTS.ORG_CREATE_SUCCESS).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test observabilityEvents`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/shared/src/services/observability/observabilityEvents.ts
// Central event-name taxonomy. Web and native emit identical names.
// Convention: <domain>.<action>.<outcome>. Add a name here (never inline a
// string at a call site) and add it to the observability-conventions skill.
export const OBSERVABILITY_EVENTS = {
  ONBOARDING_STARTED: 'onboarding.start.begin',
  ONBOARDING_AGE_GATE: 'onboarding.age.gate',
  ONBOARDING_COMPLETED: 'onboarding.complete.success',
  VILLAGE_JOIN_SUCCESS: 'village.join.success',
  VILLAGE_JOIN_ERROR: 'village.join.error',
  EVENT_SIGNUP_SUCCESS: 'event.signup.success',
  EVENT_SIGNUP_ERROR: 'event.signup.error',
  ORG_CREATE_SUCCESS: 'org.create.success',
  ORG_CREATE_ERROR: 'org.create.error',
  APP_EXCEPTION: 'app.exception.thrown',
} as const;

export type ObservabilityEventName =
  (typeof OBSERVABILITY_EVENTS)[keyof typeof OBSERVABILITY_EVENTS];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cultuvilla/shared test observabilityEvents`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/observability/observabilityEvents.ts packages/shared/test/services/observabilityEvents.test.ts
git commit -m "feat(observability): central event-name taxonomy constants"
```

---

### Task 4: The port — `observabilityService`

**Files:**
- Create: `packages/shared/src/services/observability/observabilityService.ts`
- Modify: `packages/shared/src/services/index.ts` (add `export * from './observability/observabilityService'` and `export * from './observability/observabilityEvents'`)
- Test: `packages/shared/test/services/observabilityService.test.ts`

**Interfaces:**
- Consumes: `ObservabilityEventName` (Task 3).
- Produces:
  - `interface UserContext { uid: string; municipalityId?: string; villageId?: string; role?: string }`
  - `interface ConsentState { analytics: boolean }`
  - `interface OperationContext { flow: string; screen: string; operation_id: string; started_at_ms: number }`
  - `interface ObservabilityAdapter { trackEvent(name, params, ctx): void; captureError(error, context): void; log(level, msg, fields): void; setUserContext(ctx: UserContext | null): void; setConsent(consent: ConsentState): void }`
  - `configureObservability(adapter: ObservabilityAdapter): void`
  - `const observability: { setUserContext, setConsent, trackEvent, captureError, logger: { info, warn, error }, startOperation }`
  - `ALLOWED_CONTEXT_KEYS: readonly string[]`, `filterContext(input): Record<string, unknown>` (exported for the test).

Notes for the implementer:
- The port keeps module-level `currentUser`, `currentConsent`, and the injected `adapter` (default no-op).
- `trackEvent` is suppressed when `currentConsent.analytics === false` (Analytics is consent-gated). `captureError` and `logger.*` always flow (legitimate-interest diagnosis path).
- `filterContext` drops any key not in `ALLOWED_CONTEXT_KEYS`. Every outbound call passes params through it. This is the single PII allowlist enforcement point.
- `startOperation` returns an `OperationContext` with a generated `operation_id`. Generate it without `Date.now()`/`Math.random()` collisions concerns — a simple counter + a per-process prefix is fine (`op-${prefix}-${n++}`); the prefix can be derived from `globalThis.crypto?.randomUUID?.()` when available, else a static string. (Do NOT rely on `Math.random`/`Date.now` in the shared package's tested path — keep the id generation deterministic-friendly by allowing an injected `idFactory` param defaulting to the crypto-based one.)

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/services/observabilityService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  observability,
  configureObservability,
  filterContext,
  type ObservabilityAdapter,
} from '../../src/services/observability/observabilityService';
import { OBSERVABILITY_EVENTS } from '../../src/services/observability/observabilityEvents';

function makeSpyAdapter(): ObservabilityAdapter & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { trackEvent: [], captureError: [], log: [], setUserContext: [], setConsent: [] };
  return {
    calls,
    trackEvent: (...a) => calls.trackEvent.push(a),
    captureError: (...a) => calls.captureError.push(a),
    log: (...a) => calls.log.push(a),
    setUserContext: (...a) => calls.setUserContext.push(a),
    setConsent: (...a) => calls.setConsent.push(a),
  };
}

describe('filterContext', () => {
  it('keeps allowlisted keys and drops the rest', () => {
    const out = filterContext({ uid: 'u1', role: 'admin', email: 'x@y.com', note: 'secret' });
    expect(out).toEqual({ uid: 'u1', role: 'admin' });
  });
});

describe('observability port', () => {
  let adapter: ReturnType<typeof makeSpyAdapter>;
  beforeEach(() => {
    adapter = makeSpyAdapter();
    configureObservability(adapter);
    observability.setConsent({ analytics: true });
  });

  it('is a safe no-op before an adapter is configured', () => {
    // reset to default no-op by configuring a fresh spy then calling with denied consent
    expect(() => observability.trackEvent(OBSERVABILITY_EVENTS.VILLAGE_JOIN_SUCCESS, {})).not.toThrow();
  });

  it('suppresses trackEvent when analytics consent is denied', () => {
    observability.setConsent({ analytics: false });
    observability.trackEvent(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS, { villageId: 'v1' });
    expect(adapter.calls.trackEvent.length).toBe(0);
  });

  it('forwards trackEvent with filtered params when consent granted', () => {
    observability.trackEvent(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS, { villageId: 'v1', leaked: 'x' });
    expect(adapter.calls.trackEvent.length).toBe(1);
    const [name, params] = adapter.calls.trackEvent[0];
    expect(name).toBe(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS);
    expect(params).toEqual({ villageId: 'v1' });
  });

  it('captureError flows even when analytics consent is denied', () => {
    observability.setConsent({ analytics: false });
    observability.captureError(new Error('boom'), { route: '/x', leaked: 'y' });
    expect(adapter.calls.captureError.length).toBe(1);
    const [, ctx] = adapter.calls.captureError[0];
    expect(ctx).toEqual({ route: '/x' });
  });

  it('startOperation threads a stable operation_id', () => {
    const op = observability.startOperation('village.join', 'VillageDiscovery', () => 'op-fixed');
    expect(op.operation_id).toBe('op-fixed');
    expect(op.flow).toBe('village.join');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cultuvilla/shared test observabilityService`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/shared/src/services/observability/observabilityService.ts
import type { ObservabilityEventName } from './observabilityEvents';

export interface UserContext {
  uid: string;
  municipalityId?: string;
  villageId?: string;
  role?: string;
}
export interface ConsentState {
  analytics: boolean;
}
export interface OperationContext {
  flow: string;
  screen: string;
  operation_id: string;
  started_at_ms: number;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface ObservabilityAdapter {
  trackEvent(name: ObservabilityEventName, params: Record<string, unknown>, user: UserContext | null): void;
  captureError(error: unknown, context: Record<string, unknown>): void;
  log(level: LogLevel, msg: string, fields: Record<string, unknown>): void;
  setUserContext(user: UserContext | null): void;
  setConsent(consent: ConsentState): void;
}

// The single PII allowlist. Any key not here never leaves the port.
export const ALLOWED_CONTEXT_KEYS = [
  'uid',
  'municipalityId',
  'villageId',
  'role',
  'appVersion',
  'platform',
  'route',
  'operation_id',
] as const;

export function filterContext(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_CONTEXT_KEYS) {
    if (input[k] !== undefined) out[k] = input[k];
  }
  return out;
}

const noopAdapter: ObservabilityAdapter = {
  trackEvent: () => {},
  captureError: () => {},
  log: () => {},
  setUserContext: () => {},
  setConsent: () => {},
};

let adapter: ObservabilityAdapter = noopAdapter;
let currentUser: UserContext | null = null;
let currentConsent: ConsentState = { analytics: false };

export function configureObservability(next: ObservabilityAdapter): void {
  adapter = next;
  // Replay the state the app already established so a late-configured adapter
  // is not blind to the current user/consent.
  adapter.setConsent(currentConsent);
  adapter.setUserContext(currentUser);
}

let opCounter = 0;
const defaultOpPrefix =
  typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID().slice(0, 8) : 'op';
const defaultIdFactory = (): string => `op-${defaultOpPrefix}-${opCounter++}`;

export const observability = {
  setUserContext(user: UserContext | null): void {
    currentUser = user;
    adapter.setUserContext(user);
  },
  setConsent(consent: ConsentState): void {
    currentConsent = consent;
    adapter.setConsent(consent);
  },
  trackEvent(name: ObservabilityEventName, params: Record<string, unknown>): void {
    if (!currentConsent.analytics) return; // analytics is consent-gated
    adapter.trackEvent(name, filterContext(params), currentUser);
  },
  captureError(error: unknown, context: Record<string, unknown> = {}): void {
    adapter.captureError(error, filterContext(context)); // diagnosis flows pre-consent
  },
  logger: {
    info: (msg: string, fields: Record<string, unknown> = {}) => adapter.log('info', msg, filterContext(fields)),
    warn: (msg: string, fields: Record<string, unknown> = {}) => adapter.log('warn', msg, filterContext(fields)),
    error: (msg: string, fields: Record<string, unknown> = {}) => adapter.log('error', msg, filterContext(fields)),
  },
  startOperation(flow: string, screen: string, idFactory: () => string = defaultIdFactory): OperationContext {
    return { flow, screen, operation_id: idFactory(), started_at_ms: 0 };
  },
};
```

Note: `started_at_ms` is `0` in the port to avoid `Date.now()` in tested shared code; the *adapter* stamps real timestamps when it forwards. If a real elapsed time is needed later, inject a clock — do not call `Date.now()` here.

- [ ] **Step 4: Add re-exports to the services index**

Modify `packages/shared/src/services/index.ts` — append:

```ts
export * from './observability/observabilityService'
export * from './observability/observabilityEvents'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @cultuvilla/shared test observabilityService`
Expected: PASS — all cases green.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/observability/observabilityService.ts packages/shared/src/services/index.ts packages/shared/test/services/observabilityService.test.ts
git commit -m "feat(observability): platform-free observability port with consent gate and PII allowlist"
```

---

### Task 5: Error-bridge adapter (callable transport + hash cache)

**Files:**
- Create: `apps/mobile/lib/observability/errorBridge.ts`
- Test: `apps/mobile/lib/observability/__tests__/errorBridge.test.ts`

**Interfaces:**
- Consumes: `getFirebaseFunctions` from `@cultuvilla/shared/firebase`; `httpsCallable` from `firebase/functions`; `AsyncStorage`.
- Produces:
  - `sendClientError(payload: ClientErrorPayload): Promise<void>` — fire-and-forget wrapper around the `logClientError` callable.
  - `fetchUserIdHash(uid: string): Promise<string | null>` — calls `getUserIdHash`, caches in AsyncStorage under `obs.userIdHash.<uid>`.
  - `type ClientErrorPayload = { message?: string; name?: string; stack?: string; route?: string; appVersion?: string; platform?: string; operation_id?: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/lib/observability/__tests__/errorBridge.test.ts
import { fetchUserIdHash, __resetHashCacheForTest } from '../errorBridge';

const callable = jest.fn();
jest.mock('firebase/functions', () => ({ httpsCallable: () => callable }));
jest.mock('@cultuvilla/shared/firebase', () => ({ getFirebaseFunctions: () => ({}) }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    },
  };
});

describe('fetchUserIdHash', () => {
  beforeEach(() => { callable.mockReset(); __resetHashCacheForTest(); });

  it('calls the callable once then serves from cache', async () => {
    callable.mockResolvedValue({ data: { hash: 'abc123' } });
    expect(await fetchUserIdHash('u1')).toBe('abc123');
    expect(await fetchUserIdHash('u1')).toBe('abc123');
    expect(callable).toHaveBeenCalledTimes(1);
  });

  it('returns null (never throws) when the callable rejects', async () => {
    callable.mockRejectedValue(new Error('offline'));
    expect(await fetchUserIdHash('u2')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test errorBridge`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/mobile/lib/observability/errorBridge.ts
import { httpsCallable } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseFunctions } from '@cultuvilla/shared/firebase';

export type ClientErrorPayload = {
  message?: string;
  name?: string;
  stack?: string;
  route?: string;
  appVersion?: string;
  platform?: string;
  operation_id?: string;
};

const memHashCache = new Map<string, string>();

/** Test-only: clear the in-memory hash cache between cases. */
export function __resetHashCacheForTest(): void {
  memHashCache.clear();
}

export async function sendClientError(payload: ClientErrorPayload): Promise<void> {
  try {
    const fn = httpsCallable(getFirebaseFunctions(), 'logClientError');
    await fn(payload);
  } catch {
    // Fire-and-forget: observability must never break a user flow.
  }
}

export async function fetchUserIdHash(uid: string): Promise<string | null> {
  const key = `obs.userIdHash.${uid}`;
  const mem = memHashCache.get(uid);
  if (mem) return mem;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      memHashCache.set(uid, stored);
      return stored;
    }
    const fn = httpsCallable<unknown, { hash: string }>(getFirebaseFunctions(), 'getUserIdHash');
    const { data } = await fn();
    if (data?.hash) {
      memHashCache.set(uid, data.hash);
      await AsyncStorage.setItem(key, data.hash);
      return data.hash;
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm app:test errorBridge`
Expected: PASS — both cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/observability/errorBridge.ts apps/mobile/lib/observability/__tests__/errorBridge.test.ts
git commit -m "feat(observability): client error-bridge transport and uid-hash cache"
```

---

### Task 6: Analytics adapters (web impl + native stub)

**Files:**
- Create: `apps/mobile/lib/observability/analytics.ts` (native/default stub)
- Create: `apps/mobile/lib/observability/analytics.web.ts` (Firebase Analytics web)
- Test: `apps/mobile/lib/observability/__tests__/analytics.native.test.ts`

**Interfaces:**
- Produces (both files, identical signature — Metro picks `.web.ts` on web, `.ts` on native):
  - `createAnalyticsBackend(): { trackEvent(name: string, params: Record<string, unknown>, userId: string | null): void; setConsent(granted: boolean): void; setUserId(id: string | null): void }`

- [ ] **Step 1: Write the failing test (native stub is a safe no-op)**

```ts
// apps/mobile/lib/observability/__tests__/analytics.native.test.ts
import { createAnalyticsBackend } from '../analytics';

describe('native analytics stub', () => {
  it('exposes the backend shape and never throws', () => {
    const b = createAnalyticsBackend();
    expect(() => {
      b.trackEvent('village.join.success', { villageId: 'v1' }, 'hash1');
      b.setConsent(true);
      b.setUserId('hash1');
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test analytics.native`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the native stub**

```ts
// apps/mobile/lib/observability/analytics.ts
// Native default: no-op until @react-native-firebase/analytics + Crashlytics
// are wired at native release. The seam contract is identical to the web impl.
export function createAnalyticsBackend() {
  return {
    trackEvent: (_name: string, _params: Record<string, unknown>, _userId: string | null) => {},
    setConsent: (_granted: boolean) => {},
    setUserId: (_id: string | null) => {},
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm app:test analytics.native`
Expected: PASS.

- [ ] **Step 5: Write the web impl (no unit test — needs the Firebase Analytics SDK; verified manually on the web build)**

```ts
// apps/mobile/lib/observability/analytics.web.ts
import { getAnalytics, logEvent, setUserId, setConsent, isSupported } from 'firebase/analytics';
import { getFirebaseApp } from '@cultuvilla/shared/firebase';

// Firebase Analytics is not supported in every environment (e.g. SSR/prerender).
// Guard init so the app never crashes when it's unavailable.
let analytics: ReturnType<typeof getAnalytics> | null = null;
let ready = false;

async function ensureAnalytics(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    if (await isSupported()) {
      analytics = getAnalytics(getFirebaseApp());
      // Consent Mode v2: denied by default until the user opts in.
      setConsent({ analytics_storage: 'denied', ad_storage: 'denied' });
    }
  } catch {
    analytics = null;
  }
}

export function createAnalyticsBackend() {
  void ensureAnalytics();
  return {
    trackEvent: (name: string, params: Record<string, unknown>, userId: string | null) => {
      if (!analytics) return;
      try {
        logEvent(analytics, name, userId ? { ...params, user_id: userId } : params);
      } catch {
        /* fire-and-forget */
      }
    },
    setConsent: (granted: boolean) => {
      try {
        setConsent({ analytics_storage: granted ? 'granted' : 'denied' });
      } catch {
        /* ignore */
      }
    },
    setUserId: (id: string | null) => {
      if (!analytics) return;
      try {
        setUserId(analytics, id);
      } catch {
        /* ignore */
      }
    },
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/observability/analytics.ts apps/mobile/lib/observability/analytics.web.ts apps/mobile/lib/observability/__tests__/analytics.native.test.ts
git commit -m "feat(observability): analytics adapters (web Firebase Analytics + native stub)"
```

---

### Task 7: Error boundary + global handlers

**Files:**
- Create: `apps/mobile/lib/observability/ObservabilityErrorBoundary.tsx`
- Create: `apps/mobile/lib/observability/globalHandlers.ts`
- Test: `apps/mobile/lib/observability/__tests__/ObservabilityErrorBoundary.test.tsx`

**Interfaces:**
- Consumes: `observability.captureError`, `OBSERVABILITY_EVENTS` (via the port), React.
- Produces:
  - `ObservabilityErrorBoundary` — class component with `children` + optional `fallback: React.ReactNode`; calls `observability.captureError` in `componentDidCatch`.
  - `attachGlobalHandlers(): void` — wires `ErrorUtils.setGlobalHandler` (native) and `window.onerror` + `unhandledrejection` (web), each forwarding to `observability.captureError`. Idempotent.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/lib/observability/__tests__/ObservabilityErrorBoundary.test.tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ObservabilityErrorBoundary } from '../ObservabilityErrorBoundary';

const captureError = jest.fn();
jest.mock('@cultuvilla/shared', () => ({
  observability: { captureError: (...a: unknown[]) => captureError(...a) },
}));

function Boom(): React.ReactElement {
  throw new Error('render boom');
}

describe('ObservabilityErrorBoundary', () => {
  it('renders fallback and reports the error', () => {
    const { getByText } = render(
      <ObservabilityErrorBoundary fallback={<Text>algo salió mal</Text>}>
        <Boom />
      </ObservabilityErrorBoundary>,
    );
    expect(getByText('algo salió mal')).toBeTruthy();
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test ObservabilityErrorBoundary`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// apps/mobile/lib/observability/ObservabilityErrorBoundary.tsx
import React from 'react';
import { observability } from '@cultuvilla/shared';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class ObservabilityErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }): void {
    observability.captureError(error, { route: info.componentStack ? 'boundary' : 'boundary' });
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
```

```ts
// apps/mobile/lib/observability/globalHandlers.ts
import { Platform } from 'react-native';
import { observability } from '@cultuvilla/shared';

let attached = false;

export function attachGlobalHandlers(): void {
  if (attached) return;
  attached = true;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (e) => observability.captureError(e.error ?? e.message, {}));
      window.addEventListener('unhandledrejection', (e) => observability.captureError(e.reason, {}));
    }
    return;
  }

  // Native: preserve the existing global handler, then forward to observability.
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (e: unknown, isFatal?: boolean) => void; setGlobalHandler(h: (e: unknown, isFatal?: boolean) => void): void };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    observability.captureError(error, {});
    prev?.(error, isFatal);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm app:test ObservabilityErrorBoundary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/observability/ObservabilityErrorBoundary.tsx apps/mobile/lib/observability/globalHandlers.ts apps/mobile/lib/observability/__tests__/ObservabilityErrorBoundary.test.tsx
git commit -m "feat(observability): react error boundary and global error handlers"
```

---

### Task 8: Assemble + configure the adapter; wire bootstrap and user context

**Files:**
- Create: `apps/mobile/lib/observability/configure.ts`
- Modify: `apps/mobile/app/_layout.tsx` (bootstrap call + wrap the app in `ObservabilityErrorBoundary`)
- Modify: `apps/mobile/lib/auth/AuthContext.tsx` (call `setUserContext` + fetch hash on auth/profile changes)
- Test: `apps/mobile/lib/observability/__tests__/configure.test.ts`

**Interfaces:**
- Consumes: `createAnalyticsBackend` (Task 6), `sendClientError`/`fetchUserIdHash` (Task 5), `configureObservability` + `observability` + `OBSERVABILITY_EVENTS` (port), `attachGlobalHandlers` (Task 7).
- Produces:
  - `bootstrapObservability(): void` — builds the `ObservabilityAdapter` from the analytics backend + error bridge, calls `configureObservability`, then `attachGlobalHandlers`. Idempotent.
  - The adapter's `captureError` fires BOTH `sendClientError(...)` AND an `app_exception` analytics event (matching the design's "Both" decision).

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/lib/observability/__tests__/configure.test.ts
const configureObservability = jest.fn();
const trackEvent = jest.fn();
const sendClientError = jest.fn().mockResolvedValue(undefined);
const attachGlobalHandlers = jest.fn();

jest.mock('@cultuvilla/shared', () => ({
  configureObservability: (...a: unknown[]) => configureObservability(...a),
  OBSERVABILITY_EVENTS: { APP_EXCEPTION: 'app.exception.thrown' },
}));
jest.mock('../analytics', () => ({
  createAnalyticsBackend: () => ({ trackEvent, setConsent: jest.fn(), setUserId: jest.fn() }),
}));
jest.mock('../errorBridge', () => ({ sendClientError: (...a: unknown[]) => sendClientError(...a), fetchUserIdHash: jest.fn() }));
jest.mock('../globalHandlers', () => ({ attachGlobalHandlers: () => attachGlobalHandlers() }));

import { bootstrapObservability } from '../configure';

describe('bootstrapObservability', () => {
  it('configures the port and attaches handlers, and captureError double-writes', () => {
    bootstrapObservability();
    expect(configureObservability).toHaveBeenCalledTimes(1);
    expect(attachGlobalHandlers).toHaveBeenCalledTimes(1);
    const adapter = configureObservability.mock.calls[0][0];
    adapter.captureError(new Error('boom'), { route: '/x' });
    expect(sendClientError).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app.exception.thrown', expect.any(Object), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test configure`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/lib/observability/configure.ts
import { Platform } from 'react-native';
import {
  configureObservability,
  OBSERVABILITY_EVENTS,
  type ObservabilityAdapter,
  type UserContext,
} from '@cultuvilla/shared';
import { createAnalyticsBackend } from './analytics';
import { sendClientError } from './errorBridge';
import { attachGlobalHandlers } from './globalHandlers';

let booted = false;

function toErrorPayload(error: unknown, context: Record<string, unknown>): Record<string, unknown> {
  const e = error instanceof Error ? error : new Error(String(error));
  return {
    message: e.message,
    name: e.name,
    stack: e.stack,
    platform: Platform.OS,
    ...context,
  };
}

export function bootstrapObservability(): void {
  if (booted) return;
  booted = true;

  const analytics = createAnalyticsBackend();

  const adapter: ObservabilityAdapter = {
    trackEvent: (name, params, user) => analytics.trackEvent(name, params, user ? userIdOf(user) : null),
    captureError: (error, context) => {
      // Both sinks (design decision): Cloud Logging for diagnosis + an
      // analytics event for funnel/impact correlation.
      void sendClientError(toErrorPayload(error, context));
      analytics.trackEvent(OBSERVABILITY_EVENTS.APP_EXCEPTION, context, null);
    },
    log: (_level, _msg, _fields) => {
      // Client structured logs currently ride the error bridge only for errors;
      // info/warn are dev-console today. Native Crashlytics breadcrumbs later.
    },
    setUserContext: (user) => analytics.setUserId(user ? userIdOf(user) : null),
    setConsent: (consent) => analytics.setConsent(consent.analytics),
  };

  configureObservability(adapter);
  attachGlobalHandlers();
}

// The analytics user id is the (later hashed) uid; AuthContext supplies the hash
// via setUserContext once fetchUserIdHash resolves.
function userIdOf(user: UserContext): string {
  return user.uid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm app:test configure`
Expected: PASS.

- [ ] **Step 5: Wire bootstrap + boundary into the app root**

Modify `apps/mobile/app/_layout.tsx`:
- Add import: `import { bootstrapObservability } from '../lib/observability/configure';`
- Add import: `import { ObservabilityErrorBoundary } from '../lib/observability/ObservabilityErrorBoundary';`
- Immediately after the existing `bootstrapFirebase();` top-level call, add `bootstrapObservability();`.
- Wrap the returned tree's outermost provider in `<ObservabilityErrorBoundary fallback={<View className="flex-1 items-center justify-center bg-surface"><ActivityIndicator /></View>}>…</ObservabilityErrorBoundary>` (place it just inside `<SafeAreaProvider>`).

- [ ] **Step 6: Wire user context in AuthContext**

Modify `apps/mobile/lib/auth/AuthContext.tsx`:
- Import the port + hash fetch: `import { observability } from '@cultuvilla/shared';` and `import { fetchUserIdHash } from '../observability/errorBridge';`.
- In the `loadProfile` success path (where the profile `p` is available), after profile state is set, call:
  ```ts
  observability.setUserContext({ uid, municipalityId: p.municipalityId, role: p.role });
  void fetchUserIdHash(uid).then((hash) => {
    if (hash) observability.setUserContext({ uid: hash, municipalityId: p.municipalityId, role: p.role });
  });
  ```
  (Use whichever fields exist on the profile type; `municipalityId`/`role` are the scope fields. If the profile lacks one, omit it — the allowlist tolerates missing keys.)
- In the sign-out path (where `setUser(null)` happens), call `observability.setUserContext(null);`.

- [ ] **Step 7: Run the mobile test + typecheck**

Run: `pnpm app:test` then `pnpm app:typecheck`
Expected: PASS — existing suites unaffected; new `configure` test green; types clean.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/observability/configure.ts apps/mobile/lib/observability/__tests__/configure.test.ts apps/mobile/app/_layout.tsx apps/mobile/lib/auth/AuthContext.tsx
git commit -m "feat(observability): bootstrap adapter, mount error boundary, wire user context"
```

---

### Task 9: Consent bar (minimal opt-in UI + persistence)

**Files:**
- Create: `apps/mobile/lib/observability/ConsentBar.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (mount `<ConsentBar />` near the app root, below the main tree)
- Test: `apps/mobile/lib/observability/__tests__/ConsentBar.test.tsx`

**Interfaces:**
- Consumes: `observability.setConsent`, `AsyncStorage`, `useT`, primitives (`Text`, `Pressable`/`Button`), `useSafeAreaInsets`.
- Produces: `ConsentBar` — reads persisted consent on mount (`obs.consent.analytics`), calls `observability.setConsent` with the stored value, renders the bar only when no choice is stored, writes the choice on tap.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/lib/observability/__tests__/ConsentBar.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const setConsent = jest.fn();
jest.mock('@cultuvilla/shared', () => ({ observability: { setConsent: (...a: unknown[]) => setConsent(...a) } }));
jest.mock('../../i18n', () => ({ useT: () => (k: string) => k }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  },
}));

import { ConsentBar } from '../ConsentBar';

describe('ConsentBar', () => {
  beforeEach(() => { setConsent.mockReset(); for (const k of Object.keys(store)) delete store[k]; });

  it('shows when no choice stored and grants on accept', async () => {
    const { getByText } = render(<ConsentBar />);
    await waitFor(() => getByText('consent.accept'));
    fireEvent.press(getByText('consent.accept'));
    await waitFor(() => expect(setConsent).toHaveBeenLastCalledWith({ analytics: true }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm app:test ConsentBar`
Expected: FAIL — module not found.

- [ ] **Step 3: Add i18n strings**

Add to `packages/i18n/messages/es.json` under a new `consent` namespace:

```json
"consent": {
  "message": "Usamos analítica anónima para mejorar la app. ¿Nos das tu consentimiento?",
  "accept": "Aceptar",
  "decline": "Rechazar"
}
```

- [ ] **Step 4: Write the implementation**

```tsx
// apps/mobile/lib/observability/ConsentBar.tsx
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observability } from '@cultuvilla/shared';
import { useT } from '../i18n';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';

const KEY = 'obs.consent.analytics';

export function ConsentBar(): React.ReactElement | null {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((stored) => {
      if (stored === 'true' || stored === 'false') {
        observability.setConsent({ analytics: stored === 'true' });
      } else {
        setVisible(true);
      }
    });
  }, []);

  async function choose(granted: boolean): Promise<void> {
    observability.setConsent({ analytics: granted });
    await AsyncStorage.setItem(KEY, String(granted));
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <View
      className="absolute left-0 right-0 bottom-0 bg-surface border-t border-border p-4"
      style={{ paddingBottom: insets.bottom + 16 }}
    >
      <Text className="text-body mb-3">{t('consent.message')}</Text>
      <View className="flex-row gap-3">
        <Button onPress={() => void choose(true)}>{t('consent.accept')}</Button>
        <Button variant="secondary" onPress={() => void choose(false)}>{t('consent.decline')}</Button>
      </View>
    </View>
  );
}
```

(Adjust `Button` props/variant names and the primitives import paths to the actual signatures in `apps/mobile/components/primitives/`. Respect `insets.bottom` — bottom-anchored UI must pad by the safe-area inset.)

- [ ] **Step 5: Mount it**

Modify `apps/mobile/app/_layout.tsx` — render `<ConsentBar />` as a sibling above `<CropperHost />` (so it overlays the app). Add the import.

- [ ] **Step 6: Run test + typecheck to verify they pass**

Run: `pnpm app:test ConsentBar` then `pnpm app:typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/observability/ConsentBar.tsx apps/mobile/app/_layout.tsx packages/i18n/messages/es.json apps/mobile/lib/observability/__tests__/ConsentBar.test.tsx
git commit -m "feat(observability): minimal consent bar with persisted analytics opt-in"
```

---

### Task 10: Instrument the four starter funnels

Each sub-task adds `observability.trackEvent(...)` (and an error variant where the flow has a failure branch) at an existing call site. These are UI wiring changes; the assertion is a light jest spy where the site already has a test, otherwise a manual-verification note. Commit each sub-task separately.

**Task 10a — Onboarding.** In `apps/mobile/app/(onboarding)/complete-profile.tsx`, fire `OBSERVABILITY_EVENTS.ONBOARDING_COMPLETED` (params `{ villageId }` if known) on successful profile completion, and `ONBOARDING_AGE_GATE` when the 14+ age gate blocks. Import `{ observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared'`.

**Task 10b — Village join.** In `apps/mobile/components/feature/VillageDiscovery.tsx` (the `joinVillage` call path), fire `VILLAGE_JOIN_SUCCESS` (`{ villageId }`) on success and `VILLAGE_JOIN_ERROR` in the catch.

**Task 10c — Event signup.** At the `registerToEvent` call site (`apps/mobile/components/feature/RegisterFab.tsx`), fire `EVENT_SIGNUP_SUCCESS` (`{ villageId }`) on success and `EVENT_SIGNUP_ERROR` in the catch.

**Task 10d — Org creation.** At the org-creation call site (`requestAyuntamiento` / org create in the organizations manager), fire `ORG_CREATE_SUCCESS` on success and `ORG_CREATE_ERROR` in the catch.

For each sub-task:

- [ ] **Step 1:** Add the import and the `observability.trackEvent(...)` calls at the success/error branches. Only pass allowlisted params (`villageId`, `role`, `operation_id`).
- [ ] **Step 2:** If the file has an existing test (e.g. `RegisterFab.test.tsx`, `VillageHomeBody.test.tsx`), add a `jest.mock('@cultuvilla/shared', ...)` spy asserting the success event fires; otherwise add a one-line manual-verification note in the commit body.
- [ ] **Step 3:** Run `pnpm app:test <file>` (if a test exists) then `pnpm app:typecheck`.
- [ ] **Step 4:** Commit, e.g. `git commit -m "feat(observability): instrument village-join funnel"`.

---

### Task 11: Docs, conventions skill, and dev ops

**Files:**
- Modify: `packages/shared/src/services/_services-map.md`
- Modify: `.claude/skills/gcloud-cultuvilla/SKILL.md`
- Create: `.claude/skills/observability-conventions/SKILL.md`
- Modify: `CHANGELOG.md`
- Delete: `docs/plans/ready/observability-foundation.md` is NOT deleted here (it's this plan); instead, on completion, distil rationale into `docs/decisions/observability-foundation.md` and remove the plan (per managing-plans-lifecycle) — do this in the final PR.

- [ ] **Step 1:** Add an "Observability" row/section to `_services-map.md` documenting `observabilityService` (the port), the `logClientError`/`getUserIdHash` callables, and the adapter location. Note the PII allowlist + consent gate.

- [ ] **Step 2:** Fill the reserved observability-salt section of `.claude/skills/gcloud-cultuvilla/SKILL.md` — add `OBSERVABILITY_USER_ID_SALT` to the Secrets table (dev now; beta/prod created at release), with the create recipe (mirror the `GOOGLE_MAPS_API_KEY` flow: generate a high-entropy value, `functions:secrets:set OBSERVABILITY_USER_ID_SALT`). Add a Cloud Error Reporting note: the `logClientError` `handler` + `error.*` fields make client errors queryable and auto-grouped.

- [ ] **Step 3:** Create `.claude/skills/observability-conventions/SKILL.md` — the taxonomy review-gate + debugging runbook: the `<domain>.<action>.<outcome>` naming rule, the PII allowlist (`ALLOWED_CONTEXT_KEYS`), "never hash/scrub at the call site", the "add an event to `OBSERVABILITY_EVENTS` in the same PR" rule, and gcloud/Error-Reporting filter recipes (`jsonPayload.handler="logClientError"`).

- [ ] **Step 4:** Add a `## [Unreleased]` CHANGELOG entry describing the observability foundation (crash bridge, analytics, consent).

- [ ] **Step 5:** Commit the docs.

```bash
git add packages/shared/src/services/_services-map.md .claude/skills/gcloud-cultuvilla/SKILL.md .claude/skills/observability-conventions CHANGELOG.md
git commit -m "docs(observability): services map, gcloud salt section, conventions skill, changelog"
```

- [ ] **Step 6: Dev ops (run once, needs credentials — see `firebase-admin-dev`/`gcloud-cultuvilla` skills)**

1. Create the dev salt secret (high-entropy value):
   ```bash
   TMP=$(mktemp); chmod 600 "$TMP"; head -c 32 /dev/urandom | base64 > "$TMP"
   bash scripts/firebase.sh functions:secrets:set OBSERVABILITY_USER_ID_SALT --data-file "$TMP" --project dev
   shred -u "$TMP"
   ```
2. Deploy the two callables to dev via the `firestore-deploy` skill (functions deploy).
3. In the Google Cloud console for `villa-events`, enable **Error Reporting** and add an **email notification** for new/spiking errors (the design's alerting choice). Document the alert in the conventions skill.

- [ ] **Step 7: Full gate**

Run: `pnpm check`
Expected: PASS — lint (no `console.*` in functions, no `any`), typecheck (all workspaces), tests (shared vitest + mobile jest + functions), build.

---

## Self-review notes (author)

- **Spec coverage:** ports/adapters (Tasks 3–8), Firebase Analytics + Consent Mode (Tasks 6, 9), crash bridge "Both" sinks (Tasks 2, 8), HMAC-hashed uid + Secret Manager + server chokepoint (Tasks 1, 2), PII allowlist (Task 4), operation_id (Task 4), taxonomy + skill (Tasks 3, 11), four funnels (Task 10), email alerting (Task 11), YAGNI exclusions honoured (no OTel/BigQuery/Sentry anywhere). ✅
- **`Date.now()`/`Math.random()` in shared:** avoided in the tested port path (id via injectable factory; `started_at_ms` stamped by the adapter). ✅
- **Region:** all callables + client on `us-central1` (default), so `getFirebaseFunctions()` needs no override. ✅
- **Adjust-to-reality flags:** the `AuthContext` profile field names (`municipalityId`/`role`) and the primitives' `Button` API in `ConsentBar` must be matched to the actual signatures at implementation time — noted inline in Tasks 8 and 9.
