import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import {
  getEventOg,
  getNewsOg,
  getVillageOg,
  getOrgOg,
  type OgMeta,
} from './fetchers';
import { injectMeta } from './html';
import { getSpaShell } from './spaShell';

type RouteKind = 'event' | 'news' | 'village' | 'org';
type ParsedRoute = { kind: RouteKind; id: string } | null;

const PATTERNS: { kind: RouteKind; re: RegExp }[] = [
  { kind: 'event', re: /^\/event\/([^/]+)\/?$/ },
  { kind: 'news', re: /^\/news\/([^/]+)\/?$/ },
  { kind: 'village', re: /^\/village\/([^/]+)(?:\/join)?\/?$/ },
  { kind: 'org', re: /^\/o\/([^/]+)(?:\/join)?\/?$/ },
];

function parsePath(pathname: string): ParsedRoute {
  for (const { kind, re } of PATTERNS) {
    const m = re.exec(pathname);
    if (m && m[1]) return { kind, id: m[1] };
  }
  return null;
}

async function fetchOg(route: NonNullable<ParsedRoute>): Promise<OgMeta | null> {
  switch (route.kind) {
    case 'event':
      return getEventOg(route.id);
    case 'news':
      return getNewsOg(route.id);
    case 'village':
      return getVillageOg(route.id);
    case 'org':
      return getOrgOg(route.id);
  }
}

/**
 * Hosting-rewrite target for share-link URLs. Returns the SPA shell with
 * Open Graph + Twitter Card tags injected into <head> based on the
 * Firestore doc referenced by the URL.
 *
 * Behaviour:
 *   - Known route, doc exists → 200 with og:* populated
 *   - Known route, doc missing (404 in Firestore) → 200 with default og,
 *     so the SPA's own /not-found UI renders normally
 *   - Unknown URL pattern → 200 with default og (defensive; Hosting only
 *     routes matching paths here)
 *   - Internal error → 500 plain text (rare; logged)
 *
 * Cache-Control: 10 min in the browser, 1 hour at the CDN edge. Doc edits
 * propagate to crawler previews within an hour. Crawlers re-scrape
 * periodically anyway, so this is the right trade between freshness and
 * Firestore read volume.
 */
export const ogRenderer = onRequest(
  {
    region: 'europe-west1',
    cors: false,
    maxInstances: 10,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    try {
      const host = req.get('host') ?? 'localhost';
      const proto = (req.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() ?? 'https';
      const origin = `${proto}://${host}`;
      const url = new URL(req.originalUrl, origin);
      const route = parsePath(url.pathname);

      const og = route ? await fetchOg(route) : null;
      const shell = await getSpaShell(origin);
      const html = injectMeta(shell, og, url.toString());

      logger.info('Rendered OG preview', {
        handler: 'ogRenderer',
        path: url.pathname,
        kind: route?.kind ?? 'unmatched',
        id: route?.id,
        hasDoc: og !== null,
      });

      res
        .status(200)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'public, max-age=600, s-maxage=3600')
        .send(html);
    } catch (err) {
      logger.error('ogRenderer failed', {
        handler: 'ogRenderer',
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      res.status(500).set('Content-Type', 'text/plain').send('Internal Server Error');
    }
  },
);
