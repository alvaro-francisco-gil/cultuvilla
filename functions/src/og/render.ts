import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { JOIN_SEGMENT, parseAppPath, type ParsedAppPath } from '@cultuvilla/shared/utils';
import {
  getEventOg,
  getNewsOg,
  getVillageOgBySlug,
  getOrgOg,
  type OgMeta,
} from './fetchers';
import { injectMeta, injectSeoBody } from './html';
import { getSpaShell } from './spaShell';
import { webOriginForProject } from '@cultuvilla/shared/utils';

/**
 * An invite URL is reachable by anyone holding the link, which is exactly why it
 * must never be indexed — an `/unirse` page ranking in Google turns a link
 * someone chose to share into an open door. `follow` is kept so the org page it
 * points at still gets crawled.
 */
function isInvite(route: ParsedAppPath | null): boolean {
  return route?.type === 'entity' && route.join === true;
}

async function fetchOg(route: ParsedAppPath): Promise<OgMeta | null> {
  if (route.type === 'village') return getVillageOgBySlug(route.villageSlug);
  if (route.type !== 'entity') return null;
  switch (route.kind) {
    case 'event':
      return getEventOg(route.id);
    case 'news':
      return getNewsOg(route.id);
    case 'organization':
      return getOrgOg(route.id);
    default:
      return null;
  }
}

function describeRoute(route: ParsedAppPath): { kind: string; id?: string } {
  switch (route.type) {
    case 'village':
      return { kind: 'village', id: route.villageSlug };
    case 'entity':
    case 'seatClaim':
      return { kind: route.type === 'entity' ? route.kind : 'seatClaim', id: route.id };
    case 'user':
      return { kind: 'user', id: route.uid };
  }
}

/** Where a request for `pathname` belongs, or null when it is already there. */
function redirectTarget(pathname: string, route: ParsedAppPath, og: OgMeta): string | null {
  if (!og.canonicalPath) return null;
  const wanted = isInvite(route) ? `${og.canonicalPath}/${JOIN_SEGMENT}` : og.canonicalPath;
  const requested = pathname.replace(/\/$/, '');
  return requested === wanted ? null : wanted;
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
      // When Firebase Hosting routes a request here, `host` is the Cloud Run
      // service URL (ogrenderer-xxx.run.app) and `x-forwarded-host` is the
      // Hosting domain (villa-events.web.app). For the SPA-shell fetch we
      // need the Hosting domain — otherwise the fetch loops back into this
      // function via the Cloud Run URL and the request times out.
      const xHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
      const host = xHost ?? req.get('host') ?? 'localhost';
      const proto = (req.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() ?? 'https';
      const origin = `${proto}://${host}`;
      const url = new URL(req.originalUrl, origin);
      const route = parseAppPath(url.pathname);

      // OG is best-effort: a malformed id (e.g. a Firestore-reserved `__x__`
      // segment) makes the fetch throw. A crawler must still get a valid 200
      // default preview, not a 500 — so swallow fetch errors down to null and
      // let injectMeta render the defaults.
      let og: OgMeta | null = null;
      if (route) {
        try {
          og = await fetchOg(route);
        } catch (err) {
          logger.warn('OG fetch failed; rendering default preview', {
            handler: 'ogRenderer',
            path: url.pathname,
            ...describeRoute(route),
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      if (og && isInvite(route)) og.noindex = true;

      // One URL per doc: a stale title slug or a mistyped pueblo answers with a
      // permanent redirect instead of a second copy of the page. The query
      // string rides along — it is the sharer's, not ours to drop.
      const target = route && og ? redirectTarget(url.pathname, route, og) : null;
      if (target) {
        logger.info('Redirected to canonical path', {
          handler: 'ogRenderer',
          path: url.pathname,
          target,
        });
        res
          .status(301)
          .set('Location', `${target}${url.search}`)
          .set('Cache-Control', 'public, max-age=600, s-maxage=3600')
          .send('');
        return;
      }

      // Canonical names the project's public origin, not the host this request
      // arrived on: prod answers on both cultuvilla.es and
      // cultuvilla-prod.web.app, and deriving it from the request made each
      // declare itself canonical. It also drops the query string — WhatsApp,
      // Instagram and mail clients append their own tracking params, and each
      // variant would otherwise compete with the real URL.
      const canonical = `${webOriginForProject(process.env['GCLOUD_PROJECT'])}${
        url.pathname.replace(/\/$/, '') || '/'
      }`;

      // The shell is still fetched from the request's own origin: that is the
      // Hosting site actually serving this deploy.
      const shell = await getSpaShell(origin);
      const withMeta = injectMeta(shell, og, canonical);
      // Only indexable pages get the content block. A noindex page (a private
      // event, an invite link) has nothing a crawler should read, and an invite
      // screen is not an entity detail screen, so nothing there would ever
      // dismiss an overlay placed over it.
      const html = og?.noindex ? withMeta : injectSeoBody(withMeta, og);

      logger.info('Rendered OG preview', {
        handler: 'ogRenderer',
        path: url.pathname,
        ...(route ? describeRoute(route) : { kind: 'unmatched' }),
        hasDoc: og !== null,
        noindex: og?.noindex === true,
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
