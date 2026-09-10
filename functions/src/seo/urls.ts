/**
 * Pure sitemap builders. Kept free of Firestore and of `onRequest` so the XML
 * contract can be unit-tested without an emulator.
 *
 * robots.txt is deliberately NOT here: the Cloud Functions Framework answers
 * `/robots.txt` and `/favicon.ico` itself with an empty 404 before any handler
 * runs, so no function can serve it through a Hosting rewrite. It is a static
 * per-env file instead — see apps/mobile/scripts/write-robots.mjs.
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string | null;
  changefreq?: 'daily' | 'weekly' | 'monthly';
  priority?: string;
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
