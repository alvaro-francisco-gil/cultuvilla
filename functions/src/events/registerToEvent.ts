import { logger } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  eventDoc,
  eventRegistrationsCollection,
  eventRegistrationPrivateDoc,
  municipalityMemberDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import type { RegistrationData, SignupAnswers } from '@cultuvilla/shared/models';
import { validateSignupAnswers } from '@cultuvilla/shared/models';
import {
  computeStatuses,
  validateRegisterInput,
  type RegisterToEventData,
} from '../helpers/registerToEventValidation';
import { RESEND_API_KEY } from '../auth/secret';
import { sendRegistrationEmail } from './sendRegistrationEmail';
import type { RegistrationEmailAttendee } from './registrationEmailTemplate';

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
  { region: 'us-central1', cors: true, secrets: [RESEND_API_KEY] },
  async (request) => {
    const auth = request.auth;
    if (!auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    const { eventId, registrants } = validateRegisterInput(request.data);
    const userId = auth.uid;

    const eventRef = eventDoc(db, eventId);
    const regsCol = eventRegistrationsCollection(db, eventId);

    const committed = await db.runTransaction(async (tx) => {
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
        tx.get(municipalityMemberDoc(db, municipalityId, userId)),
      ]);

      const isMember = memberSnap.exists;

      // Semantic answer validation needs the event's field specs, so it can
      // only happen here (the input validator runs before the event is read).
      // Client-side gating in AttendeeSheet is convenience; this is the gate.
      const signupFields = eventData.signupFields;
      const validatedAnswers: SignupAnswers[] = registrants.map((registrant) => {
        const result = validateSignupAnswers(signupFields, registrant.answers);
        if (!result.ok) {
          logger.info('Rejected sign-up answers', {
            handler: 'registerToEvent',
            eventId,
            userId,
            fieldId: result.fieldId,
            reason: result.reason,
          });
          throw new HttpsError(
            'invalid-argument',
            'Faltan respuestas obligatorias o alguna no es válida.',
          );
        }
        return result.value;
      });

      const statuses = computeStatuses({
        maxAttendees,
        existingConfirmedCount: confirmedSnap.size,
        existingTotalCount: totalSnap.size,
        newCount: registrants.length,
      });

      const summaries: RegistrationSummary[] = [];
      const attendees: RegistrationEmailAttendee[] = [];
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
          checkedInAt: null,
          paidAt: null,
        };
        tx.set(newRef, reg);
        // Phone (when telephoneRequired) and custom field answers land in a
        // separately-gated subcollection, never on the public registration doc.
        // Keyed by reg id. Written only when there is something to store.
        const answers = validatedAnswers[i] ?? {};
        if (registrant.phone || Object.keys(answers).length > 0) {
          tx.set(eventRegistrationPrivateDoc(db, eventId, newRef.id), {
            name: registrant.name,
            phone: registrant.phone ?? null,
            answers,
          });
        }
        summaries.push({ id: newRef.id, status, position, isMember });
        attendees.push({ name: registrant.name, status, position });
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

      return {
        registrations: summaries,
        attendees,
        event: eventData,
        confirmedCount: confirmedSnap.size + newConfirmed,
      };
    });

    // Deliberately outside the transaction: Firestore retries the callback on
    // contention, and a send inside it would go out once per retry. Failures
    // are swallowed and logged by sendRegistrationEmail — a bounced email must
    // not undo a completed registration.
    await sendRegistrationEmail({
      userId,
      eventId,
      event: committed.event,
      attendees: committed.attendees,
      confirmedCount: committed.confirmedCount,
      kind: 'registration',
    });

    return { registrations: committed.registrations };
  },
);
