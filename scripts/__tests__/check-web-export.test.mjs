import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIndexHtml, checkRobotsTxt } from '../check-web-export.mjs';
import { buildRobotsTxt } from '../../apps/mobile/scripts/write-robots.mjs';

const GOOD =
  '<!DOCTYPE html><html lang="es"><head>' +
  '<meta name="apple-itunes-app" content="app-id=6804756586" />' +
  '</head><body><div id="root"></div></body></html>';

test('a head carrying lang="es" and the App Store tag passes', () => {
  assert.deepEqual(checkIndexHtml(GOOD), []);
});

// Exactly what production served for weeks while app/+html.tsx was ignored.
test("Expo's default head fails on both counts", () => {
  const expoDefault = '<!DOCTYPE html><html lang="en"><head></head><body></body></html>';
  const problems = checkIndexHtml(expoDefault);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /lang="es"/);
  assert.match(problems[1], /apple-itunes-app/);
});

test('robots.txt written for an env is accepted for that env', () => {
  for (const env of ['dev', 'beta', 'prod']) {
    assert.deepEqual(checkRobotsTxt(buildRobotsTxt(env), env), [], env);
  }
});

test('a prod robots.txt shipped to beta is rejected — staging must not be indexed', () => {
  assert.equal(checkRobotsTxt(buildRobotsTxt('prod'), 'beta').length, 1);
});

test('a staging robots.txt shipped to prod is rejected — it would de-index the site', () => {
  assert.equal(checkRobotsTxt(buildRobotsTxt('dev'), 'prod').length, 1);
});

test('a missing robots.txt is rejected when an env is named', () => {
  assert.equal(checkRobotsTxt(null, 'prod').length, 1);
});
