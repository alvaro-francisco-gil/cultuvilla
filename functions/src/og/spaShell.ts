import { logger } from 'firebase-functions/v2';

/**
 * Lazily fetch the SPA's `/index.html` from the same Hosting origin the
 * request came in on, and cache it in module-level state for an hour.
 *
 * Why fetch (not bundle):
 *   - The function never has to be redeployed when the SPA is rebuilt.
 *   - One source of truth for the shell — whatever Firebase Hosting is
 *     serving today is exactly what we inject into.
 *
 * Why no circular routing:
 *   - The Hosting rewrites send /event/*, /news/*, /village/*, /o/* to the
 *     function. `/index.html` is NOT in the rewrite list, so a fetch for
 *     `/index.html` resolves through the static CDN.
 */

const TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  shell: string;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

const FALLBACK_SHELL =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"/></head><body><div id="root"></div></body></html>';

export async function getSpaShell(origin: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(origin);
  if (cached && now - cached.fetchedAt < TTL_MS) {
    return cached.shell;
  }

  const url = `${origin}/index.html`;
  try {
    const res = await fetch(url, {
      headers: { 'cache-control': 'no-cache' },
    });
    if (!res.ok) {
      logger.warn('SPA shell fetch returned non-2xx', {
        handler: 'ogRenderer',
        url,
        status: res.status,
      });
      return cached?.shell ?? FALLBACK_SHELL;
    }
    const shell = await res.text();
    cache.set(origin, { shell, fetchedAt: now });
    return shell;
  } catch (err) {
    logger.warn('SPA shell fetch failed', {
      handler: 'ogRenderer',
      url,
      err: err instanceof Error ? err.message : String(err),
    });
    return cached?.shell ?? FALLBACK_SHELL;
  }
}

/** Test-only: clear the in-memory cache between tests. */
export function _resetSpaShellCache(): void {
  cache.clear();
}
