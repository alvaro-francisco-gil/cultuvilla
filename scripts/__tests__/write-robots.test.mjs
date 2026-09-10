import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRobotsTxt } from '../../apps/mobile/scripts/write-robots.mjs';

// dev and beta are public *.web.app sites full of demo seed data under the
// Cultuvilla name. Allowing them is an invitation to index them.
for (const env of ['dev', 'beta']) {
  test(`${env}: disallows everything and advertises no sitemap`, () => {
    const txt = buildRobotsTxt(env);
    assert.match(txt, /^User-agent: \*\nDisallow: \/\n$/);
    assert.doesNotMatch(txt, /Sitemap:/);
  });
}

test('prod: points crawlers at the sitemap on the brand domain', () => {
  assert.match(buildRobotsTxt('prod'), /^Sitemap: https:\/\/cultuvilla\.es\/sitemap\.xml$/m);
});

test('prod: keeps people, invite links and private screens out', () => {
  const txt = buildRobotsTxt('prod');
  for (const path of ['/person/', '/*/join$', '/me', '/inbox', '/settings', '/admin']) {
    assert.ok(txt.includes(`Disallow: ${path}\n`), `missing Disallow: ${path}`);
  }
  // A bare "Disallow: /" on prod would de-index the whole site.
  assert.doesNotMatch(txt, /^Disallow: \/$/m);
});
