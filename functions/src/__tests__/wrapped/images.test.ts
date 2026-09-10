import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  IMAGE_CONCURRENCY,
  MAX_IMAGE_PIXELS,
  isAllowedImageUrl,
  loadImage,
  loadImages,
} from '../../wrapped/render/images';

/**
 * Image URLs come from documents users can write — an event's `imageURL`, a
 * profile `photoURL`. Fetching them from a Cloud Function is a server-side
 * request on the user's behalf, so where it may go and how much it may pull
 * are security boundaries, not tuning.
 */

const STORAGE = 'https://firebasestorage.googleapis.com/v0/b/cultuvilla-prod.firebasestorage.app/o/x.jpg?alt=media';

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: '#bb5d3a' } }).png().toBuffer();
}

function respond(body: Buffer | Uint8Array, headers: Record<string, string> = {}): typeof fetch {
  return () => Promise.resolve(new Response(body, { status: 200, headers }));
}

describe('isAllowedImageUrl', () => {
  it('allows Firebase Storage download URLs, the only host in prod data', () => {
    expect(isAllowedImageUrl(STORAGE)).toBe(true);
    expect(isAllowedImageUrl('https://storage.googleapis.com/bucket/escudo.webp')).toBe(true);
  });

  for (const url of [
    'http://firebasestorage.googleapis.com/x.jpg', // not https
    'http://169.254.169.254/computeMetadata/v1/', // GCP metadata server
    'http://metadata.google.internal/computeMetadata/v1/',
    'https://localhost/x.jpg',
    'https://127.0.0.1/x.jpg',
    'https://10.0.0.5/x.jpg',
    'https://evil.example.com/x.jpg',
    'https://firebasestorage.googleapis.com.evil.com/x.jpg', // suffix trick
    'https://user@evil.com/firebasestorage.googleapis.com', // userinfo trick
    'file:///etc/passwd',
    'not a url',
  ]) {
    it(`refuses ${url}`, () => {
      expect(isAllowedImageUrl(url)).toBe(false);
    });
  }
});

describe('loadImage', () => {
  it('loads and resizes an allowed image', async () => {
    const uri = await loadImage(STORAGE, 8, 8, respond(await png()));
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('never fetches a disallowed URL at all', async () => {
    let called = false;
    const spy: typeof fetch = () => {
      called = true;
      return Promise.resolve(new Response(null));
    };
    expect(await loadImage('http://169.254.169.254/', 8, 8, spy)).toBeNull();
    expect(called).toBe(false);
  });

  it('refuses a response that declares itself too large, without reading it', async () => {
    const uri = await loadImage(STORAGE, 8, 8, respond(await png(), { 'content-length': String(500 * 1024 * 1024) }), {
      maxBytes: 1024,
    });
    expect(uri).toBeNull();
  });

  // Content-Length can be absent or lie; the cap has to hold on the bytes read.
  it('stops reading a body that grows past the cap, whatever it declared', async () => {
    const big = new Uint8Array(64 * 1024);
    const uri = await loadImage(STORAGE, 8, 8, respond(big), { maxBytes: 1024 });
    expect(uri).toBeNull();
  });

  it('gives up on a response that never arrives', async () => {
    const stalled: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => { reject(new Error('aborted')); });
      });
    const started = Date.now();
    expect(await loadImage(STORAGE, 8, 8, stalled, { timeoutMs: 50 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not follow redirects, which could leave the allowed host', async () => {
    let redirectMode: RequestRedirect | undefined;
    const spy: typeof fetch = (_url, init) => {
      redirectMode = init?.redirect;
      return Promise.resolve(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }));
    };
    expect(await loadImage(STORAGE, 8, 8, spy)).toBeNull();
    expect(redirectMode).toBe('error');
  });

  it('returns null rather than throwing on a non-image body', async () => {
    expect(await loadImage(STORAGE, 8, 8, respond(Buffer.from('<html>not an image</html>')))).toBeNull();
  });
});

describe('decode bounds', () => {
  // The byte cap alone does not bound memory: a small JPEG can decode to
  // gigabytes of raw pixels. sharp must refuse the decode, leaving the tile
  // to its fallback rather than taking the function's memory with it.
  it('refuses an image whose decoded size passes the pixel ceiling', async () => {
    const side = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 500;
    const bomb = await sharp({
      create: { width: side, height: side, channels: 3, background: '#000' },
    })
      .jpeg({ quality: 1 })
      .toBuffer();
    expect(bomb.byteLength).toBeLessThan(10 * 1024 * 1024);
    expect(await loadImage(STORAGE, 100, 100, respond(bomb))).toBeNull();
  }, 60_000);

  it('accepts an image below the ceiling', async () => {
    expect(await loadImage(STORAGE, 8, 8, respond(await png()))).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('never decodes more than IMAGE_CONCURRENCY images at once', async () => {
    const body = await png();
    let inFlight = 0;
    let peak = 0;
    const counted: typeof fetch = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return new Response(body, { status: 200 });
    };
    const jobs = Array.from({ length: 40 }, () => ({ url: STORAGE, width: 8, height: 8 }));
    const out = await loadImages(jobs, undefined, counted);
    expect(out).toHaveLength(40);
    expect(peak).toBeLessThanOrEqual(IMAGE_CONCURRENCY);
  }, 30_000);
});
