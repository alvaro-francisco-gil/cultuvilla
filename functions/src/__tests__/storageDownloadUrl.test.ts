import { describe, it, expect } from 'vitest';
import { storageObjectPathFromDownloadUrl } from '../helpers/storageDownloadUrl';

describe('storageObjectPathFromDownloadUrl', () => {
  it('extracts and decodes the object path from a Firebase download URL', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/villa-events.firebasestorage.app/o/' +
      'municipalities%2Fmun-1%2Fimages%2Fabc-123.jpg?alt=media&token=xyz';
    expect(storageObjectPathFromDownloadUrl(url)).toBe('municipalities/mun-1/images/abc-123.jpg');
  });

  it('returns null for a URL without an /o/ segment', () => {
    expect(storageObjectPathFromDownloadUrl('https://example.com/not-a-storage-url')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(storageObjectPathFromDownloadUrl('municipalities/mun-1/images/abc.jpg')).toBeNull();
  });
});
