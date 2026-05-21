// Helpers for writing in-app notifications during the village request flows.
// Kept thin: each function creates one or more docs under
// users/{userId}/notifications/ and is invoked from the relevant callable
// after its transaction commits.

import * as admin from 'firebase-admin';

const db = admin.firestore();

interface NotifyJoinRequestCreatedInput {
  municipalityId: string;
  municipalityName: string;
  requesterUid: string;
  recipientUserIds: Iterable<string>;
}

export async function notifyJoinRequestCreated(input: NotifyJoinRequestCreatedInput): Promise<void> {
  const ids = new Set(input.recipientUserIds);
  if (ids.size === 0) return;
  const batch = db.batch();
  for (const userId of ids) {
    const ref = db.collection(`users/${userId}/notifications`).doc();
    batch.set(ref, {
      type: 'join_request_created',
      title: 'Nueva solicitud para unirse',
      body: `Hay una nueva solicitud para unirse a ${input.municipalityName}`,
      municipalityId: input.municipalityId,
      requesterUid: input.requesterUid,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

interface NotifyJoinRequestResolvedInput {
  municipalityId: string;
  municipalityName: string;
  requesterUid: string;
  decision: 'approved' | 'rejected';
}

export async function notifyJoinRequestResolved(input: NotifyJoinRequestResolvedInput): Promise<void> {
  const ref = db.collection(`users/${input.requesterUid}/notifications`).doc();
  const approved = input.decision === 'approved';
  await ref.set({
    type: approved ? 'join_request_approved' : 'join_request_rejected',
    title: approved ? 'Solicitud aprobada' : 'Solicitud rechazada',
    body: approved
      ? `Tu solicitud para unirte a ${input.municipalityName} fue aprobada.`
      : `Tu solicitud para unirte a ${input.municipalityName} fue rechazada.`,
    municipalityId: input.municipalityId,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

interface NotifyOrganizerRequestCreatedInput {
  municipalityId: string;
  municipalityName: string;
  requesterUid: string;
}

export async function notifyOrganizerRequestCreated(
  input: NotifyOrganizerRequestCreatedInput,
): Promise<void> {
  const admins = await db.collection('admins').get();
  if (admins.empty) return;
  const batch = db.batch();
  for (const a of admins.docs) {
    const ref = db.collection(`users/${a.id}/notifications`).doc();
    batch.set(ref, {
      type: 'organizer_request_created',
      title: 'Nueva solicitud de organizador',
      body: `${input.requesterUid} quiere organizar ${input.municipalityName}`,
      municipalityId: input.municipalityId,
      requesterUid: input.requesterUid,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

interface NotifyOrganizerRequestResolvedInput {
  municipalityId: string;
  municipalityName: string;
  requesterUid: string;
  decision: 'approved' | 'rejected';
}

export async function notifyOrganizerRequestResolved(
  input: NotifyOrganizerRequestResolvedInput,
): Promise<void> {
  const approved = input.decision === 'approved';
  const ref = db.collection(`users/${input.requesterUid}/notifications`).doc();
  await ref.set({
    type: approved ? 'organizer_request_approved' : 'organizer_request_rejected',
    title: approved ? 'Solicitud aprobada' : 'Solicitud rechazada',
    body: approved
      ? `Tu solicitud para organizar ${input.municipalityName} fue aprobada.`
      : `Tu solicitud para organizar ${input.municipalityName} fue rechazada.`,
    municipalityId: input.municipalityId,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

interface ListVillageAdminRecipientsInput {
  municipalityId: string;
  excludeUid?: string | null;
}

/**
 * Returns the union of (a) the community.adminUserId from the municipality
 * doc and (b) all member docs with role === 'admin'. Excludes excludeUid.
 */
export async function listVillageAdminRecipients(
  input: ListVillageAdminRecipientsInput,
): Promise<string[]> {
  const muniRef = db.doc(`municipalities/${input.municipalityId}`);
  const membersRef = db.collection(`municipalities/${input.municipalityId}/members`);
  const [muniSnap, membersSnap] = await Promise.all([
    muniRef.get(),
    membersRef.where('role', '==', 'admin').get(),
  ]);
  const recipients = new Set<string>();
  const communityAdmin = muniSnap.get('community.adminUserId');
  if (typeof communityAdmin === 'string' && communityAdmin) recipients.add(communityAdmin);
  for (const d of membersSnap.docs) recipients.add(d.id);
  if (input.excludeUid) recipients.delete(input.excludeUid);
  return [...recipients];
}
