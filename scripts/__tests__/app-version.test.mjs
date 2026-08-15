import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractVersion, currentAppVersion } from '../lib/app-version.mjs';
import { DEFAULT_MIN_SUPPORTED, resolveAppVersionConfig } from '../lib/app-version-config.mjs';

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
  const defaultLatest = '0.17.0';

  it('defaults latest to the app.config.ts version', () => {
    const { payload, latestSource } = resolveAppVersionConfig({ stored: null, defaultLatest });
    assert.equal(payload.ios.latest, '0.17.0');
    assert.equal(payload.android.latest, '0.17.0');
    assert.equal(latestSource, 'app.config.ts');
  });

  it('prefers an explicit latest', () => {
    const { payload, latestSource } = resolveAppVersionConfig({ latest: '0.18.0', stored: null, defaultLatest });
    assert.equal(payload.ios.latest, '0.18.0');
    assert.equal(latestSource, 'explicit');
  });

  // The regression this module exists for: the doc is written whole
  // (merge:false), so omitting --min used to reset a deliberate wall to 0.0.0.
  it('PRESERVES a stored minSupported when none is given', () => {
    const stored = { ios: { minSupported: '0.15.0', latest: '0.16.0' }, android: { minSupported: '0.15.0', latest: '0.16.0' } };
    const { payload, minSource } = resolveAppVersionConfig({ latest: '0.18.0', stored, defaultLatest });
    assert.equal(payload.ios.minSupported, '0.15.0');
    assert.equal(payload.android.minSupported, '0.15.0');
    assert.equal(minSource, 'preserved');
  });

  it('moves the wall only when minSupported is explicit', () => {
    const stored = { ios: { minSupported: '0.15.0' }, android: { minSupported: '0.15.0' } };
    const { payload, minSource } = resolveAppVersionConfig({ minSupported: '0.18.0', stored, defaultLatest });
    assert.equal(payload.ios.minSupported, '0.18.0');
    assert.equal(minSource, 'explicit');
  });

  it('falls back to the never-block default when nothing is stored', () => {
    const { payload, minSource } = resolveAppVersionConfig({ stored: null, defaultLatest });
    assert.equal(payload.ios.minSupported, DEFAULT_MIN_SUPPORTED);
    assert.equal(minSource, 'default');
  });

  it('allows lowering the wall explicitly, including to the default', () => {
    const stored = { ios: { minSupported: '0.15.0' }, android: { minSupported: '0.15.0' } };
    const { payload } = resolveAppVersionConfig({ minSupported: '0.0.0', stored, defaultLatest });
    assert.equal(payload.ios.minSupported, '0.0.0');
  });

  it('keeps ios and android in step', () => {
    const { payload } = resolveAppVersionConfig({ latest: '0.18.0', minSupported: '0.1.0', stored: null, defaultLatest });
    assert.deepEqual(payload.ios, payload.android);
  });

  it('always writes both store URLs', () => {
    const { payload } = resolveAppVersionConfig({ stored: null, defaultLatest });
    assert.ok(payload.storeUrl.ios.startsWith('https://'));
    assert.ok(payload.storeUrl.android.startsWith('https://'));
  });

  it('rejects a non-semver version', () => {
    for (const bad of ['1.2', 'v1.2.3', '1.2.3-beta', 'latest']) {
      assert.throws(() => resolveAppVersionConfig({ latest: bad, stored: null, defaultLatest }), /latest must be/);
      assert.throws(() => resolveAppVersionConfig({ minSupported: bad, stored: null, defaultLatest }), /minSupported must be/);
    }
  });

  it('treats a blank input as absent, since that is what a blank workflow input sends', () => {
    const stored = { ios: { minSupported: '0.15.0' }, android: { minSupported: '0.15.0' } };
    const { payload, minSource, latestSource } = resolveAppVersionConfig({
      latest: '',
      minSupported: '   ',
      stored,
      defaultLatest,
    });
    assert.equal(payload.ios.latest, defaultLatest);
    assert.equal(latestSource, 'app.config.ts');
    assert.equal(payload.ios.minSupported, '0.15.0');
    assert.equal(minSource, 'preserved');
  });

  it('throws when no latest can be resolved at all', () => {
    assert.throws(() => resolveAppVersionConfig({ stored: null, defaultLatest: undefined }), /latest is required/);
  });
});
