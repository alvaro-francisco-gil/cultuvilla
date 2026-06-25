#!/usr/bin/env node
/**
 * backfill-event-news-ownership.mjs
 *
 * Combined dev backfill for the event/news model migration:
 *  - Events: drop endDate; convert location to { coordinates, displayName };
 *    set organizerUserIds = [createdBy]; set organizerOrgIds from old organizationId;
 *    delete organizationId, organizationName.
 *  - News: set organizerUserIds = [createdBy]; set organizerOrgIds from old authorOrgId;
 *    delete authorUserId, authorOrgId.
 *
 * SKIP (already migrated): docs that already have an organizerUserIds array
 * AND (for events) no endDate field.
 *
 * For events whose location cannot be converted (no GeoPoint coords + no
 * municipality coords), the location field is left untouched and the doc id is
 * added to the "needs-attention" list.
 *
 * USAGE
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   node scripts/backfill-event-news-ownership.mjs          # dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *   node scripts/backfill-event-news-ownership.mjs --apply  # writes
 *
 * SAFETY
 *   Project-pinned to villa-events (dev). Never beta/prod.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('[backfill] GOOGLE_APPLICATION_CREDENTIALS is not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`[backfill] Refusing project "${admin.app().options.projectId}" — dev-only.`);
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const DELETE = admin.firestore.FieldValue.delete();

const stats = {
  events: { scanned: 0, migrated: 0, skipped: 0, needsAttention: 0 },
  news:   { scanned: 0, migrated: 0, skipped: 0 },
};
/** Docs whose location could not be migrated (no coords anywhere). */
const needsAttentionIds = [];

/**
 * Extract lat/lng from a Firestore GeoPoint or a plain {lat,lng} object.
 * Returns null when neither form is recognised.
 *
 * @param {unknown} v
 * @returns {{ lat: number, lng: number } | null}
 */
function extractLatLng(v) {
  if (!v || typeof v !== 'object') return null;
  // Firestore GeoPoint has _latitude/_longitude
  if (typeof v._latitude === 'number' && typeof v._longitude === 'number') {
    return { lat: v._latitude, lng: v._longitude };
  }
  // Plain {lat, lng}
  if (typeof v.lat === 'number' && typeof v.lng === 'number') {
    return { lat: v.lat, lng: v.lng };
  }
  return null;
}

/**
 * Migrate an event doc's location field.
 *
 * Old shapes:
 *   { type: 'coordinates', coordinates: GeoPoint|{lat,lng}, text: string|undefined }
 *   { type: 'text', text: string }
 *   (may already be new shape { coordinates: {lat,lng}, displayName: string })
 *
 * Returns the new location object, or null when coordinates are missing and
 * the municipality fallback is also missing.
 *
 * @param {FirebaseFirestore.DocumentData} data
 * @param {{ lat: number, lng: number } | null} municipalityCoords
 * @returns {{ coordinates: { lat: number, lng: number }, displayName: string } | null}
 */
function migrateLocation(data, municipalityCoords) {
  const loc = data.location;

  // Already migrated?
  if (loc && typeof loc === 'object' && !Array.isArray(loc) && loc.coordinates && typeof loc.displayName === 'string') {
    const inner = extractLatLng(loc.coordinates);
    if (inner) return { coordinates: inner, displayName: loc.displayName };
  }

  if (!loc || typeof loc !== 'object' || Array.isArray(loc)) {
    // No location at all — fall back to municipality coords + name
    if (municipalityCoords) {
      return { coordinates: municipalityCoords, displayName: data.municipalityName ?? '' };
    }
    return null;
  }

  const type = loc.type;
  const rawCoords = loc.coordinates;
  const text = typeof loc.text === 'string' ? loc.text : null;

  if (type === 'coordinates' || rawCoords) {
    const coords = extractLatLng(rawCoords);
    if (coords) {
      return { coordinates: coords, displayName: text || data.municipalityName || '' };
    }
    // coords type but no valid GeoPoint — fall through to text/municipality
  }

  // type === 'text' or no valid coords found
  if (municipalityCoords) {
    return { coordinates: municipalityCoords, displayName: text || data.municipalityName || '' };
  }
  return null;
}

// ---- Events ----------------------------------------------------------------

