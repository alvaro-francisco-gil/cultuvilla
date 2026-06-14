/**
 * Parse the Storage object path out of a Firebase download URL.
 * Download URLs look like
 *   https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{ENCODED_PATH}?alt=media&token=...
 * where ENCODED_PATH is the URL-encoded object path (slashes as %2F).
 * Returns null if `url` is not a parseable Firebase download URL.
 *
 * Pure (no firebase imports) so it is unit-testable without the emulator.
 */
export function storageObjectPathFromDownloadUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const marker = '/o/';
  const idx = parsed.pathname.indexOf(marker);
  if (idx === -1) return null;
  const encoded = parsed.pathname.slice(idx + marker.length);
  if (!encoded) return null;
  return decodeURIComponent(encoded);
}
