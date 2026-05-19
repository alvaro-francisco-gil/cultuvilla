import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  computeStatuses,
  validateRegisterInput,
  type RegisterToEventData,
} from './helpers/registerToEventValidation';

const db = admin.firestore();

interface RegistrationSummary {
  id: string;
  status: 'confirmed' | 'waitlisted';
  position: number;
  isMember: boolean;
}

interface RegisterToEventResult {
  registrations: RegistrationSummary[];
}

export const registerToEvent = onCall<RegisterToEventData, Promise<RegisterToEventResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    const { eventId, registrants } = validateRegisterInput(request.data);
    const userId = auth.uid;

    const eventRef = db.doc(`events/${eventId}`);
    const regsCol = db.collection(`events/${eventId}/registrations`);

    return db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) {
        throw new HttpsError('not-found', 'El evento no existe.');
      }
      const eventData = eventSnap.data() ?? {};
      const maxAttendees =
        typeof eventData.maxAttendees === 'number' ? eventData.maxAttendees : null;
      const municipalityId = eventData.municipalityId as string | undefined;
      if (!municipalityId) {
        throw new HttpsError('failed-precondition', 'El evento no tiene pueblo asociado.');
      }

      const [confirmedSnap, totalSnap, memberSnap] = await Promise.all([
        tx.get(regsCol.where('status', '==', 'confirmed')),
        tx.get(regsCol),
        tx.get(db.doc(`municipalities/${municipalityId}/members/${userId}`)),
      ]);

      const isMember = memberSnap.exists;
      const statuses = computeStatuses({
        maxAttendees,
        existingConfirmedCount: confirmedSnap.size,
        existingTotalCount: totalSnap.size,
        newCount: registrants.length,
      });

      const summaries: RegistrationSummary[] = [];
      registrants.forEach((registrant, i) => {
        const newRef = regsCol.doc();
        const { status, position } = statuses[i];
        tx.set(newRef, {
          userId,
          personId: registrant.personId,
          name: registrant.name,
          status,
          position,
          isMember,
          registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        summaries.push({ id: newRef.id, status, position, isMember });
      });

      // Maintain denormalized counters on the event doc so feeds and detail
      // pages can render "X / Y plazas" without an extra count query. Computed
      // from the snapshot sizes read at transaction start, which is the
      // source-of-truth value for this transaction's serialization point.
      const newConfirmed = summaries.filter((s) => s.status === 'confirmed').length;
      tx.update(eventRef, {
        confirmedCount: confirmedSnap.size + newConfirmed,
        totalCount: totalSnap.size + summaries.length,
      });

      logger.info('Registered to event', {
        handler: 'registerToEvent',
        eventId,
        userId,
        municipalityId,
        registrantCount: registrants.length,
        confirmedAdded: summaries.filter((s) => s.status === 'confirmed').length,
        waitlistedAdded: summaries.filter((s) => s.status === 'waitlisted').length,
      });

      return { registrations: summaries };
    });
  },
);
