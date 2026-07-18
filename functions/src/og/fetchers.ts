import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';

/**
 * Minimal Open Graph payload the renderer needs. `imageUrl` is null when the
 * source doc has no image — the renderer falls back to a default at that
 * point. Description is already trimmed; the caller does not have to think
 * about length.
 *
 * Why raw Firestore reads (not converters): OG is best-effort. If a doc has
 * partial data, a stale schema, or a field renamed mid-migration, the
 * preview should still render with whatever we *can* read — not crash. The
 * shared converters do strict zod validation that throws on any required-
 * field mismatch; that brittleness doesn't fit the OG use case.
 */
export interface OgMeta {
  title: string;
  description: string;
  imageUrl: string | null;
}

const MAX_DESCRIPTION_CHARS = 200;
const SIGNED_URL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface RawEvent {
  title?: unknown;
  description?: unknown;
  imageURL?: unknown;
  villageCoverImage?: unknown;
}

interface RawNewsImage {
  storagePath?: unknown;
}

interface RawNews {
  title?: unknown;
  body?: unknown;
  images?: unknown;
}

interface RawVillage {
  name?: unknown;
  escudoUrl?: unknown;
  escudoThumbUrl?: unknown;
  escudoManualUrl?: unknown;
  community?: {
    description?: unknown;
  } | null;
}

interface RawOrg {
  name?: unknown;
  description?: unknown;
  images?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function trim(text: string | null | undefined): string {
  if (!text) return '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_DESCRIPTION_CHARS) return collapsed;
  return collapsed.slice(0, MAX_DESCRIPTION_CHARS - 1) + '…';
}

export async function getEventOg(eventId: string): Promise<OgMeta | null> {
  // typed-refs: allowed — intentional converter-less read; see file header.
  const snap = await getFirestore().collection('events').doc(eventId).get();
  if (!snap.exists) return null;
  const e = (snap.data() ?? {}) as RawEvent;
  const title = asString(e.title) ?? '';
  return {
    title,
    description: trim(asString(e.description)),
    imageUrl: asString(e.imageURL) ?? asString(e.villageCoverImage),
  };
}

export async function getVillageOg(municipalityId: string): Promise<OgMeta | null> {
  // typed-refs: allowed — intentional converter-less read; see file header.
  const snap = await getFirestore().collection('municipalities').doc(municipalityId).get();
  if (!snap.exists) return null;
  const v = (snap.data() ?? {}) as RawVillage;
  const community = v.community ?? null;
  return {
    title: asString(v.name) ?? '',
    description: trim(community ? asString(community.description) : ''),
    imageUrl:
      asString(v.escudoManualUrl) ?? asString(v.escudoUrl) ?? asString(v.escudoThumbUrl),
  };
}

export async function getOrgOg(orgId: string): Promise<OgMeta | null> {
  // typed-refs: allowed — intentional converter-less read; see file header.
  const snap = await getFirestore().collection('organizations').doc(orgId).get();
  if (!snap.exists) return null;
  const o = (snap.data() ?? {}) as RawOrg;
  // images[0] is the hero/cover — see OrganizationDataModel's images convention.
  const images = Array.isArray(o.images) ? o.images : [];
  return {
    title: asString(o.name) ?? '',
    description: trim(asString(o.description)),
    imageUrl: asString(images[0]),
  };
}

/**
 * News posts store `storagePath` only — no public URL. We mint a v4 signed
 * read URL valid for 7 days so OG crawlers can fetch the image. Crawlers
 * cache previews for a while and re-fetch periodically; 7 days is plenty.
 *
 * If signing fails (missing IAM permission, emulator without proper config),
 * we log a warning and return imageUrl: null so the renderer falls back to
 * the default. The text content (title + description) still renders.
 */
export async function getNewsOg(postId: string): Promise<OgMeta | null> {
  // typed-refs: allowed — intentional converter-less read; see file header.
  const snap = await getFirestore().collection('news').doc(postId).get();
  if (!snap.exists) return null;
  const n = (snap.data() ?? {}) as RawNews;
  const images = Array.isArray(n.images) ? (n.images as RawNewsImage[]) : [];
  const firstPath = asString(images[0]?.storagePath);
  let imageUrl: string | null = null;
  if (firstPath) {
    try {
      const [url] = await getStorage()
        .bucket()
        .file(firstPath)
        .getSignedUrl({
          action: 'read',
          expires: Date.now() + SIGNED_URL_EXPIRY_MS,
        });
      imageUrl = url;
    } catch (err) {
      logger.warn('Failed to sign news image URL', {
        handler: 'ogRenderer',
        postId,
        storagePath: firstPath,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {
    title: asString(n.title) ?? '',
    description: trim(asString(n.body)),
    imageUrl,
  };
}
