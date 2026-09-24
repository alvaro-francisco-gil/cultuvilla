import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APP_STORES_PATH,
  currentStoreUrl,
  currentStoreVersion,
  storeUrlFrom,
  storeVersionFrom,
} from '../lib/app-stores.mjs';

const src = [
  'export const APP_STORES: { ios: string; android: string } = {',
  "  ios: 'https://apps.apple.com/es/app/cultuvilla/id6804756586',",
  "  android: '', // https://play.google.com/store/apps/details?id=com.cultuvilla.app",
  '};',
  '',
  'export const APP_STORE_VERSIONS: { ios: string; android: string } = {',
  "  ios: '1.2.2', // live since 2026-09-18",
  "  android: '', // no public listing yet",
  '};',
].join('\n');

describe('storeUrlFrom', () => {
  it('reads a filled-in URL', () => {
    assert.equal(storeUrlFrom(src, 'ios'), 'https://apps.apple.com/es/app/cultuvilla/id6804756586');
  });

  it('reads an empty one as empty, ignoring the trailing comment', () => {
    assert.equal(storeUrlFrom(src, 'android'), '');
  });

  // `: { ios: string; android: string }` sits between the name and the literal,
  // so a matcher scanning from the name forward could read `string` as the URL.
  it('does not match the key inside the type annotation', () => {
    assert.notEqual(storeUrlFrom(src, 'ios'), 'string');
    assert.notEqual(storeVersionFrom(src, 'android'), 'string');
  });

  // Both objects are keyed by ios/android, so an unscoped matcher would return
  // the URL when asked for the version, or the reverse — an answer that looks
  // like an answer. Each lookup is bound to its own object literal.
  it('does not leak between the two objects', () => {
    assert.equal(storeVersionFrom(src, 'ios'), '1.2.2');
    assert.equal(storeUrlFrom(src, 'ios'), 'https://apps.apple.com/es/app/cultuvilla/id6804756586');
  });

  it('throws when the object is gone, rather than reporting "not shipped"', () => {
    assert.throws(() => storeUrlFrom('const x: { ios: string } = {};', 'ios'), /APP_STORES not found/);
    assert.throws(() => storeVersionFrom(src, 'windows'), /APP_STORE_VERSIONS.windows/);
  });
});

describe('the real appStores.ts', () => {
  const source = readFileSync(APP_STORES_PATH, 'utf8');

  // Guards against a matcher that returns '' for everything — indistinguishable
  // from "no listing yet" unless checked against what the file actually says.
  it('is read as it is written', () => {
    for (const key of ['ios', 'android']) {
      assert.ok(source.includes(`${key}: '${currentStoreUrl(key)}'`), `${key} URL misread`);
      assert.ok(source.includes(`${key}: '${currentStoreVersion(key)}'`), `${key} version misread`);
    }
  });

  // A URL with no version would announce `latest: 0.0.0` for a platform that
  // has a live listing (nobody is ever nudged); a version with no URL would
  // announce an update the web build offers no way to get. They are two halves
  // of one fact — "this listing is live" — and must move together.
  it('declares a URL and a version together, or neither', () => {
    for (const key of ['ios', 'android']) {
      assert.equal(
        Boolean(currentStoreUrl(key)),
        Boolean(currentStoreVersion(key)),
        `APP_STORES.${key} and APP_STORE_VERSIONS.${key} disagree about whether ${key} is published`,
      );
    }
  });

  it('declares published versions as MAJOR.MINOR.PATCH', () => {
    for (const key of ['ios', 'android']) {
      const version = currentStoreVersion(key);
      if (version) assert.match(version, /^\d+\.\d+\.\d+$/, `${key} version is not semver`);
    }
  });
});
