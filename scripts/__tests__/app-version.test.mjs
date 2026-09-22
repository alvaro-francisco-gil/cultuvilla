import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractVersion, currentAppVersion } from '../lib/app-version.mjs';
import {
  DEFAULT_MIN_SUPPORTED,
  NOT_PUBLISHED,
  PUBLISHED_VERSION,
  resolveAppVersionConfig,
} from '../lib/app-version-config.mjs';
import { currentStoreUrl } from '../lib/app-stores.mjs';

describe('extractVersion', () => {
  it('pulls the top-level version out of an app.config.ts source', () => {
    assert.equal(extractVersion("export default {\n  version: '0.17.0',\n}"), '0.17.0');
    assert.equal(extractVersion('export default {\n  version: "1.2.3",\n}'), '1.2.3');
  });

  it('throws when absent, rather than guessing', () => {
    assert.throws(() => extractVersion('export default {}'), /No `version:` line/);
  });

  it('throws when ambiguous, rather than picking one', () => {
    // Picking the wrong match would silently publish a wrong version.
    const src = "export default {\n  version: '1.0.0',\n}\nexport const other = {\n  version: '2.0.0',\n}";
    assert.throws(() => extractVersion(src), /Ambiguous/);
  });

  it('reads the real app.config.ts', () => {
    assert.match(currentAppVersion(), /^\d+\.\d+\.\d+$/);
  });
});

