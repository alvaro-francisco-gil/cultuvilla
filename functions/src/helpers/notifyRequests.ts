// Helpers for writing in-app notifications during the village request flows.
// Kept thin: each function creates one or more docs under
// users/{userId}/notifications/ and is invoked from the relevant callable
// after its transaction commits.

import * as admin from 'firebase-admin';
import { userNotificationsCollection } from '@cultuvilla/shared/firebase/refs/admin';
import { buildNotificationData } from '@cultuvilla/shared/models';

const db = admin.firestore();

interface NotifyJoinRequestResolvedInput {
  orgId: string;
  orgName: string;
  municipalityId: string;
  requesterUid: string;
  decision: 'approved' | 'rejected';
}

export async function notifyJoinRequestResolved(
  input: NotifyJoinRequestResolvedInput,
): Promise<void> {
  const approved = input.decision === 'approved';
  const ref = userNotificationsCollection(db, input.requesterUid).doc();
  await ref.set(
    buildNotificationData({
      type: approved ? 'join_request_approved' : 'join_request_rejected',
      title: approved ? 'Solicitud aceptada' : 'Solicitud rechazada',
      body: approved
        ? `Te has unido a ${input.orgName}.`
        : `Tu solicitud para unirte a ${input.orgName} fue rechazada.`,
      municipalityId: input.municipalityId,
    }),
  );
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

