import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  eventDoc,
  eventRegistrationsCollection,
  eventRegistrationContactDoc,
  municipalityMemberDoc,
  organizationMemberDoc,
  adminDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { RegistrationData } from '@cultuvilla/shared';
import { computeStatuses } from '../helpers/registerToEventValidation';

const db = getFirestore();

interface AddWalkInData {
  eventId?: string;
  name?: string;
  phone?: string;
}

interface AddWalkInResult {
  registration: { id: string; status: 'confirmed' | 'waitlisted'; position: number };
}

// An organizer (org member of the event's org, village admin, or app admin)
// adds a walk-in attendee with no user account. The registration carries an
// empty userId/personId; the same capacity/waitlist logic and counter updates
// as registerToEvent apply.
export const addWalkInRegistration = onCall<AddWalkInData, Promise<AddWalkInResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const eventId = typeof request.data.eventId === 'string' ? request.data.eventId.trim() : '';
    const name = typeof request.data.name === 'string' ? request.data.name.trim() : '';
    const phone =
      typeof request.data.phone === 'string' && request.data.phone.trim()
        ? request.data.phone.trim()
        : undefined;
    if (!eventId) throw new HttpsError('invalid-argument', 'eventId requerido.');
    if (!name) throw new HttpsError('invalid-argument', 'name requerido.');

    const uid = auth.uid;
    const eventRef = eventDoc(db, eventId);
    const regsCol = eventRegistrationsCollection(db, eventId);

    return db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      const eventData = eventSnap.data();
      if (!eventData) throw new HttpsError('not-found', 'El evento no existe.');

      // Authorize: event-org member OR village admin OR app admin.
      const [orgMemberSnap, villageMemberSnap, appAdminSnap] = await Promise.all([
        tx.get(organizationMemberDoc(db, eventData.organizationId, uid)),
        tx.get(municipalityMemberDoc(db, eventData.municipalityId, uid)),
        tx.get(adminDoc(db, uid)),
      ]);
      const isOrganizer =
        orgMemberSnap.exists ||
        appAdminSnap.exists ||
        (villageMemberSnap.exists && villageMemberSnap.data()?.role === 'admin');
      if (!isOrganizer) {
        throw new HttpsError('permission-denied', 'Solo un organizador puede añadir asistentes.');
      }

      const [confirmedSnap, totalSnap] = await Promise.all([
        tx.get(regsCol.where('status', '==', 'confirmed')),
        tx.get(regsCol),
      ]);
      const [{ status, position }] = computeStatuses({
        maxAttendees: eventData.maxAttendees,
        existingConfirmedCount: confirmedSnap.size,
        existingTotalCount: totalSnap.size,
        newCount: 1,
      });

      const newRef = regsCol.doc();
      const reg: RegistrationData = {
        userId: '',
        personId: '',
        name,
        status,
        position,
        isMember: false,
        registeredAt: new Date(),
        checkedInAt: null,
      };
      tx.set(newRef, reg);
      if (phone) {
        tx.set(eventRegistrationContactDoc(db, eventId, newRef.id), {
          phone,
          name,
        });
      }
      tx.update(eventRef, {
        confirmedCount: confirmedSnap.size + (status === 'confirmed' ? 1 : 0),
        totalCount: totalSnap.size + 1,
      });

      logger.info('Walk-in registration added', {
        handler: 'addWalkInRegistration',
        eventId,
        uid,
        status,
      });

      return { registration: { id: newRef.id, status, position } };
    });
  },
);