describe('resolveAppVersionConfig', () => {
  // What a promotion deploys. Reported, never announced — see the regression
  // block at the bottom of this file for why.
  const appVersion = '0.17.0';

  it('defaults latest to what each store serves', () => {
    const { payload, latestSource } = resolveAppVersionConfig({
      stored: null,
      appVersion,
      published: { ios: '0.16.0', android: '0.15.0' },
    });
    assert.equal(payload.ios.latest, '0.16.0');
    assert.equal(payload.android.latest, '0.15.0');
    assert.equal(latestSource, 'published store version');
  });

  it('prefers an explicit latest', () => {
    const { payload, latestSource } = resolveAppVersionConfig({ latest: '0.18.0', stored: null, appVersion });
    assert.equal(payload.ios.latest, '0.18.0');
    assert.equal(latestSource, 'explicit');
  });

  // The regression this module exists for: the doc is written whole
  // (merge:false), so omitting --min used to reset a deliberate wall to 0.0.0.
  it('PRESERVES a stored minSupported when none is given', () => {
    const stored = { ios: { minSupported: '0.15.0', latest: '0.16.0' }, android: { minSupported: '0.15.0', latest: '0.16.0' } };
    const { payload, minSource } = resolveAppVersionConfig({ latest: '0.18.0', stored, appVersion });
    assert.equal(payload.ios.minSupported, '0.15.0');
    assert.equal(payload.android.minSupported, '0.15.0');
    assert.equal(minSource, 'preserved');
  });

  it('moves the wall only when minSupported is explicit', () => {
    const stored = { ios: { minSupported: '0.15.0' }, android: { minSupported: '0.15.0' } };
    const { payload, minSource } = resolveAppVersionConfig({ minSupported: '0.18.0', stored, appVersion });
    assert.equal(payload.ios.minSupported, '0.18.0');
    assert.equal(minSource, 'explicit');
  });

  it('falls back to the never-block default when nothing is stored', () => {
    const { payload, minSource } = resolveAppVersionConfig({ stored: null, appVersion });
    assert.equal(payload.ios.minSupported, DEFAULT_MIN_SUPPORTED);
    assert.equal(minSource, 'default');
  });

  it('allows lowering the wall explicitly, including to the default', () => {
    const stored = { ios: { minSupported: '0.15.0' }, android: { minSupported: '0.15.0' } };
    const { payload } = resolveAppVersionConfig({ minSupported: '0.0.0', stored, appVersion });
    assert.equal(payload.ios.minSupported, '0.0.0');
  });

  it('keeps ios and android in step', () => {
    const { payload } = resolveAppVersionConfig({ latest: '0.18.0', minSupported: '0.1.0', stored: null, appVersion });
    assert.deepEqual(payload.ios, payload.android);
  });

  it('always writes both store URLs', () => {
    const { payload } = resolveAppVersionConfig({ stored: null, appVersion });
    assert.ok(payload.storeUrl.ios.startsWith('https://'));
    assert.ok(payload.storeUrl.android.startsWith('https://'));
  });

  // The gate's whole job is to send a walled user somewhere they can update.
  // `startsWith('https://')` above was true of the pre-launch placeholder
  // `https://apps.apple.com/app/id000000000`, which is how a dead link survived
  // into the published 1.x line.
  it('points iOS at the real listing, not a placeholder', () => {
    const { payload } = resolveAppVersionConfig({ stored: null, appVersion });
    assert.equal(payload.storeUrl.ios, currentStoreUrl('ios'));
    assert.doesNotMatch(payload.storeUrl.ios, /id0+$/);
  });

  it('refuses to write a config with no iOS destination at all', () => {
    assert.throws(
      () => resolveAppVersionConfig({ stored: null, appVersion, storeUrl: { ios: '', android: 'https://x' } }),
      /storeUrl.ios/,
    );
  });

  it('rejects a non-semver version', () => {
    for (const bad of ['1.2', 'v1.2.3', '1.2.3-beta', 'latest']) {
      assert.throws(() => resolveAppVersionConfig({ latest: bad, stored: null, appVersion }), /latest for ios must be/);
      assert.throws(() => resolveAppVersionConfig({ minSupported: bad, stored: null, appVersion }), /minSupported must be/);
    }
  });

  // A garbled APP_STORE_VERSIONS must stop the write, not sail through as a
  // literal `latest` no client can compare against.
  it('rejects a malformed declared store version', () => {
    assert.throws(
      () => resolveAppVersionConfig({ stored: null, appVersion, published: { ios: '1.2', android: '' } }),
      /latest for ios must be/,
    );
  });

  it('treats a blank input as absent, since that is what a blank workflow input sends', () => {
    const stored = { ios: { minSupported: '0.15.0' }, android: { minSupported: '0.15.0' } };
    const { payload, minSource, latestSource } = resolveAppVersionConfig({
      latest: '',
      minSupported: '   ',
      stored,
      appVersion,
      published: { ios: '0.16.0', android: '0.16.0' },
    });
    assert.equal(payload.ios.latest, '0.16.0');
    assert.equal(latestSource, 'published store version');
    assert.equal(payload.ios.minSupported, '0.15.0');
    assert.equal(minSource, 'preserved');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression: `latest` announced a version no store could serve.
//
// On 2026-09-22 prod carried ios.latest = 1.3.0 while the App Store served
// 1.2.2. `latest` defaulted to the app.config.ts version — which is the version
// of the BACKEND AND WEB that a promotion deploys, not of any store binary
// (those ship only by an explicit `mobile-release` dispatch). So every promotion
// pushed `latest` ahead of what anyone could download, and `resolveVersionGate`
// returned 'nudge' to users who were already on the newest build that existed.
// ─────────────────────────────────────────────────────────────────────────────
describe('latest is what the store serves, not what the repo is at', () => {
  it('announces the published store version, not the app.config.ts version', () => {
    const { payload } = resolveAppVersionConfig({
      stored: null,
      appVersion: '1.3.0',
      published: { ios: '1.2.2', android: '1.1.0' },
    });
    assert.equal(payload.ios.latest, '1.2.2');
    assert.equal(payload.android.latest, '1.1.0');
  });

  it('tracks each platform separately — a Play approval must not move iOS', () => {
    const { payload } = resolveAppVersionConfig({
      stored: null,
      appVersion: '1.3.0',
      published: { ios: '1.2.2', android: '1.1.0' },
    });
    assert.notEqual(payload.ios.latest, payload.android.latest);
  });

  // An unpublished platform has nothing to promise. NOT_PUBLISHED reads as
  // "never nudge" through resolveVersionGate, exactly like minSupported 0.0.0
  // reads as "never block".
  it('never nudges a platform with no published listing', () => {
    const { payload } = resolveAppVersionConfig({
      stored: null,
      appVersion: '1.3.0',
      published: { ios: '1.2.2', android: '' },
    });
    assert.equal(payload.android.latest, NOT_PUBLISHED);
  });

  it('still lets an explicit --latest win, for an out-of-band correction', () => {
    const { payload, latestSource } = resolveAppVersionConfig({
      latest: '1.3.0',
      stored: null,
      appVersion: '1.3.0',
      published: { ios: '1.2.2', android: '' },
    });
    assert.equal(payload.ios.latest, '1.3.0');
    assert.equal(payload.android.latest, '1.3.0');
    assert.equal(latestSource, 'explicit');
  });

  it('reads the real appStores.ts when no published map is given', () => {
    const { payload } = resolveAppVersionConfig({ stored: null, appVersion: '1.3.0' });
    assert.equal(payload.ios.latest, PUBLISHED_VERSION.ios || NOT_PUBLISHED);
  });
});

// A wall above what the store serves is the same broken promise as the nudge,
// except there is no way off it: every client is blocked, and the gate's only
// button leads to a version that does not exist. Refuse the write.
describe('minSupported cannot exceed what the store serves', () => {
  it('throws rather than walling the fleet behind an unreleasable version', () => {
    assert.throws(
      () =>
        resolveAppVersionConfig({
          minSupported: '1.3.0',
          stored: null,
          appVersion: '1.3.0',
          published: { ios: '1.2.2', android: '' },
        }),
      /minSupported 1\.3\.0.*ios.*1\.2\.2/,
    );
  });

  it('allows a wall at exactly the published version', () => {
    const { payload } = resolveAppVersionConfig({
      minSupported: '1.2.2',
      stored: null,
      appVersion: '1.3.0',
      published: { ios: '1.2.2', android: '' },
    });
    assert.equal(payload.ios.minSupported, '1.2.2');
  });

  // Nothing published on that platform means nothing to compare against — the
  // only Android installs are closed-track testers, whose Play URL does work.
  it('skips the check for a platform with no published listing', () => {
    const { payload } = resolveAppVersionConfig({
      minSupported: '1.2.0',
      stored: null,
      appVersion: '1.3.0',
      published: { ios: '', android: '' },
    });
    assert.equal(payload.ios.minSupported, '1.2.0');
  });

  // The dangerous direction is a wall that arrives by inheritance rather than
  // by decision: a preserved min must be checked too.
  it('checks a PRESERVED minSupported, not just an explicit one', () => {
    const stored = { ios: { minSupported: '1.3.0', latest: '1.3.0' }, android: { minSupported: '1.3.0', latest: '1.3.0' } };
    assert.throws(
      () => resolveAppVersionConfig({ stored, appVersion: '1.3.0', published: { ios: '1.2.2', android: '' } }),
      /minSupported/,
    );
  });
});
