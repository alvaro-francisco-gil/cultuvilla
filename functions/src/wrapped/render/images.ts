import sharp from 'sharp';
import { bubblePalette } from './theme';

/**
 * Fetch a remote image and downscale it to exactly the box it will occupy,
 * returned as a data URI Satori can embed.
 *
 * Downscaling matters for more than speed: an event flyer can be several MB,
 * and a people wall embeds up to a few hundred photos into one SVG. Shrinking
 * each to its rendered size first keeps the SVG — and the function's memory —
 * bounded by the card, not by whatever someone uploaded.
 *
 * Returns null on any failure. One dead URL or a revoked photo must degrade
 * that single tile to its fallback, never fail the whole Wrapped.
 */
export async function loadImage(
  url: string | null,
  width: number,
  height: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize(Math.round(width), Math.round(height), { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Load many images with bounded concurrency, preserving input order. */
export async function loadImages(
  jobs: { url: string | null; width: number; height: number }[],
  concurrency = 8,
  fetchImpl: typeof fetch = fetch,
): Promise<(string | null)[]> {
  const results = new Array<string | null>(jobs.length).fill(null);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      results[i] = await loadImage(job.url, job.width, job.height, fetchImpl);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
  return results;
}

/**
 * Up to two initials: the first LETTER of the first and last words.
 *
 * Letters, not characters — real names carry parentheticals ("Juan García
 * (hijo)"), and the first character of "(hijo)" rendered bubbles as "J(".
 * Accent-stripped so "Álvaro" gives "A" rather than a lone combining mark.
 */
export function initials(name: string): string {
  const letters = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map((w) => w.match(/\p{L}/u)?.[0])
    .filter((c): c is string => c !== undefined);
  if (letters.length === 0) return '?';
  const last = letters.length > 1 ? letters[letters.length - 1] : '';
  return (letters[0] + last).toUpperCase();
}

/** Stable colour per name, so a person is the same colour on every card and every recompute. */
export function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return bubblePalette[Math.abs(hash) % bubblePalette.length];
}
