// A pueblo's URL is its slug at the root of the domain (`/matabuena`), so the
// first path segment is shared between every village and every top-level app
// route. Three things must agree or a village and a screen collide:
//   - the app's top-level route files (apps/mobile/app/*),
//   - RESERVED_ROOT_SEGMENTS, which no slug may take,
//   - Hosting's rewrites, which send app routes to the SPA and everything else
//     to the share-preview server.
// This suite fails the moment one of them moves without the others.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_ROOT_SEGMENTS } from '../../src/utils/urls';

const repo = resolve(__dirname, '../../../..');
const appDir = resolve(repo, 'apps/mobile/app');

/** First URL segments contributed by route files; `(group)` dirs are transparent. */
function topLevelSegments(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry.startsWith('_') || entry.startsWith('+')) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (/^\(.+\)$/.test(entry)) out.push(...topLevelSegments(full));
      else if (!/^\[.+\]$/.test(entry)) out.push(entry);
    } else if (/\.tsx?$/.test(entry)) {
      const name = entry.replace(/\.tsx?$/, '');
      if (name !== 'index' && !/^\[.+\]$/.test(name)) out.push(name);
    }
  }
  return out;
}

interface Rewrite {
  source: string;
  destination?: string;
  function?: { functionId: string };
}

const firebase = JSON.parse(readFileSync(resolve(repo, 'firebase.json'), 'utf8')) as {
  hosting: { rewrites: Rewrite[] };
};
const rewrites = firebase.hosting.rewrites;

/** Segments Hosting serves itself (static export, generated files) — no route file. */
const HOSTING_ONLY = new Set(['_expo', 'assets', 'index.html', 'robots.txt', 'sitemap.xml', '.well-known']);

describe('village-first URLs', () => {
  it('reserves every top-level app route so no pueblo can take it', () => {
    const reserved = new Set<string>(RESERVED_ROOT_SEGMENTS);
    for (const segment of topLevelSegments(appDir)) {
      expect(reserved, `app route /${segment} is not in RESERVED_ROOT_SEGMENTS`).toContain(segment);
    }
  });

  it('reserves nothing that is neither an app route nor a Hosting file', () => {
    const routes = new Set(topLevelSegments(appDir));
    for (const segment of RESERVED_ROOT_SEGMENTS) {
      if (HOSTING_ONLY.has(segment)) continue;
      expect(routes, `/${segment} is reserved but has no route file`).toContain(segment);
    }
  });

  it('sends every app route to the SPA before the pueblo catch-all can claim it', () => {
    const catchAll = rewrites.findIndex((r) => r.source === '/*');
    expect(catchAll).toBeGreaterThan(-1);
    expect(rewrites[catchAll]?.function?.functionId).toBe('ogRenderer');

    const appRule = rewrites.find((r) => r.source.startsWith('/@(') && !r.source.endsWith('/**'));
    expect(appRule?.destination).toBe('/index.html');
    expect(rewrites.indexOf(appRule!)).toBeLessThan(catchAll);

    const listed = new Set(/^\/@\((.+)\)$/.exec(appRule!.source)?.[1]?.split('|'));
    for (const segment of topLevelSegments(appDir)) {
      expect(listed, `/${segment} would be routed to the share-preview server`).toContain(segment);
    }
  });

  it('keeps the generated files ahead of the catch-all', () => {
    const catchAll = rewrites.findIndex((r) => r.source === '/*');
    const sitemap = rewrites.findIndex((r) => r.source === '/sitemap.xml');
    expect(sitemap).toBeGreaterThan(-1);
    expect(sitemap).toBeLessThan(catchAll);
  });
});
