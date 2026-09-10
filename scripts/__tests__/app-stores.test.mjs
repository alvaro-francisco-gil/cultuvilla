import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_STORES_PATH, currentStoreUrl, storeUrlFrom } from '../lib/app-stores.mjs';

describe('storeUrlFrom', () => {
  const src = [
    'export const APP_STORES: { ios: string; android: string } = {',
    "  ios: 'https://apps.apple.com/es/app/cultuvilla/id6804756586',",
    "  android: '', // https://play.google.com/store/apps/details?id=com.cultuvilla.app",
    '};',
  ].join('\n');

  it('reads a filled-in URL', () => {
    assert.equal(storeUrlFrom(src, 'ios'), 'https://apps.apple.com/es/app/cultuvilla/id6804756586');
  });

  it('reads an empty one as empty, ignoring the trailing comment', () => {
    assert.equal(storeUrlFrom(src, 'android'), '');
  });

  it('does not match the key inside the type annotation', () => {
    assert.equal(storeUrlFrom('const x: { ios: string } = {};', 'ios'), '');
  });
});

describe('currentStoreUrl', () => {
  // Guards against a matcher that returns '' for everything — indistinguishable
  // from "no listing yet" unless checked against what the file actually says.
  it('agrees with the literal in the real appStores.ts', () => {
    const source = readFileSync(APP_STORES_PATH, 'utf8');
    for (const key of ['ios', 'android']) {
      assert.ok(source.includes(`${key}: '${currentStoreUrl(key)}'`), `${key} misread`);
    }
  });
});
