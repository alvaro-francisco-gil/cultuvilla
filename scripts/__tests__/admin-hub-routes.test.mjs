import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ADMIN_DIR = join(ROOT, 'apps/mobile/app/admin');
const HUB = join(ADMIN_DIR, 'index.tsx');

/**
 * The hub's cards are `href:` string literals typed by hand, so a route rename
 * does not break the build — it just produces buttons that navigate nowhere.
 * That already happened once: the screens were renamed to Spanish
 * (`solicitudes-organizador`, `denuncias`) and both hrefs kept pointing at the
 * old English paths.
 */
describe('admin hub hrefs', () => {
  const source = readFileSync(HUB, 'utf8');
  const hrefs = [...source.matchAll(/href: '\/admin\/([a-z-]+)'/g)].map((m) => m[1]);

  it('finds the cards at all, so this test cannot silently pass on a refactor', () => {
    assert.ok(hrefs.length >= 2, `expected at least 2 hrefs, found ${String(hrefs.length)}`);
  });

  it('points every card at a route file that exists', () => {
    for (const route of hrefs) {
      const asFile = join(ADMIN_DIR, `${route}.tsx`);
      const asDir = join(ADMIN_DIR, route, 'index.tsx');
      assert.ok(
        existsSync(asFile) || existsSync(asDir),
        `/admin/${route} has no screen — expected app/admin/${route}.tsx`,
      );
    }
  });

  it('links every admin screen from the hub, so none is unreachable', () => {
    const screens = readdirSync(ADMIN_DIR)
      .filter((f) => f.endsWith('.tsx') && !['index.tsx', '_layout.tsx'].includes(f))
      .map((f) => f.slice(0, -4));
    for (const screen of screens) {
      assert.ok(hrefs.includes(screen), `app/admin/${screen}.tsx is not linked from the hub`);
    }
  });
});
