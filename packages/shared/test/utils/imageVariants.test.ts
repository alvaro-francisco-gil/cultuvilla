import { describe, it, expect } from 'vitest';
import {
  IMAGE_VARIANT_SUFFIX,
  isVariantStoragePath,
  variantImageURL,
  variantStoragePath,
} from '../../src/utils/imageVariants';

const BUCKET = 'villa-events.firebasestorage.app';
const TOKEN = '38ea9482-9564-400f-b347-454a5b455cf7';

function downloadURL(path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
    path,
  )}?alt=media&token=${TOKEN}`;
}

describe('variantStoragePath', () => {
  it('replaces the extension with the variant suffix', () => {
    expect(variantStoragePath('municipalities/28013/images/abc-123.jpg', 'card')).toBe(
      'municipalities/28013/images/abc-123_card.webp',
    );
    expect(variantStoragePath('municipalities/28013/images/abc-123.jpg', 'thumb')).toBe(
      'municipalities/28013/images/abc-123_thumb.webp',
    );
  });

  it('handles a basename with no extension', () => {
    // The seed uploader writes extension-less objects (festivalPosters/.../poster).
    expect(variantStoragePath('festivalPosters/28013/xyz/poster', 'card')).toBe(
      'festivalPosters/28013/xyz/poster_card.webp',
    );
  });

  it('only strips the final extension, not dots earlier in the name', () => {
    expect(variantStoragePath('news/p1/images/v1.2.3.png', 'card')).toBe(
      'news/p1/images/v1.2.3_card.webp',
    );
  });

  it('leaves directory segments containing dots untouched', () => {
    expect(variantStoragePath('a.b/c.d/photo.jpg', 'thumb')).toBe('a.b/c.d/photo_thumb.webp');
  });

  it('is idempotent — a variant path maps to itself', () => {
    const card = 'municipalities/28013/images/abc_card.webp';
    expect(variantStoragePath(card, 'card')).toBe(card);
  });
});

describe('isVariantStoragePath', () => {
  it('recognises generated variants', () => {
    expect(isVariantStoragePath('x/y_card.webp')).toBe(true);
    expect(isVariantStoragePath('x/y_thumb.webp')).toBe(true);
  });

  it('rejects originals', () => {
    expect(isVariantStoragePath('x/y.webp')).toBe(false);
    expect(isVariantStoragePath('x/y_card.jpg')).toBe(false);
    expect(isVariantStoragePath('x/y_cardigan.webp')).toBe(false);
  });

  it('rejects the escudo convention, which is not ours', () => {
    // Escudos ship their own `-thumb.webp` sibling from scripts/upload-escudos.mjs.
    expect(isVariantStoragePath('municipalities/01001/escudo-thumb.webp')).toBe(false);
  });
});

describe('variantImageURL', () => {
  it('rewrites the object path and preserves the query string', () => {
    const original = downloadURL('municipalities/28013/events/e1/image/abc-123.jpg');
    expect(variantImageURL(original, 'card')).toBe(
      downloadURL('municipalities/28013/events/e1/image/abc-123_card.webp'),
    );
  });

  it('preserves the download token, which the trigger copies onto the variant', () => {
    const out = variantImageURL(downloadURL('news/p1/images/a.png'), 'thumb');
    expect(out).toContain(`token=${TOKEN}`);
    expect(out).toContain('alt=media');
  });

  it('returns escudo URLs unchanged — they already ship optimised siblings', () => {
    const escudo = downloadURL('municipalities/01001/escudo.webp');
    expect(variantImageURL(escudo, 'card')).toBe(escudo);
  });

  it('returns a non-Storage URL unchanged', () => {
    const external = 'https://commons.wikimedia.org/x.svg';
    expect(variantImageURL(external, 'card')).toBe(external);
  });

  it('returns null/empty input unchanged', () => {
    expect(variantImageURL(null, 'card')).toBeNull();
    expect(variantImageURL('', 'card')).toBe('');
  });

  it('is idempotent — rewriting a variant URL is a no-op', () => {
    const once = variantImageURL(downloadURL('a/b/c.jpg'), 'card');
    expect(variantImageURL(once, 'card')).toBe(once);
  });

  it('does not confuse a `/o/` inside the object name with the path segment', () => {
    const original = downloadURL('news/o/images/a.jpg');
    expect(variantImageURL(original, 'card')).toBe(downloadURL('news/o/images/a_card.webp'));
  });
});

describe('IMAGE_VARIANT_SUFFIX', () => {
  it('is the contract the Cloud Function trigger writes against', () => {
    expect(IMAGE_VARIANT_SUFFIX).toEqual({ card: '_card', thumb: '_thumb' });
  });
});
