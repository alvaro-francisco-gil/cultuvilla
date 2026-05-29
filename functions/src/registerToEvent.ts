import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  eventDoc,
  eventRegistrationsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { RegistrationData } from '@cultuvilla/shared';
import {
  computeStatuses,
  validateRegisterInput,
  type RegisterToEventData,
} from './helpers/registerToEventValidation';

const db = getFirestore();

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

    const eventRef = eventDoc(db, eventId);
    const regsCol = eventRegistrationsCollection(db, eventId);

    return db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) {
        throw new HttpsError('not-found', 'El evento no existe.');
      }
      // Converter-wrapped: typed EventData.
      const eventData = eventSnap.data();
      if (!eventData) {
        throw new HttpsError('not-found', 'El evento no existe.');
      }
      const maxAttendees = eventData.maxAttendees;
      const municipalityId = eventData.municipalityId;
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
      // Converter rejects FieldValue sentinels on tx.set, so registeredAt is a
      // plain Date computed once per transaction (admin SDK will store it as a
      // Timestamp via the converter's toFirestore step).
      const registeredAt = new Date();
      registrants.forEach((registrant, i) => {
        const newRef = regsCol.doc();
        const { status, position } = statuses[i];
        const reg: RegistrationData = {
          userId,
          personId: registrant.personId,
          name: registrant.name,
          status,
          position,
          isMember,
          registeredAt,
        };
        tx.set(newRef, reg);
        summaries.push({ id: newRef.id, status, position, isMember });
      });

      // Maintain denormalized counters on the event doc so feeds and detail
      // pages can render "X / Y plazas" without an extra count query. Computed
      // from the snapshot sizes read at transaction start, which is the
      // source-of-truth value for this transaction's serialization point.
      // tx.update bypasses the converter, so an untyped partial is fine.
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
