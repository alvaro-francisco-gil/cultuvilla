/**
 * Derived, downscaled copies of an uploaded image.
 *
 * A card in the feed renders a ~400dp-wide box; the original behind it is a
 * phone photo. Rather than storing a second URL on every entity (which would
 * mean touching a schema, its strict converter and a projection for each of the
 * nine image-bearing models), the variant is addressed *by convention*: the
 * `generateImageVariants` storage trigger writes a sibling object next to the
 * original, and the client rewrites the URL in place.
 *
 * The rewrite is a pure string transform on the object path: the query string
 * — download token or not — is carried across untouched, and the trigger gives
 * each variant the same access as its original (copying the token when there is
 * one, omitting it when the original is served through `storage.rules`). So no
 * lookup and no extra round-trip is needed to address a variant.
 *
 * Rewriting is always safe: a variant that has not been generated yet (or was
 * skipped) simply 404s, and the caller falls back to the original URL.
 */

/** Suffix appended to the extension-less basename, before `.webp`. */
export const IMAGE_VARIANT_SUFFIX = {
  /** Long edge 1080px — feed cards, section rows, detail hero images. */
  card: '_card',
  /** Long edge 240px — avatars and other small round/square renders. */
  thumb: '_thumb',
} as const;

export type ImageVariant = keyof typeof IMAGE_VARIANT_SUFFIX;

const VARIANT_RE = new RegExp(
  `(${Object.values(IMAGE_VARIANT_SUFFIX).join('|')})\\.webp$`,
);

/** Storage prefix pattern for reference-data escudos, which are excluded. */
const ESCUDO_RE = /^municipalities\/[^/]+\/escudo(-thumb)?\.webp$/;

/**
 * True when `path` names an object this module generated. Used by the trigger
 * to avoid recursing on its own writes, and by the rewrite to stay idempotent.
 */
export function isVariantStoragePath(path: string): boolean {
  return VARIANT_RE.test(path);
}

/**
 * True when `path` is an image we deliberately do not derive variants for.
 *
 * Escudos are reference data uploaded by `scripts/upload-escudos.mjs` already
 * resized (256px) and already cached immutably, and they carry their own
 * `-thumb` sibling. Generating a second convention over them would be dead
 * weight.
 */
export function isVariantExemptStoragePath(path: string): boolean {
  return ESCUDO_RE.test(path);
}

/**
 * The storage path of `path`'s `variant`. Idempotent: passing a variant path
 * for the same variant returns it unchanged.
 */
export function variantStoragePath(path: string, variant: ImageVariant): string {
  if (isVariantStoragePath(path)) return path;
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const basename = path.slice(slash + 1);
  const dot = basename.lastIndexOf('.');
  const stem = dot === -1 ? basename : basename.slice(0, dot);
  return `${dir}${stem}${IMAGE_VARIANT_SUFFIX[variant]}.webp`;
}

/**
 * Rewrite a Firebase Storage download URL to point at `variant`.
 *
 * Anything that is not a recognisable download URL — an external image, an
 * escudo, a data URI, a local `file://` preview — is returned untouched, so
 * this is safe to apply blindly at every render site.
 */
export function variantImageURL<T extends string | null | undefined>(
  url: T,
  variant: ImageVariant,
): T {
  if (!url) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.hostname.startsWith('firebasestorage.')) return url;

  // Path is /v0/b/{bucket}/o/{percent-encoded object path}. Split on the FIRST
  // `/o/` boundary only — the object name itself may contain an `o` segment.
  const marker = '/o/';
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return url;

  const prefix = parsed.pathname.slice(0, at + marker.length);
  const encoded = parsed.pathname.slice(at + marker.length);
  if (!encoded) return url;

  let objectPath: string;
  try {
    objectPath = decodeURIComponent(encoded);
  } catch {
    return url;
  }
  if (isVariantExemptStoragePath(objectPath)) return url;

  parsed.pathname = prefix + encodeURIComponent(variantStoragePath(objectPath, variant));
  return parsed.toString() as T;
}
