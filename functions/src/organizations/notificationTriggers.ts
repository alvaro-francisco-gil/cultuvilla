import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { userNotificationsCollection } from '@cultuvilla/shared/firebase/refs/admin';
import { buildNotificationData } from '@cultuvilla/shared/models';

const db = getFirestore();

// Fires for BOTH approval (callable) and rejection (client write) so the
// org_approved/org_rejected notifications land uniformly regardless of which
// path flipped the status. Snapshots are raw DocumentData (not converter-wrapped).
export const onOrganizationUpdated = onDocumentUpdated(
  'organizations/{orgId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const beforeStatus = before['status'] as string | undefined;
    const afterStatus = after['status'] as string | undefined;
    const requestedBy = after['requestedBy'] as string | undefined;
    const municipalityId = (after['municipalityId'] as string | undefined) ?? null;
    const orgName = (after['name'] as string | undefined) ?? '';
    if (!requestedBy) return;
    if (beforeStatus !== 'pending') return;

    let type: 'org_approved' | 'org_rejected';
    let title: string;
    let body: string;
    if (afterStatus === 'approved') {
      type = 'org_approved';
      title = 'Organización aprobada';
      body = `Tu organización "${orgName}" fue aprobada.`;
    } else if (afterStatus === 'rejected') {
      type = 'org_rejected';
      title = 'Organización rechazada';
      body = `Tu organización "${orgName}" fue rechazada.`;
    } else {
      return;
    }

    const ref = userNotificationsCollection(db, requestedBy).doc();
    await ref.set(buildNotificationData({ type, title, body, municipalityId }));
  },
);
