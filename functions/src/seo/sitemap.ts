import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getFirestore } from 'firebase-admin/firestore';
import { buildRobotsTxt, buildSitemapXml, toLastmod, toDate, type SitemapUrl } from './urls';

/**
 * Why a sitemap at all, and why a function rather than a build artifact.
 *
 * The web build is a client-rendered SPA: a crawler landing on `/` gets an
 * empty `#root` and no anchors to follow, so URL *discovery* — not rendering —
 * is the binding constraint on whether a village ever appears in Google. A
 * sitemap is the only thing that hands Googlebot the list directly.
 *
 * It is generated per request because the content is live Firestore data: a
 * village activated this morning should be crawlable this afternoon, and a
 * build-time file would be stale from the moment it deployed. Edge caching
 * (below) keeps the read volume to a handful of queries per hour.
 *
 * Deliberately no composite indexes: every query here is a single-field order
 * plus a limit, filtered in memory. A sitemap is not worth adding an index
 * (and the deploy gate that comes with one) to firestore.indexes.json.
 */

const MAX_PER_COLLECTION = 1000;

/** Past events keep ranking for a while ("fiestas de Matabuena 2026"), but not forever. */
const EVENT_TAIL_DAYS = 120;

interface Fetched {
  urls: SitemapUrl[];
  counts: Record<string, number>;
}

async function collectUrls(origin: string): Promise<Fetched> {
  const db = getFirestore();
  const urls: SitemapUrl[] = [{ loc: `${origin}/`, changefreq: 'daily', priority: '1.0' }];
  const counts: Record<string, number> = {};

  // typed-refs: allowed — intentional converter-less read. A sitemap must not
  // fail because one doc has a stale schema; a strict converter would throw.
  const villages = await db
    .collection('municipalities')
    .where('communityActive', '==', true)
    .limit(MAX_PER_COLLECTION)
    .get();
  for (const doc of villages.docs) {
    urls.push({
      loc: `${origin}/village/${doc.id}`,
      lastmod: toLastmod(doc.get('updatedAt')),
      changefreq: 'weekly',
      priority: '0.9',
    });
  }
  counts['villages'] = villages.size;

  const cutoff = new Date(Date.now() - EVENT_TAIL_DAYS * 24 * 60 * 60 * 1000);
  const events = await db
    .collection('events')
    .orderBy('endBoundary', 'desc')
    .limit(MAX_PER_COLLECTION)
    .get();
  let eventCount = 0;
  for (const doc of events.docs) {
    // Private events are noindex'd by the renderer; listing them would only
    // spend crawl budget to reach a page that refuses to say anything.
    if (doc.get('visibilityOrgId')) continue;
    if (doc.get('status') !== 'published') continue;
    const boundary = toDate(doc.get('endBoundary'));
    if (boundary && boundary < cutoff) continue;
    urls.push({
      loc: `${origin}/event/${doc.id}`,
      lastmod: toLastmod(doc.get('updatedAt')),
      changefreq: 'weekly',
      priority: '0.8',
    });
    eventCount += 1;
  }
  counts['events'] = eventCount;

  const news = await db
    .collection('news')
    .orderBy('publishedAt', 'desc')
    .limit(MAX_PER_COLLECTION)
    .get();
  for (const doc of news.docs) {
    urls.push({
      loc: `${origin}/news/${doc.id}`,
      lastmod: toLastmod(doc.get('publishedAt')),
      changefreq: 'monthly',
      priority: '0.6',
    });
  }
  counts['news'] = news.size;

  const orgs = await db
    .collection('organizations')
    .orderBy('createdAt', 'desc')
    .limit(MAX_PER_COLLECTION)
    .get();
  let orgCount = 0;
  for (const doc of orgs.docs) {
    if (doc.get('status') !== 'approved') continue;
    urls.push({ loc: `${origin}/o/${doc.id}`, changefreq: 'monthly', priority: '0.6' });
    orgCount += 1;
  }
  counts['orgs'] = orgCount;

  return { urls, counts };
}

/**
 * `host` is the Cloud Run service URL when Firebase Hosting rewrites to us;
 * `x-forwarded-host` carries the real domain. Same reasoning as ogRenderer —
 * emitting Cloud Run URLs into a sitemap would ask Google to index the wrong
 * origin entirely.
 */
function resolveOrigin(req: { get: (h: string) => string | undefined }): string {
  const xHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = xHost ?? req.get('host') ?? 'localhost';
  const proto = (req.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() ?? 'https';
  return `${proto}://${host}`;
}

export const sitemap = onRequest(
  { region: 'europe-west1', cors: false, maxInstances: 3, memory: '256MiB', timeoutSeconds: 60 },
  async (req, res) => {
    try {
      const origin = resolveOrigin(req);
      const { urls, counts } = await collectUrls(origin);
      logger.info('Rendered sitemap', { handler: 'sitemap', origin, total: urls.length, ...counts });
      res
        .status(200)
        .set('Content-Type', 'application/xml; charset=utf-8')
        // An hour at the edge: new content is discoverable the same day without
        // re-running four collection scans for every crawler hit.
        .set('Cache-Control', 'public, max-age=600, s-maxage=3600')
        .send(buildSitemapXml(urls));
    } catch (err) {
      logger.error('sitemap failed', {
        handler: 'sitemap',
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(500).set('Content-Type', 'text/plain').send('Internal Server Error');
    }
  },
);

export const robotsTxt = onRequest(
  { region: 'europe-west1', cors: false, maxInstances: 3, memory: '128MiB', timeoutSeconds: 10 },
  (req, res) => {
    const origin = resolveOrigin(req);
    res
      .status(200)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
      .send(buildRobotsTxt(origin));
  },
);
