import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyReleasability,
  classifyVersionState,
  isBuildReady,
  pickEditableVersion,
  signAscJwt,
} from '../lib/appstore.mjs';
import {
  findOrCreateVersion,
  releaseVersion,
  submitIosForReview,
  waitForBuild,
} from '../lib/appstore-flows.mjs';
import { extractReleaseNotes, MAX_WHATS_NEW } from '../lib/changelog-notes.mjs';
import { generateKeyPairSync } from 'node:crypto';

// ── JWT ───────────────────────────────────────────────────────────────────

test('signAscJwt produces an ES256 JWT with a 64-byte JOSE signature', () => {
  // Apple rejects a DER signature with an opaque 401, so the encoding is the
  // whole point of this test: ES256 over P-256 is exactly r||s = 64 bytes.
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = signAscJwt({ keyId: 'K', issuerId: 'I', privateKey: pem }, 1_700_000_000);

  const [header, payload, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
    alg: 'ES256',
    kid: 'K',
    typ: 'JWT',
  });
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claims.aud, 'appstoreconnect-v1');
  assert.equal(claims.exp - claims.iat, 1200, 'ASC caps token lifetime at 20 minutes');
  assert.equal(Buffer.from(sig, 'base64url').length, 64);
  assert.ok(!jwt.includes('='), 'base64url is unpadded');
});

// ── pure decisions ────────────────────────────────────────────────────────

test('isBuildReady only says ready on processingState VALID', () => {
  const builds = [
    { id: 'b1', attributes: { version: '9', processingState: 'PROCESSING' } },
    { id: 'b2', attributes: { version: '10', processingState: 'VALID' } },
  ];
  assert.deepEqual(isBuildReady(builds, '9'), { found: true, ready: false, state: 'PROCESSING', id: 'b1' });
  assert.deepEqual(isBuildReady(builds, '10'), { found: true, ready: true, state: 'VALID', id: 'b2' });
  assert.deepEqual(isBuildReady(builds, '11'), { found: false, ready: false, state: null, id: null });
  // Build numbers arrive as both strings and numbers depending on the caller.
  assert.equal(isBuildReady(builds, 10).ready, true);
});

test('pickEditableVersion ignores versions that are already in flight', () => {
  const versions = [
    { id: 'v1', attributes: { versionString: '1.0.0', appStoreState: 'READY_FOR_SALE' } },
    { id: 'v2', attributes: { versionString: '1.1.0', appStoreState: 'PREPARE_FOR_SUBMISSION' } },
  ];
  assert.equal(pickEditableVersion(versions, '1.1.0').id, 'v2');
  assert.equal(pickEditableVersion(versions, '1.0.0'), null);
});

test('classifyVersionState separates submit, noop, and unexpected', () => {
  assert.equal(classifyVersionState('PREPARE_FOR_SUBMISSION'), 'submit');
  assert.equal(classifyVersionState('REJECTED'), 'submit');
  assert.equal(classifyVersionState('WAITING_FOR_REVIEW'), 'noop');
  assert.equal(classifyVersionState('READY_FOR_SALE'), 'noop');
  assert.equal(classifyVersionState('SOMETHING_NEW_FROM_APPLE'), 'error');
});

test('classifyReleasability only greenlights PENDING_DEVELOPER_RELEASE', () => {
  assert.deepEqual(classifyReleasability('PENDING_DEVELOPER_RELEASE'), { releasable: true, reason: null });
  assert.equal(classifyReleasability('READY_FOR_SALE').releasable, false);
  assert.equal(classifyReleasability('READY_FOR_SALE').reason, 'already released');
  assert.equal(classifyReleasability('IN_REVIEW').releasable, false);
});

// ── release notes ─────────────────────────────────────────────────────────

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Something not shipped yet.

## v1.0.0 — 2026-08-28

### Added

- **Primera versión** con \`eventos\` y [pueblos](docs/x.md).
- Segunda cosa.

## v0.30.0 — 2026-08-27

- Older stuff.
`;

