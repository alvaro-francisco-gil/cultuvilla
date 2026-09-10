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
  /**
   * Structured facts used to build the indexable body block and the JSON-LD
   * payload. Best-effort like everything else here: a missing field renders a
   * thinner page, never an error.
   */
  detail?: OgDetail | null;
  /**
   * Emit `<meta name="robots" content="noindex">`. Set for surfaces that are
   * legitimately reachable but must never rank: invite links and anything whose
   * content is withheld from the anonymous reader.
   */
  noindex?: boolean;
}

export type OgDetail =
  | {
      kind: 'event';
      startDate: string | null;
      endDate: string | null;
      locationName: string | null;
      villageName: string | null;
      municipalityId: string | null;
      cancelled: boolean;
    }
  | {
      kind: 'village';
      municipalityId: string;
      province: string | null;
      comunidadAutonoma: string | null;
      lat: number | null;
      lng: number | null;
    }
  | { kind: 'org'; orgType: string | null; municipalityId: string | null }
  | { kind: 'news'; publishedAt: string | null; municipalityId: string | null };

const MAX_DESCRIPTION_CHARS = 200;
const SIGNED_URL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface RawEvent {
  title?: unknown;
  description?: unknown;
  imageURL?: unknown;
  villageCoverImage?: unknown;
  visibilityOrgId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  location?: { displayName?: unknown } | null;
  villageName?: unknown;
  municipalityId?: unknown;
  status?: unknown;
}

interface RawNewsImage {
  storagePath?: unknown;
}

interface RawNews {
  title?: unknown;
  body?: unknown;
  images?: unknown;
  publishedAt?: unknown;
  createdAt?: unknown;
  municipalityId?: unknown;
}

interface RawVillage {
  name?: unknown;
  escudoUrl?: unknown;
  escudoThumbUrl?: unknown;
  escudoManualUrl?: unknown;
  province?: unknown;
  comunidadAutonoma?: unknown;
  coordinates?: { lat?: unknown; lng?: unknown } | null;
  community?: {
    description?: unknown;
  } | null;
}

interface RawOrg {
  name?: unknown;
  description?: unknown;
  images?: unknown;
  type?: unknown;
  municipalityId?: unknown;
}

const PRIVATE_EVENT_DESCRIPTION = 'Solo visible para los miembros de la organización.';

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

interface TimestampLike {
  toDate: () => Date;
}

function hasToDate(v: unknown): v is TimestampLike {
  return typeof v === 'object' && v !== null && typeof (v as TimestampLike).toDate === 'function';
}

/**
 * Firestore Timestamp | Date | ISO string -> ISO string. Converter-less reads
 * mean we see raw Timestamps, and schema.org wants ISO-8601. Anything else
 * (null, a number, a half-migrated field) degrades to null rather than
 * emitting an invalid date into structured data, which Search Console flags.
 */
function toIso(v: unknown): string | null {
  if (hasToDate(v)) {
    const d = v.toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
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
  // A link preview is rendered for whoever scrolls past the URL — there is no
  // viewer to authorize. So a private event gets a card that says only that it
  // exists and is private: no title, no description, no flyer. The app itself
  // still enforces access when the link is opened.
  if (asString(e.visibilityOrgId) !== null) {
    return {
      title: 'Evento privado',
      description: PRIVATE_EVENT_DESCRIPTION,
      imageUrl: null,
      // Withheld content must not rank: the page is reachable, but there is
      // nothing here a search result should ever promise a reader.
      noindex: true,
    };
  }
  const title = asString(e.title) ?? '';
  return {
    title,
    description: trim(asString(e.description)),
    imageUrl: asString(e.imageURL) ?? asString(e.villageCoverImage),
    detail: {
      kind: 'event',
      startDate: toIso(e.startDate),
      endDate: toIso(e.endDate),
      locationName: asString(e.location?.displayName),
      villageName: asString(e.villageName),
      municipalityId: asString(e.municipalityId),
      cancelled: asString(e.status) === 'cancelled',
    },
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
    detail: {
      kind: 'village',
      municipalityId,
      province: asString(v.province),
      comunidadAutonoma: asString(v.comunidadAutonoma),
      lat: asNumber(v.coordinates?.lat),
      lng: asNumber(v.coordinates?.lng),
    },
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
    detail: {
      kind: 'org',
      orgType: asString(o.type),
      municipalityId: asString(o.municipalityId),
    },
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
    detail: {
      kind: 'news',
      publishedAt: toIso(n.publishedAt) ?? toIso(n.createdAt),
      municipalityId: asString(n.municipalityId),
    },
  };
}