console.log('[backfill] Scanning events…');
const eventsSnap = await db.collection('events').get();
stats.events.scanned = eventsSnap.size;

for (let i = 0; i < eventsSnap.docs.length; i += 400) {
  const chunk = eventsSnap.docs.slice(i, i + 400);
  const batch = db.batch();
  let writes = 0;

  for (const docSnap of chunk) {
    const data = docSnap.data();

    // Skip if already migrated: has organizerUserIds array AND no endDate
    if (Array.isArray(data.organizerUserIds) && !Object.prototype.hasOwnProperty.call(data, 'endDate')) {
      stats.events.skipped++;
      continue;
    }

    const createdBy = typeof data.createdBy === 'string' ? data.createdBy : '';
    const oldOrgId = typeof data.organizationId === 'string' ? data.organizationId : null;

    const municipalityCoords = extractLatLng(data.municipalityCoordinates);
    const newLocation = migrateLocation(data, municipalityCoords);

    if (!newLocation) {
      console.warn(`[backfill]   event ${docSnap.id} — cannot determine coordinates; skipping location field`);
      stats.events.needsAttention++;
      needsAttentionIds.push(docSnap.id);
    }

    /** @type {Record<string, unknown>} */
    const update = {
      organizerUserIds: [createdBy],
      organizerOrgIds: oldOrgId ? [oldOrgId] : [],
      // Delete old fields
      endDate: DELETE,
      organizationId: DELETE,
      organizationName: DELETE,
    };
    if (newLocation) update.location = newLocation;

    batch.update(docSnap.ref, update);
    writes++;
    stats.events.migrated++;
  }

  if (writes > 0 && APPLY) {
    await batch.commit();
    console.log(`[backfill] events: committed batch of ${writes}`);
  } else if (writes > 0) {
    console.log(`[backfill] events: (dry-run) would update ${writes} docs`);
  }
}

// ---- News ------------------------------------------------------------------

console.log('[backfill] Scanning news…');
const newsSnap = await db.collection('news').get();
stats.news.scanned = newsSnap.size;

for (let i = 0; i < newsSnap.docs.length; i += 400) {
  const chunk = newsSnap.docs.slice(i, i + 400);
  const batch = db.batch();
  let writes = 0;

  for (const docSnap of chunk) {
    const data = docSnap.data();

    // Skip if already migrated: has organizerUserIds array
    if (Array.isArray(data.organizerUserIds)) {
      stats.news.skipped++;
      continue;
    }

    const createdBy = typeof data.createdBy === 'string' ? data.createdBy : '';
    const oldOrgId = typeof data.authorOrgId === 'string' ? data.authorOrgId : null;

    /** @type {Record<string, unknown>} */
    const update = {
      organizerUserIds: [createdBy],
      organizerOrgIds: oldOrgId ? [oldOrgId] : [],
      // Delete old fields
      authorUserId: DELETE,
      authorOrgId: DELETE,
    };

    batch.update(docSnap.ref, update);
    writes++;
    stats.news.migrated++;
  }

  if (writes > 0 && APPLY) {
    await batch.commit();
    console.log(`[backfill] newsPosts: committed batch of ${writes}`);
  } else if (writes > 0) {
    console.log(`[backfill] newsPosts: (dry-run) would update ${writes} docs`);
  }
}

// ---- Summary ---------------------------------------------------------------

console.log('\n[backfill] ======== SUMMARY ========');
console.log(`[backfill] Mode: ${APPLY ? 'APPLY (writes committed)' : 'DRY-RUN (no writes)'}`);
console.log('[backfill] Events:');
console.log(`[backfill]   scanned:         ${stats.events.scanned}`);
console.log(`[backfill]   migrated:        ${stats.events.migrated}`);
console.log(`[backfill]   skipped:         ${stats.events.skipped}`);
console.log(`[backfill]   needs-attention: ${stats.events.needsAttention}`);
if (needsAttentionIds.length > 0) {
  console.warn('[backfill]   IDs needing manual coords:', needsAttentionIds.join(', '));
}
console.log('[backfill] News:');
console.log(`[backfill]   scanned:         ${stats.news.scanned}`);
console.log(`[backfill]   migrated:        ${stats.news.migrated}`);
console.log(`[backfill]   skipped:         ${stats.news.skipped}`);
