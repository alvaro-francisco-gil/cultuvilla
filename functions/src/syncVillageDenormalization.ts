import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * When a municipality's name, community cover images, or coordinates change,
 * propagate to all events with that municipalityId so the feed always renders
 * fresh values.
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

    const eventsSnap = await db
      .collection('events')
      .where('municipalityId', '==', municipalityId)
      .get();

    if (eventsSnap.empty) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    if (nameChanged) update['municipalityName'] = after['name'];
    if (coverChanged) update['municipalityCoverImage'] = afterCover;
    if (coordsChanged) update['municipalityCoordinates'] = after['coordinates'];

    const docs = eventsSnap.docs;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      docs.slice(i, i + 500).forEach((d) => batch.update(d.ref, update));
      await batch.commit();
    }
  },
);

function pickCover(community: unknown): string | null {
  if (!community || typeof community !== 'object') return null;
  const c = community as { coverImages?: unknown };
  if (Array.isArray(c.coverImages) && c.coverImages.length > 0 && typeof c.coverImages[0] === 'string') {
    return c.coverImages[0] as string;
  }
  return null;
}
