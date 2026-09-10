import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Writes apps/mobile/public/robots.txt for one env at hosting-deploy time, the
 * same way copy-well-known.mjs places the deep-link association files.
 *
 * Why a static file and not a function: the Cloud Functions Framework answers
 * `/robots.txt` (and `/favicon.ico`) itself with an empty 404 before any
 * handler runs, so a Hosting rewrite to a function can never serve it.
 *
 * Why per env: only prod may be indexed. dev and beta are public
 * `*.web.app` sites full of demo seed data under the Cultuvilla name, and an
 * allow-all robots.txt plus a sitemap is an invitation to put them in Google.
 */

// Keep in step with webOriginForProject in packages/shared/src/utils/webOrigin.ts.
const PROD_ORIGIN = 'https://cultuvilla.es';

/**
 * Reachable on prod, but never to rank:
 *  - /me, /inbox, /settings, /admin — private to one person or to admins.
 *  - /person/ — `persons` is publicly readable so guest browsing can show who
 *    organises an event (docs/decisions/guest-browsing.md). A villager agreed
 *    to be visible inside their village's app, not to rank on Google.
 *  - /*\/join — an invite link is a door opened for specific people.
 */
export const PROD_DISALLOWED = ['/me', '/inbox', '/settings', '/admin', '/person/', '/*/join$'];

export function buildRobotsTxt(env) {
  if (env !== 'prod') return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    'Allow: /',
    ...PROD_DISALLOWED.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${PROD_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');
}

function main() {
  const env = process.argv[2];
  if (!['dev', 'beta', 'prod'].includes(env ?? '')) {
    console.error('write-robots: usage: write-robots.mjs <dev|beta|prod>');
    process.exit(2);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const target = resolve(here, '../public/robots.txt');
  writeFileSync(target, buildRobotsTxt(env));
  console.log(`write-robots: wrote ${env} robots.txt to public/robots.txt`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
