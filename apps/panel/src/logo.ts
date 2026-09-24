/**
 * Entity logos, best-effort.
 *
 * Most registry entities carry a real `url`; the rest carry `[[confirmar]]`
 * because nobody has verified them yet. So a logo is never guaranteed, and the
 * monogram is the real design — the favicon is an upgrade when a domain exists.
 */

/** The hostname of a usable https URL, or null for a `[[confirmar]]` placeholder. */
export function hostnameOf(url: string | undefined): string | null {
  if (!url || url.includes('[[')) return null;
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * DuckDuckGo's icon service rather than Google's: this is an internal tool, but a
 * per-entity request to Google still tells Google which funders we are looking
 * at, and DDG's equivalent endpoint needs no key either.
 */
export function faviconUrl(url: string | undefined): string | null {
  const host = hostnameOf(url);
  return host ? `https://icons.duckduckgo.com/ip3/${host}.ico` : null;
}

/**
 * Up to two letters for the monogram. Initials of the first two words, so
 * "Fundación Daniel y Nina Carasso" reads FD rather than F, and an acronym like
 * "ADEFO Cinco Villas" keeps AC. Short words that carry no signal are skipped.
 */
const SKIP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'para', 'por']);

export function monogram(titulo: string): string {
  const words = titulo
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return '·';
  const [first = '', second] = words;
  const letters = second ? `${first.slice(0, 1)}${second.slice(0, 1)}` : first.slice(0, 2);
  return letters.toUpperCase();
}

/** Stable index into the monogram palette, so an entity keeps its colour. */
export function monogramColorIndex(id: string, paletteSize: number): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)!) % 100_000;
  return hash % paletteSize;
}
