import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, type UpdateData } from 'firebase-admin/firestore';
import type { EventData } from '@cultuvilla/shared';
import { eventsCollection } from '@cultuvilla/shared/firebase/refs/admin';

const db = getFirestore();

/**
 * When a municipality's name, community cover images, or coordinates change,
 * propagate to all events with that municipalityId so the feed always renders
 * fresh values.
 *
 * Note: the municipality side (before/after) is still raw — the municipality
 * collection has not migrated to schema-first models yet (Task 16). Once it
 * does, those reads will move through `municipalityDoc(db, id)`.
 */
export const syncVillageDenormalization = onDocumentUpdated(
  { document: 'municipalities/{municipalityId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before.data() ?? {};
    const after = event.data?.after.data() ?? {};
    const municipalityId = event.params.municipalityId;

    const nameChanged = before['name'] !== after['name'];
    const coordsChanged =
      JSON.stringify(before['coordinates'] ?? null) !==
      JSON.stringify(after['coordinates'] ?? null);

    const beforeCover = pickCover(before['community']);
    const afterCover = pickCover(after['community']);
    const coverChanged = beforeCover !== afterCover;

    if (!nameChanged && !coverChanged && !coordsChanged) return;

    // Typed events collection ref — converter is wired but the batch.update
    // path below bypasses it (writes a raw partial) so the admin GeoPoint
    // shape on `municipalityCoordinates` is persisted as-is.
    const eventsSnap = await eventsCollection(db)
      .where('municipalityId', '==', municipalityId)
      .get();

    if (eventsSnap.empty) return;

    // batch.update bypasses the converter, so we write the raw admin shape
    // (e.g. municipalityCoordinates stays as a GeoPoint here — the read-side
    // converter normalizes it back to {lat, lng} when feeds read events).
    // The UpdateData<EventData> cast accommodates that wire-shape mismatch
    // while preserving the converter typing on the ref itself.
    const update: Record<string, unknown> = {};
    if (nameChanged) update['municipalityName'] = after['name'];
    if (coverChanged) update['municipalityCoverImage'] = afterCover;
    if (coordsChanged) update['municipalityCoordinates'] = after['coordinates'];
    const updatePayload = update as UpdateData<EventData>;

    const docs = eventsSnap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      docs.slice(i, i + 500).forEach((d) => batch.update(d.ref, updatePayload));
      await batch.commit();
    }
  },
);

function pickCover(community: unknown): string | null {
  if (!community || typeof community !== 'object') return null;
  const c = community as { coverImages?: unknown };
  if (Array.isArray(c.coverImages) && c.coverImages.length > 0 && typeof c.coverImages[0] === 'string') {
    return c.coverImages[0];
  }
  return null;
}
