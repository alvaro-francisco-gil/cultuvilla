import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

export const onOccupationProposalApproved = onDocumentUpdated(
  'occupationProposals/{proposalId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only trigger when transitioning to 'approved'
    if (before.status === 'approved' || after.status !== 'approved') return;

    const approvedOccupationId = after.approvedOccupationId as string | null | undefined;
    if (!approvedOccupationId) {
      console.warn(
        `onOccupationProposalApproved: proposal ${event.params.proposalId} approved but approvedOccupationId is missing.`
      );
      return;
    }

    const name = after.name as string | undefined;
    if (!name) {
      console.warn(
        `onOccupationProposalApproved: proposal ${event.params.proposalId} has no name field.`
      );
      return;
    }

    const snap = await db.collection('persons')
      .where('pendingOccupations', 'array-contains', name)
      .get();

    if (snap.empty) {
      console.log(
        `onOccupationProposalApproved: no persons found with pendingOccupation "${name}".`
      );
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

    console.log(
      `onOccupationProposalApproved: migrated ${snap.size} person(s) from pendingOccupation "${name}" → occupationId "${approvedOccupationId}".`
    );
  },
);
