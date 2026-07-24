#!/usr/bin/env node
/**
 * backfill-event-news-ownership.mjs
 *
 * Combined backfill for the event/news model migration:
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
 *   node scripts/backfill-event-news-ownership.mjs                 (dev dry run)
 *   node scripts/backfill-event-news-ownership.mjs --apply         (dev writes)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-event-news-ownership.mjs --env=beta --confirm --apply
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 * `--apply` still gates the actual write on every env (dry run without it).
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const DELETE = admin.firestore.FieldValue.delete();

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
      return { coordinates: municipalityCoords, displayName: data.villageName ?? '' };
    }
    return null;
  }

  const type = loc.type;
  const rawCoords = loc.coordinates;
  const text = typeof loc.text === 'string' ? loc.text : null;

  if (type === 'coordinates' || rawCoords) {
    const coords = extractLatLng(rawCoords);
    if (coords) {
      return { coordinates: coords, displayName: text || data.villageName || '' };
    }
    // coords type but no valid GeoPoint — fall through to text/municipality
  }

  // type === 'text' or no valid coords found
  if (municipalityCoords) {
    return { coordinates: municipalityCoords, displayName: text || data.villageName || '' };
  }
  return null;
}

function eventPatchFor(data, docSnap) {
  // Skip if already migrated: has organizerUserIds array AND no endDate
  if (Array.isArray(data.organizerUserIds) && !Object.prototype.hasOwnProperty.call(data, 'endDate')) {
    return null;
  }

  const createdBy = typeof data.createdBy === 'string' ? data.createdBy : '';
  const oldOrgId = typeof data.organizationId === 'string' ? data.organizationId : null;

  const municipalityCoords = extractLatLng(data.villageCoordinates);
  const newLocation = migrateLocation(data, municipalityCoords);

  if (!newLocation) {
    console.warn(`  event ${docSnap.id} — cannot determine coordinates; skipping location field`);
    needsAttentionIds.push(docSnap.id);
  }

  /** @type {Record<string, unknown>} */
  const update = {
    organizerUserIds: [createdBy],
    organizerOrgIds: oldOrgId ? [oldOrgId] : [],
    endDate: DELETE,
    organizationId: DELETE,
    organizationName: DELETE,
  };
  if (newLocation) update.location = newLocation;
  return update;
}

function newsPatchFor(data) {
  // Skip if already migrated: has organizerUserIds array
  if (Array.isArray(data.organizerUserIds)) return null;

  const createdBy = typeof data.createdBy === 'string' ? data.createdBy : '';
  const oldOrgId = typeof data.authorOrgId === 'string' ? data.authorOrgId : null;

  return {
    organizerUserIds: [createdBy],
    organizerOrgIds: oldOrgId ? [oldOrgId] : [],
    authorUserId: DELETE,
    authorOrgId: DELETE,
  };
}

async function main() {
  console.log(`${APPLY ? 'Backfilling' : 'DRY-RUN: checking'} event/news ownership against ${projectId}`);

  await backfillCollection(db, 'events', db.collection('events'), eventPatchFor, { apply: APPLY });
  if (needsAttentionIds.length > 0) {
    console.warn(`  IDs needing manual coords: ${needsAttentionIds.join(', ')}`);
  }

  await backfillCollection(db, 'news', db.collection('news'), newsPatchFor, { apply: APPLY });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