test('extractReleaseNotes takes one version block and flattens it to plain text', () => {
  const notes = extractReleaseNotes(CHANGELOG, '1.0.0');
  assert.equal(notes, 'Added\n\n• Primera versión con eventos y pueblos.\n• Segunda cosa.');
  assert.ok(!notes.includes('Unreleased'), 'must not bleed into the Unreleased section');
  assert.ok(!notes.includes('0.30.0'), 'must stop at the next version heading');
  assert.ok(!notes.includes('**'), 'the App Store renders plain text, not markdown');
});

test('extractReleaseNotes refuses a version that was never stamped', () => {
  // Shipping with an empty "What's New" is worse than failing the release job.
  assert.throws(() => extractReleaseNotes(CHANGELOG, '1.1.0'), /no "## v1\.1\.0" section/);
});

test('extractReleaseNotes truncates to the App Store limit', () => {
  const long = `## v2.0.0 — 2026-01-01\n\n${'- padding padding padding\n'.repeat(400)}`;
  const notes = extractReleaseNotes(long, '2.0.0');
  assert.equal(notes.length, MAX_WHATS_NEW);
  assert.ok(notes.endsWith('…'));
});

// ── flows, against a fake ASC ─────────────────────────────────────────────

/** Records every call and answers from a canned route table. */
function fakeAsc(routes) {
  const calls = [];
  const request = async (method, path, body) => {
    calls.push({ method, path, body });
    for (const [pattern, handler] of routes) {
      if (pattern.test(`${method} ${path}`)) {
        return typeof handler === 'function' ? handler(calls) : handler;
      }
    }
    throw new Error(`fakeAsc: unhandled ${method} ${path}`);
  };
  return { request, calls };
}

test('waitForBuild polls until the build turns VALID', async () => {
  let n = 0;
  const { request } = fakeAsc([
    [
      /^GET \/builds/,
      () => {
        n += 1;
        return {
          data: [{ id: 'b1', attributes: { version: '9', processingState: n < 3 ? 'PROCESSING' : 'VALID' } }],
        };
      },
    ],
  ]);
  const id = await waitForBuild(request, {
    ascAppId: 'app1',
    buildNumber: '9',
    delayMs: 0,
    sleep: async () => {},
  });
  assert.equal(id, 'b1');
  assert.equal(n, 3);
});

test('waitForBuild gives up rather than hanging forever', async () => {
  const { request } = fakeAsc([
    [/^GET \/builds/, { data: [{ id: 'b1', attributes: { version: '9', processingState: 'PROCESSING' } }] }],
  ]);
  await assert.rejects(
    waitForBuild(request, { ascAppId: 'a', buildNumber: '9', attempts: 2, sleep: async () => {} }),
    /never reached processingState=VALID/,
  );
});

test('findOrCreateVersion creates with the requested releaseType', async () => {
  const { request, calls } = fakeAsc([
    [/^GET \/apps\/app1\/appStoreVersions/, { data: [] }],
    [/^POST \/appStoreVersions$/, { data: { id: 'v-new' } }],
  ]);
  const result = await findOrCreateVersion(request, {
    ascAppId: 'app1',
    versionString: '1.1.0',
    releaseType: 'AFTER_APPROVAL',
  });
  assert.deepEqual(result, { id: 'v-new', created: true });
  const post = calls.find((c) => c.method === 'POST');
  assert.equal(post.body.data.attributes.releaseType, 'AFTER_APPROVAL');
  assert.equal(post.body.data.attributes.platform, 'IOS');
});

test('findOrCreateVersion no-ops on a version already in review', async () => {
  const { request } = fakeAsc([
    [
      /^GET \/apps\/app1\/appStoreVersions/,
      { data: [{ id: 'v1', attributes: { versionString: '1.0.0', appStoreState: 'IN_REVIEW' } }] },
    ],
  ]);
  const result = await findOrCreateVersion(request, {
    ascAppId: 'app1',
    versionString: '1.0.0',
    releaseType: 'AFTER_APPROVAL',
  });
  assert.equal(result.alreadyInFlight, true);
  assert.equal(result.created, false);
});

