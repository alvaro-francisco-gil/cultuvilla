import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { personsCollection } from '@cultuvilla/shared/firebase/refs/admin';

const db = admin.firestore();

const HANDLER = 'onOccupationProposalApproved';

export const onOccupationProposalApproved = onDocumentUpdated(
  'occupationProposals/{proposalId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only trigger when transitioning to 'approved'
    if (before.status === 'approved' || after.status !== 'approved') return;

    const proposalId = event.params.proposalId;

    const approvedOccupationId = after.approvedOccupationId as string | null | undefined;
    if (!approvedOccupationId) {
      logger.warn('Proposal approved but approvedOccupationId is missing', {
        handler: HANDLER,
        proposalId,
      });
      return;
    }

    const name = after.name as string | undefined;
    if (!name) {
      logger.warn('Proposal has no name field', {
        handler: HANDLER,
        proposalId,
      });
      return;
    }

    const snap = await personsCollection(db)
      .where('pendingOccupations', 'array-contains', name)
      .get();

    if (snap.empty) {
      logger.info('No persons matched pendingOccupation; nothing to migrate', {
        handler: HANDLER,
        proposalId,
        pendingOccupation: name,
        migratedCount: 0,
      });
      return;
    }

    const batch = db.batch();
    for (const personDoc of snap.docs) {
      batch.update(personDoc.ref, {
        pendingOccupations: FieldValue.arrayRemove(name),
        occupationIds: FieldValue.arrayUnion(approvedOccupationId),
      });
    }
    await batch.commit();

    logger.info('Migrated persons from pendingOccupation to occupationId', {
      handler: HANDLER,
      proposalId,
      pendingOccupation: name,
      approvedOccupationId,
      migratedCount: snap.size,
    });
  },
);
