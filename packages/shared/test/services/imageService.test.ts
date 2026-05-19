import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({
  getFirebaseStorage: () => ({}),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

import { validateUploadableImage } from '../../src/services/imageService';

// The web `File` API is not available in node-vitest. `validateUploadableImage`
// is the pure validator used by both upload paths and must work on any Blob,
// which is what RN's `fetch(uri).then(r => r.blob())` returns.
describe('validateUploadableImage', () => {
  function makeBlob(opts: { size: number; type: string }): Blob {
    return {
      size: opts.size,
      type: opts.type,
    } as unknown as Blob;
  }

  it('accepts a small image/jpeg blob', () => {
    expect(() =>
      validateUploadableImage({
        blob: makeBlob({ size: 1024, type: 'image/jpeg' }),
        filename: 'a.jpg',
      }),
    ).not.toThrow();
  });

  it('rejects a blob whose declared type is not an image', () => {
    expect(() =>
      validateUploadableImage({
        blob: makeBlob({ size: 1024, type: 'application/pdf' }),
        filename: 'a.pdf',
      }),
    ).toThrow(/no es una imagen/);
  });

  it('rejects a blob over 5 MB', () => {
    expect(() =>
      validateUploadableImage({
        blob: makeBlob({ size: 6 * 1024 * 1024, type: 'image/png' }),
        filename: 'big.png',
      }),
    ).toThrow(/5 MB/);
  });

  it('honors an explicit contentType override (used by RN when blob.type is empty)', () => {
    expect(() =>
      validateUploadableImage({
        blob: makeBlob({ size: 1024, type: '' }),
        filename: 'rn.jpg',
        contentType: 'image/jpeg',
      }),
    ).not.toThrow();
  });

  it('rejects when neither blob.type nor contentType identifies an image', () => {
    expect(() =>
      validateUploadableImage({
        blob: makeBlob({ size: 1024, type: '' }),
        filename: 'mystery.bin',
      }),
    ).toThrow(/no es una imagen/);
  });
});
