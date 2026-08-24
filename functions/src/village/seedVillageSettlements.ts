import { logger } from 'firebase-functions/v2';
import type { Firestore } from 'firebase-admin/firestore';
import { municipalityBarriosCollection } from '@cultuvilla/shared/firebase/refs/admin';
// Deliberately the subpath, not the '@cultuvilla/shared' barrel: these are
// value imports, and the barrel re-exports the design system and hooks, which
// drag React Native into the functions bundle and break the esbuild step.
import {
  SettlementSeedSchema,
  settlementSeedId,
  buildBarrioData,
} from '@cultuvilla/shared/models';

/**
 * Populate a freshly activated village with the settlements OSM knows about —
 * its pedanías, aldeas, parroquias and barrios.
 *
 * Runs AFTER the activation transaction, deliberately, for three reasons:
 *
 * - Vigo has 829 settlements and a Firestore transaction caps at 500 writes.
 * - Seeding is a nice-to-have; activation is not. A village must come to life
 *   even if its seed document is missing or malformed, so every failure here is
 *   logged and swallowed rather than rolled back onto the caller.
 * - It keeps the transaction's read set small.
 *
 * Idempotent: document ids are derived from kind + name, so a re-run overwrites
 * rather than duplicating. That matters because `startVillage` is a callable and
 * a client retry after a timeout is a normal event.
 */
export async function seedVillageSettlements(
  db: Firestore,
  municipalityId: string,
  codigoINE: string,
): Promise<number> {
  const handler = 'seedVillageSettlements';
  try {
    // `_admin/**` is denied to every client, so this reference data cannot be
    // tampered with; the Admin SDK bypasses rules.
    const snap = await db.doc(`_admin/settlements/seeds/${codigoINE}`).get();
    if (!snap.exists) {
      logger.info('no settlement seed for municipality', { handler, municipalityId, codigoINE });
      return 0;
    }

    const parsed = SettlementSeedSchema.safeParse(snap.data());
    if (!parsed.success) {
      logger.warn('settlement seed failed validation; skipping', {
        handler,
        municipalityId,
        codigoINE,
        issues: parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.map(String).join('.')}: ${i.message}`),
      });
      return 0;
    }

    const barrios = municipalityBarriosCollection(db, municipalityId);
    const settlements = parsed.data.settlements;

    // 500 writes per batch is the Firestore limit; the largest municipality
    // (Vigo) needs two.
    const BATCH_SIZE = 450;
    let written = 0;
    for (let i = 0; i < settlements.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const s of settlements.slice(i, i + BATCH_SIZE)) {
        batch.set(
          barrios.doc(settlementSeedId(s.kind, s.name)),
          buildBarrioData({
            name: s.name,
            municipalityId,
            kind: s.kind,
            source: 'osm',
            isSeat: s.isSeat,
            // proposedBy stays null: nobody proposed these, they are reference
            // data. That is also what distinguishes a seeded row from a
            // hand-created one in the UI's "who added this" affordance.
            proposedBy: null,
          }),
        );
      }
      await batch.commit();
      written += Math.min(BATCH_SIZE, settlements.length - i);
    }

    logger.info('seeded village settlements', {
      handler,
      municipalityId,
      codigoINE,
      written,
    });
    return written;
  } catch (err) {
    // Never fail activation because seeding failed — the village exists either
    // way, and an admin can add its settlements by hand.
    logger.error('settlement seeding failed; village is still active', {
      handler,
      municipalityId,
      codigoINE,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