test('findOrCreateVersion refuses to guess at an unknown state', async () => {
  const { request } = fakeAsc([
    [
      /^GET \/apps\/app1\/appStoreVersions/,
      { data: [{ id: 'v1', attributes: { versionString: '1.0.0', appStoreState: 'WEIRD' } }] },
    ],
  ]);
  await assert.rejects(
    findOrCreateVersion(request, { ascAppId: 'app1', versionString: '1.0.0', releaseType: 'AFTER_APPROVAL' }),
    /unexpected state 'WEIRD'/,
  );
});

test('submitIosForReview runs the whole flow in order and enables phased release', async () => {
  const { request, calls } = fakeAsc([
    [/^GET \/builds/, { data: [{ id: 'b9', attributes: { version: '9', processingState: 'VALID' } }] }],
    [/^GET \/apps\/app1\/appStoreVersions/, { data: [] }],
    [/^POST \/appStoreVersions$/, { data: { id: 'v1' } }],
    [/^GET \/appStoreVersions\/v1\/appStoreVersionLocalizations/, { data: [] }],
    [/^POST \/appStoreVersionLocalizations$/, { data: { id: 'loc1' } }],
    [/^PATCH \/appStoreVersions\/v1\/relationships\/build$/, null],
    [/^GET \/appStoreVersions\/v1\/appStoreVersionPhasedRelease$/, { data: null }],
    [/^POST \/appStoreVersionPhasedReleases$/, { data: { id: 'ph1' } }],
    [/^GET \/apps\/app1\/reviewSubmissions/, { data: [] }],
    [/^POST \/reviewSubmissions$/, { data: { id: 's1' } }],
    [/^GET \/reviewSubmissions\/s1\/items/, { data: [] }],
    [/^POST \/reviewSubmissionItems$/, { data: { id: 'i1' } }],
    [/^PATCH \/reviewSubmissions\/s1$/, { data: { id: 's1' } }],
  ]);

  const result = await submitIosForReview({
    request,
    ascAppId: 'app1',
    versionString: '1.1.0',
    buildNumber: '9',
    notes: 'Novedades',
    waitOpts: { sleep: async () => {} },
  });

  assert.equal(result.status, 'submitted');
  assert.equal(result.phasedReleaseId, 'ph1');

  // Order matters: the build must be attached before the submission is sent,
  // or Apple reviews a version with no binary.
  const seq = calls.map((c) => `${c.method} ${c.path.split('?')[0]}`);
  const attach = seq.indexOf('PATCH /appStoreVersions/v1/relationships/build');
  const submit = seq.indexOf('PATCH /reviewSubmissions/s1');
  assert.ok(attach !== -1 && submit !== -1 && attach < submit, seq.join('\n'));

  const finalPatch = calls.find((c) => c.path === '/reviewSubmissions/s1');
  assert.equal(finalPatch.body.data.attributes.submitted, true);
});

