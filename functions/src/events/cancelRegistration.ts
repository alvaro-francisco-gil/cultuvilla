import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  adminDoc,
  eventDoc,
  eventRegistrationDoc,
  eventRegistrationsCollection,
  eventRegistrationPrivateDoc,
  eventSeatTokenDoc,
  eventSeatTokensCollection,
  municipalityMemberDoc,
  userNotificationsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import {
  buildNotificationData,
  buildSeatTokenData,
  OPEN_SEAT_NAME,
} from '@cultuvilla/shared/models';
import { isWalkInAuthorized } from '../helpers/walkInAuthorization';
import { resolveCancellation } from '../helpers/cancellationPlan';
import { generateSeatToken } from '../helpers/seatToken';

const db = getFirestore();

interface CancelRegistrationData {
  eventId?: string;
  registrationId?: string;
}

interface CancelRegistrationResult {
  /** What happened, so the client can word the confirmation honestly. */
  action: 'delete-solo' | 'delete-group' | 'release-seat';
  removedRegistrationIds: string[];
}

/**
 * Removes a registration — the only path that may, since `firestore.rules`
 * denies client deletes on `registrations`.
 *
 * Rules cannot express this. A group is atomic, so cancelling one of its seats
 * must either take every seat with it or leave the group whole; neither is a
 * single-document decision, and Firestore rules can neither read the other
 * seats nor require that a companion delete accompany this one. So the whole
 * operation moved server-side, individual registrations included, rather than
 * leaving a client-writable path that could shrink a group behind the rule's
 * back.
 *
 * See `resolveCancellation` for which of the three outcomes applies.
 */
export const cancelRegistration = onCall<
  CancelRegistrationData,
  Promise<CancelRegistrationResult>
>({ region: 'us-central1', cors: true }, async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const uid = auth.uid;

  const eventId = typeof request.data.eventId === 'string' ? request.data.eventId.trim() : '';
  const registrationId =
    typeof request.data.registrationId === 'string' ? request.data.registrationId.trim() : '';
  if (!eventId) throw new HttpsError('invalid-argument', 'eventId requerido.');
  if (!registrationId) throw new HttpsError('invalid-argument', 'registrationId requerido.');

  return db.runTransaction(async (tx) => {
    const regRef = eventRegistrationDoc(db, eventId, registrationId);
    const [regSnap, eventSnap] = await Promise.all([tx.get(regRef), tx.get(eventDoc(db, eventId))]);

    const reg = regSnap.data();
    if (!reg) throw new HttpsError('not-found', 'Esta inscripción no existe.');
    const eventData = eventSnap.data();
    if (!eventData) throw new HttpsError('not-found', 'El evento no existe.');

    const [villageMemberSnap, appAdminSnap] = await Promise.all([
      tx.get(municipalityMemberDoc(db, eventData.municipalityId, uid)),
      tx.get(adminDoc(db, uid)),
    ]);
    const isOrganizer = isWalkInAuthorized({
      uid,
      organizerUserIds: eventData.organizerUserIds,
      isVillageAdmin: villageMemberSnap.exists && villageMemberSnap.data()?.role === 'admin',
      isAppAdmin: appAdminSnap.exists,
    });

    const plan = resolveCancellation({
      uid,
      isOrganizer,
      registration: {
        userId: reg.userId,
        groupId: reg.groupId,
        groupOwnerId: reg.groupOwnerId,
      },
    });
    if (!plan) {
      logger.info('Cancellation denied', {
        handler: 'cancelRegistration',
        eventId,
        registrationId,
        uid,
      });
      throw new HttpsError('permission-denied', 'No puedes cancelar esta inscripción.');
    }

    // Every read must precede the first write in a Firestore transaction, so
    // the group's seats and tokens are fetched before anything is deleted.
    const groupSeats =
      plan.action === 'delete-group'
        ? await tx.get(eventRegistrationsCollection(db, eventId).where('groupId', '==', plan.groupId))
        : null;
    const groupTokens =
      plan.action === 'delete-group'
        ? await tx.get(eventSeatTokensCollection(db, eventId).where('groupId', '==', plan.groupId))
        : null;

    if (plan.action === 'release-seat') {
      // The seat stays booked and keeps its status and position — capacity was
      // never freed, so the waitlist must not move. Only the identity on it is
      // wound back to the placeholder.
      // withConverter(null): the typed partial rejects the nullable fields
      // below — the converter models whole documents, not patches.
      tx.update(regRef.withConverter(null), {
        userId: reg.groupOwnerId ?? reg.userId,
        personId: '',
        name: OPEN_SEAT_NAME,
        isMember: false,
        photoURL: null,
        personUserId: null,
        isPersonPublic: true,
        isOpenSeat: true,
      });
      // The guest's phone and answers were theirs, not the next claimer's.
      tx.delete(eventRegistrationPrivateDoc(db, eventId, registrationId));

      const token = generateSeatToken();
      tx.set(
        eventSeatTokenDoc(db, eventId, token),
        buildSeatTokenData({
          registrationId,
          groupId: plan.groupId,
          createdBy: reg.groupOwnerId ?? reg.userId,
        }),
      );

      if (reg.groupOwnerId && reg.groupOwnerId !== uid) {
        tx.set(
          userNotificationsCollection(db, reg.groupOwnerId).doc(`seat_${registrationId}`),
          buildNotificationData({
            type: 'seat_released',
            title: 'Plaza libre otra vez',
            body: `${reg.name} ha dejado tu plaza en "${eventData.title}". Puedes volver a invitar a alguien.`,
            eventId,
            municipalityId: eventData.municipalityId,
          }),
        );
      }

      logger.info('Group seat released', {
        handler: 'cancelRegistration',
        eventId,
        registrationId,
        uid,
        groupId: plan.groupId,
      });
      return { action: plan.action, removedRegistrationIds: [] };
    }

    // delete-solo / delete-group. The onRegistrationDeleted trigger recomputes
    // the event counters and runs waitlist promotion, so neither is touched
    // here — doing both would double-count.
    const doomed = groupSeats ? groupSeats.docs.map((d) => d.ref) : [regRef];
    for (const ref of doomed) {
      tx.delete(ref);
      tx.delete(eventRegistrationPrivateDoc(db, eventId, ref.id));
    }
    // Unconsumed links for a group that no longer exists would 404 on claim
    // anyway; deleting them makes the failure immediate and honest.
    for (const tokenDoc of groupTokens?.docs ?? []) {
      tx.delete(tokenDoc.ref);
    }

    logger.info('Registration cancelled', {
      handler: 'cancelRegistration',
      eventId,
      registrationId,
      uid,
      action: plan.action,
      removedCount: doomed.length,
    });

    return { action: plan.action, removedRegistrationIds: doomed.map((r) => r.id) };
  });
});
