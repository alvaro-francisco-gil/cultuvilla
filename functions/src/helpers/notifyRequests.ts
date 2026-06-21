// Helpers for writing in-app notifications during the village request flows.
// Kept thin: each function creates one or more docs under
// users/{userId}/notifications/ and is invoked from the relevant callable
// after its transaction commits.

import * as admin from 'firebase-admin';
import {
  adminsCollection,
  userNotificationsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildNotificationData } from '@cultuvilla/shared/models';

const db = admin.firestore();

interface NotifyOrganizerRequestCreatedInput {
  municipalityId: string;
  municipalityName: string;
  requesterUid: string;
}

export async function notifyOrganizerRequestCreated(
  input: NotifyOrganizerRequestCreatedInput,
): Promise<void> {
  const admins = await adminsCollection(db).get();
  if (admins.empty) return;
  const batch = db.batch();
  for (const a of admins.docs) {
    const ref = userNotificationsCollection(db, a.id).doc();
    batch.set(
      ref,
      buildNotificationData({
        type: 'organizer_request_created',
        title: 'Nueva solicitud de organizador',
        body: `${input.requesterUid} quiere organizar ${input.municipalityName}`,
        municipalityId: input.municipalityId,
        requesterUid: input.requesterUid,
      }),
    );
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
  const ref = userNotificationsCollection(db, input.requesterUid).doc();
  await ref.set(
    buildNotificationData({
      type: approved ? 'organizer_request_approved' : 'organizer_request_rejected',
      title: approved ? 'Solicitud aprobada' : 'Solicitud rechazada',
      body: approved
        ? `Tu solicitud para organizar ${input.municipalityName} fue aprobada.`
        : `Tu solicitud para organizar ${input.municipalityName} fue rechazada.`,
      municipalityId: input.municipalityId,
    }),
  );
}

