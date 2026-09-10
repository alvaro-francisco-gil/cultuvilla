/**
 * Pure sitemap/robots builders. Kept free of Firestore and of `onRequest` so
 * the XML contract can be unit-tested without an emulator.
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string | null;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
}

/**
 * Paths that are reachable but must never rank. Two different reasons, both
 * ending in the same rule:
 *
 *  - **Private to one person** (`/me`, `/inbox`, `/settings`) or to admins
 *    (`/admin`) — a search result pointing here is useless to everyone but its
 *    owner, and it is not owner-specific anyway once rendered logged-out.
 *  - **`/person/`** — `persons` is publicly readable so guest browsing can show
 *    who organises an event (see docs/decisions/guest-browsing.md). A villager
 *    consented to being visible *inside a village app*, not to their name
 *    ranking on Google. That gap is exactly what robots.txt is for.
 *  - **`/join`** — an invite link is a door someone chose to open for specific
 *    people; indexing it opens it for everyone.
 */
export const DISALLOWED_PATHS = [
  '/me',
  '/inbox',
  '/settings',
  '/admin',
  '/person/',
  '/*/join$',
] as const;

export function buildRobotsTxt(origin: string): string {
  const lines = ['User-agent: *', 'Allow: /'];
  for (const path of DISALLOWED_PATHS) lines.push(`Disallow: ${path}`);
  lines.push('', `Sitemap: ${origin}/sitemap.xml`, '');
  return lines.join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const parts = [`<loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`<lastmod>${escapeXml(u.lastmod)}</lastmod>`);
      if (u.changefreq) parts.push(`<changefreq>${u.changefreq}</changefreq>`);
      if (u.priority) parts.push(`<priority>${u.priority}</priority>`);
      return `<url>${parts.join('')}</url>`;
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    body +
    '</urlset>'
  );
}

/** ISO date (YYYY-MM-DD) — sitemaps take W3C dates and the day is precise enough. */
export function toLastmod(value: unknown): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
