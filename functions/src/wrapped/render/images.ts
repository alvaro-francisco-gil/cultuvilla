import sharp from 'sharp';
import { logger } from 'firebase-functions/v2';
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
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_FETCH_TIMEOUT_MS = 8_000;

/**
 * Decoded-pixel ceiling per image, and how many may decode at once.
 *
 * The byte cap alone does not bound memory: JPEG compresses ~20:1, so a 10 MB
 * upload can be a 100-megapixel image that sharp expands to gigabytes of raw
 * RGBA. These two numbers are what the memory budget is actually made of —
 * 24 MP decodes to roughly 100 MB, four at a time is ~400 MB, which fits the
 * 1 GiB the render function asks for with room for Satori and the output.
 * Raise one and you must lower the other.
 */
export const MAX_IMAGE_PIXELS = 24_000_000;
export const IMAGE_CONCURRENCY = 4;

/**
 * How many times one image may be fetched before the card gives up on it.
 *
 * A Wrapped is built once and kept, so an image lost to a blip is lost for
 * good. Three real Matabuena flyers failed with `TypeError: fetch failed` in
 * 177-524ms during one build and every one of them fetched fine immediately
 * after -- far too fast to be the timeout, so these are connection-level
 * blips. Retrying the cheap failures is what stops a card losing its picture
 * to one unlucky moment.
 */
export const IMAGE_FETCH_ATTEMPTS = 3;

/** Pauses between attempts. Short: the render is a user waiting on a callable. */
const RETRY_BACKOFF_MS = [150, 400];

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
/**
 * Which part of an image survives the crop. `top` is for event flyers: their
 * title and date sit at the top, and a centred crop cut them off.
 */
export type CropAnchor = 'attention' | 'top';

/** Origin and path only — a Storage download URL's query carries an access token. */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '(unparseable url)';
  }
}

interface Attempt {
  uri: string | null;
  reason: string;
  /** Whether trying again could plausibly succeed. */
  retryable: boolean;
}

async function attemptLoad(
  url: string,
  width: number,
  height: number,
  fetchImpl: typeof fetch,
  maxBytes: number,
  timeoutMs: number,
  anchor: CropAnchor,
): Promise<Attempt> {
  let res: Response;
  try {
    res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    // Our own deadline already spent the time budget once; spending it twice
    // more is how one slow host turns into a slow render for everybody.
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return { uri: null, reason: timedOut ? 'timeout' : 'network', retryable: !timedOut };
  }
  if (!res.ok) {
    return { uri: null, reason: `http-${String(res.status)}`, retryable: res.status >= 500 || res.status === 429 };
  }
  let input: Buffer | null;
  try {
    input = await readCapped(res, maxBytes);
  } catch {
    // The connection died mid-body; the next attempt may well get all of it.
    return { uri: null, reason: 'network', retryable: true };
  }
  if (!input) return { uri: null, reason: 'too-large', retryable: false };
  try {
    const out = await sharp(input, { limitInputPixels: MAX_IMAGE_PIXELS })
      .resize(Math.round(width), Math.round(height), { fit: 'cover', position: anchor })
      // Tiles are re-encoded as JPEG, which has no alpha: a transparent logo
      // would come out as a solid black disc. Logos are drawn for a light
      // background, so that is what they get.
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { uri: `data:image/jpeg;base64,${out.toString('base64')}`, reason: 'ok', retryable: false };
  } catch {
    // Not an image, or a decode bomb past the pixel ceiling. Same bytes next
    // time, same result.
    return { uri: null, reason: 'decode', retryable: false };
  }
}

export async function loadImage(
  url: string | null,
  width: number,
  height: number,
  fetchImpl: typeof fetch = fetch,
  limits: { maxBytes?: number; timeoutMs?: number; anchor?: CropAnchor; attempts?: number } = {},
): Promise<string | null> {
  if (!url) return null;
  if (!isAllowedImageUrl(url)) {
    logger.warn('wrapped image dropped', {
      handler: 'loadImage',
      reason: 'blocked-host',
      attempts: 0,
      url: redactUrl(url),
    });
    return null;
  }
  const maxBytes = limits.maxBytes ?? MAX_IMAGE_BYTES;
  const timeoutMs = limits.timeoutMs ?? IMAGE_FETCH_TIMEOUT_MS;
  const maxAttempts = limits.attempts ?? IMAGE_FETCH_ATTEMPTS;
  const anchor = limits.anchor ?? 'attention';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const outcome = await attemptLoad(url, width, height, fetchImpl, maxBytes, timeoutMs, anchor);
    if (outcome.uri !== null) return outcome.uri;
    if (!outcome.retryable || attempt === maxAttempts) {
      // Surfaced, never swallowed: a dropped image used to be indistinguishable
      // from an event that simply had no flyer, so a build logged clean while
      // cards quietly lost their pictures.
      logger.warn('wrapped image dropped', {
        handler: 'loadImage',
        reason: outcome.reason,
        attempts: attempt,
        url: redactUrl(url),
      });
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS[attempt - 1] ?? 400));
  }
  return null;
}

/** Load many images with bounded concurrency, preserving input order. */
export async function loadImages(
  jobs: { url: string | null; width: number; height: number; anchor?: CropAnchor }[],
  concurrency = IMAGE_CONCURRENCY,
  fetchImpl: typeof fetch = fetch,
): Promise<(string | null)[]> {
  const results = new Array<string | null>(jobs.length).fill(null);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      results[i] = await loadImage(job.url, job.width, job.height, fetchImpl, { anchor: job.anchor });
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
