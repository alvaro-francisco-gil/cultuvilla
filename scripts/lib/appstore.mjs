/**
 * App Store Connect API client — the write side of the iOS release pipeline.
 *
 * WHY THIS EXISTS. `eas submit` uploads a binary to App Store Connect and stops
 * there. Everything after the upload — creating the App Store version, attaching
 * the build, writing release notes, submitting for review, and releasing the
 * approved result — is ASC API work that no tool in the stack does for us. Until
 * this file existed it was done by hand, which is why 1.0.0 sat approved but
 * unreleased on 2026-09-04 with nothing watching it.
 *
 * The pure decision helpers (`isBuildReady`, `pickEditableVersion`,
 * `classifyVersionState`) do NO network and are unit-tested directly. The flows
 * take an injected `request(method, path, body)` so they are testable against a
 * fake; the CLI binds a real one to a fresh JWT.
 *
 * Auth/role: these are WRITES. The ASC API key needs App Manager or Admin — a
 * read-only key 403s at the first write.
 *
 * Adapted from the equivalent client in ordago-apps, which had already paid for
 * the Apple-specific gotchas noted inline (the legacy-endpoint 403, the
 * `filter[version]` parameter error, the JOSE-vs-DER signature).
 */
import { createSign } from 'node:crypto';

export const ASC_API_BASE = 'https://api.appstoreconnect.apple.com/v1';

/** App Store versions still editable — a build can be attached and submitted. */
export const EDITABLE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY',
]);

/** States meaning "already on its way, or already out" — submitting again errors. */
export const IN_FLIGHT_STATES = new Set([
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'PENDING_DEVELOPER_RELEASE',
  'PENDING_APPLE_RELEASE',
  'PROCESSING_FOR_APP_STORE',
  'READY_FOR_SALE',
  'RELEASED',
]);

/**
 * Approved, but waiting for someone to press a button. This is the state that
 * `releaseType: AFTER_APPROVAL` exists to make unreachable — and the state
 * 1.0.0 was stuck in for two days.
 */
export const PENDING_RELEASE_STATE = 'PENDING_DEVELOPER_RELEASE';

export function ascConfig(env = process.env) {
  const keyId = env.APPLE_ASC_KEY_ID;
  const issuerId = env.APPLE_ASC_ISSUER_ID;
  const privateKey = env.APPLE_ASC_API_KEY_P8; // full .p8 PEM contents
  if (!keyId || !issuerId || !privateKey) return null;
  return { keyId, issuerId, privateKey };
}

function base64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function signAscJwt({ keyId, issuerId, privateKey }, now = Math.floor(Date.now() / 1000)) {
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' }),
  );
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  // ES256 wants a JOSE (raw r||s) signature, not the DER that Node emits by
  // default. `dsaEncoding: 'ieee-p1363'` is the difference between a working
  // token and an opaque 401.
  const sig = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${base64Url(sig)}`;
}

/** Raw request. Returns parsed JSON, or null for the 204 that relationship PATCHes give. */
export async function ascRequest(method, path, token, body) {
  const res = await fetch(`${ASC_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    throw new Error(`ASC API ${method} ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

/** A `request(method, path, body)` bound to a fresh JWT, or null when unconfigured. */
export function makeAscRequest(env = process.env) {
  const cfg = ascConfig(env);
  if (!cfg) return null;
  const token = signAscJwt(cfg);
  return (method, path, body) => ascRequest(method, path, token, body);
}

// ── pure decision helpers ─────────────────────────────────────────────────

/** Is the uploaded build present in ASC and done processing? */
export function isBuildReady(builds, buildNumber) {
  const b = (builds || []).find((x) => String(x?.attributes?.version) === String(buildNumber));
  if (!b) return { found: false, ready: false, state: null, id: null };
  const state = b.attributes.processingState || null;
  return { found: true, ready: state === 'VALID', state, id: b.id };
}

/** An existing editable version matching versionString, if any. */
export function pickEditableVersion(versions, versionString) {
  return (
    (versions || []).find(
      (v) =>
        v?.attributes?.versionString === versionString &&
        EDITABLE_STATES.has(v?.attributes?.appStoreState),
    ) || null
  );
}

/** What to do with a version already in this state. */
export function classifyVersionState(appStoreState) {
  if (EDITABLE_STATES.has(appStoreState)) return 'submit';
  if (IN_FLIGHT_STATES.has(appStoreState)) return 'noop';
  return 'error';
}

/** Can this version be released right now, and if not, why not? */
export function classifyReleasability(appStoreState) {
  if (appStoreState === PENDING_RELEASE_STATE) return { releasable: true, reason: null };
  if (appStoreState === 'READY_FOR_SALE' || appStoreState === 'RELEASED') {
    return { releasable: false, reason: 'already released' };
  }
  return { releasable: false, reason: `state is ${appStoreState}, not ${PENDING_RELEASE_STATE}` };
}