test('submitIosForReview reuses an already-open review submission', async () => {
  // Retrying after a partial failure must not 409 on a duplicate submission.
  const { request, calls } = fakeAsc([
    [/^GET \/builds/, { data: [{ id: 'b9', attributes: { version: '9', processingState: 'VALID' } }] }],
    [/^GET \/apps\/app1\/appStoreVersions/, { data: [] }],
    [/^POST \/appStoreVersions$/, { data: { id: 'v1' } }],
    [/^GET \/appStoreVersions\/v1\/appStoreVersionLocalizations/, { data: [] }],
    [/^POST \/appStoreVersionLocalizations$/, { data: { id: 'loc1' } }],
    [/^PATCH \/appStoreVersions\/v1\/relationships\/build$/, null],
    [/^GET \/appStoreVersions\/v1\/appStoreVersionPhasedRelease$/, { data: { id: 'ph0', attributes: { phasedReleaseState: 'INACTIVE' } } }],
    [/^GET \/apps\/app1\/reviewSubmissions/, { data: [{ id: 'open1' }] }],
    [/^GET \/reviewSubmissions\/open1\/items/, { data: [{ relationships: { appStoreVersion: { data: { id: 'v1' } } } }] }],
    [/^PATCH \/reviewSubmissions\/open1$/, { data: { id: 'open1' } }],
  ]);

  const result = await submitIosForReview({
    request,
    ascAppId: 'app1',
    versionString: '1.1.0',
    buildNumber: '9',
    notes: 'Novedades',
    waitOpts: { sleep: async () => {} },
  });

  assert.equal(result.submissionId, 'open1');
  assert.ok(!calls.some((c) => c.method === 'POST' && c.path === '/reviewSubmissions'));
  assert.ok(!calls.some((c) => c.path === '/reviewSubmissionItems'), 'item already present');
  assert.ok(!calls.some((c) => c.path === '/appStoreVersionPhasedReleases'), 'phased release already set');
});

test('submitIosForReview refuses to publish an empty What\'s New', async () => {
  await assert.rejects(
    submitIosForReview({ request: async () => {}, ascAppId: 'a', versionString: '1.0.0', buildNumber: '9', notes: '  ' }),
    /notes required/,
  );
});

// ── release ───────────────────────────────────────────────────────────────

const PENDING = {
  data: [
    {
      id: 'v1',
      attributes: { versionString: '1.0.0', appStoreState: 'PENDING_DEVELOPER_RELEASE', releaseType: 'MANUAL' },
      relationships: { build: { data: { id: 'b9' } } },
    },
  ],
  included: [{ type: 'builds', id: 'b9', attributes: { version: '9' } }],
};

test('releaseVersion finds the version waiting on the button', async () => {
  const { request, calls } = fakeAsc([
    [/^GET \/apps\/app1\/appStoreVersions/, PENDING],
    [/^POST \/appStoreVersionReleaseRequests$/, { data: { id: 'r1' } }],
  ]);
  const result = await releaseVersion(request, { ascAppId: 'app1', apply: true });
  assert.equal(result.status, 'released');
  assert.equal(result.target.versionString, '1.0.0');
  assert.equal(result.target.buildNumber, '9');
  const post = calls.find((c) => c.path === '/appStoreVersionReleaseRequests');
  assert.equal(post.body.data.relationships.appStoreVersion.data.id, 'v1');
});

test('releaseVersion without --apply sends nothing to Apple', async () => {
  const { request, calls } = fakeAsc([[/^GET \/apps\/app1\/appStoreVersions/, PENDING]]);
  const result = await releaseVersion(request, { ascAppId: 'app1', apply: false });
  assert.equal(result.status, 'dry-run');
  assert.ok(!calls.some((c) => c.method === 'POST'), 'a dry run must not write');
});

test('releaseVersion is idempotent on an already-released version', async () => {
  const { request, calls } = fakeAsc([
    [
      /^GET \/apps\/app1\/appStoreVersions/,
      { data: [{ id: 'v1', attributes: { versionString: '1.0.0', appStoreState: 'READY_FOR_SALE' } }] },
    ],
  ]);
  const result = await releaseVersion(request, { ascAppId: 'app1', versionString: '1.0.0', apply: true });
  assert.equal(result.status, 'skipped');
  assert.match(result.message, /already released/);
  assert.ok(!calls.some((c) => c.method === 'POST'));
});

test('releaseVersion reports when nothing is pending', async () => {
  const { request } = fakeAsc([
    [
      /^GET \/apps\/app1\/appStoreVersions/,
      { data: [{ id: 'v1', attributes: { versionString: '1.0.0', appStoreState: 'IN_REVIEW' } }] },
    ],
  ]);
  const result = await releaseVersion(request, { ascAppId: 'app1', apply: true });
  assert.equal(result.status, 'not-found');
});
