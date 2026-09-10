import sharp from 'sharp';
import { bubblePalette } from './theme';

/**
 * Hosts a Wrapped may fetch images from. Every image URL in prod — event
 * flyers, profile photos, carteles, org logos, escudos — is a Firebase Storage
 * download URL, so the allowlist costs nothing real.
 *
 * It exists because these URLs come from documents users can write. Fetching
 * one from a Cloud Function is a server-side request made on that user's
 * behalf; without this, an `imageURL` could point the function at internal
 * endpoints (the GCP metadata server, a VPC address) or anywhere else.
 */
const ALLOWED_IMAGE_HOSTS = new Set(['firebasestorage.googleapis.com', 'storage.googleapis.com']);

/** Larger than any real flyer (phone photos are 2–5 MB); bounds memory per fetch. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const IMAGE_FETCH_TIMEOUT_MS = 8_000;

export function isAllowedImageUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // Exact host match — a suffix check would pass "firebasestorage.googleapis.com.evil.com" —
  // and no userinfo, which is how "https://user@evil.com/…" smuggles a host.
  return url.protocol === 'https:' && url.username === '' && url.password === '' && ALLOWED_IMAGE_HOSTS.has(url.hostname);
}

/** Read a body into memory, aborting as soon as it passes `maxBytes`. */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    // Content-Length can be absent or wrong, so the cap is enforced on the
    // bytes actually read, not on what the server claimed.
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a remote image and downscale it to exactly the box it will occupy,
 * returned as a data URI Satori can embed.
 *
 * Bounded three ways, because the URL is user-supplied: allowlisted host,
 * a timeout, and a byte cap enforced while reading — so neither a slow
 * endpoint nor a huge body can stall or exhaust the function. Redirects are
 * refused rather than followed, since a redirect could leave the allowed host.
 * (sharp's own pixel limit covers decompression bombs.)
 *
 * Returns null on any failure. One dead or refused URL must degrade that
 * single tile to its fallback, never fail the whole Wrapped.
 */
export async function loadImage(
  url: string | null,
  width: number,
  height: number,
  fetchImpl: typeof fetch = fetch,
  limits: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  if (!url || !isAllowedImageUrl(url)) return null;
  const maxBytes = limits.maxBytes ?? MAX_IMAGE_BYTES;
  try {
    const res = await fetchImpl(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(limits.timeoutMs ?? IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const input = await readCapped(res, maxBytes);
    if (!input) return null;
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
