import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  collectionGroup,
  getCountFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  eventRegistrationsCollection,
  eventRegistrationDoc,
  eventRegistrationContactDoc,
} from '../firebase/refs/client';
import { registrationConverterClient } from '../firebase/converters/registrationConverter.client';
import type {
  RegistrationData,
  RegistrationStatus,
} from '../models/event/RegistrationDataModel';

export interface RegisterInput {
  personId: string;
  name: string;
  /** Collected when the event has `telephoneRequired`; stored in the
   * organizer-only registrationContacts subcollection, never on the public
   * registration doc. */
  phone?: string;
}

export interface RegistrationSummary {
  id: string;
  status: RegistrationStatus;
  position: number;
  isMember: boolean;
}

// Kept for callers that want a quick local prediction (e.g., showing "se irá a
// lista de espera" hints in the sign-up modal). The actual confirmed/waitlisted
// decision is made by the `registerToEvent` Cloud Function in a transaction.
export function determineRegistrationStatus(
  maxAttendees: number | null,
  currentConfirmedCount: number,
): RegistrationStatus {
  if (maxAttendees === null) return 'confirmed';
  return currentConfirmedCount < maxAttendees ? 'confirmed' : 'waitlisted';
}

export async function getEventRegistrations(
  eventId: string,
): Promise<(RegistrationData & { id: string })[]> {
  const q = query(eventRegistrationsCollection(getDb(), eventId), orderBy('position', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getConfirmedCount(eventId: string): Promise<number> {
  const q = query(eventRegistrationsCollection(getDb(), eventId), where('status', '==', 'confirmed'));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function getTotalCount(eventId: string): Promise<number> {
  const snap = await getCountFromServer(eventRegistrationsCollection(getDb(), eventId));
  return snap.data().count;
}

export async function getUserRegistrations(
  eventId: string,
  userId: string,
): Promise<(RegistrationData & { id: string })[]> {
  const q = query(eventRegistrationsCollection(getDb(), eventId), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

interface RegisterToEventCallableData {
  eventId: string;
  registrants: RegisterInput[];
}

interface RegisterToEventCallableResult {
  registrations: RegistrationSummary[];
}

export async function registerToEvent(
  eventId: string,
  registrants: RegisterInput[],
): Promise<RegistrationSummary[]> {
  const callable = httpsCallable<RegisterToEventCallableData, RegisterToEventCallableResult>(
    getFirebaseFunctions(),
    'registerToEvent',
  );
  const res = await callable({ eventId, registrants });
  return res.data.registrations;
}

export async function cancelRegistration(eventId: string, regId: string): Promise<void> {
  await deleteDoc(eventRegistrationDoc(getDb(), eventId, regId));
}

// Organizer toggles attendance. updateDoc bypasses the converter, so the
// serverTimestamp() sentinel is fine. Gated by firestore.rules (event organizer).
export async function setRegistrationCheckIn(
  eventId: string,
  regId: string,
  checkedIn: boolean,
): Promise<void> {
  // Converter-less ref: updateDoc on the typed (converter-wrapped) ref rejects
  // the serverTimestamp()/null union. The raw path write is fine here.
  await updateDoc(doc(getDb(), 'events', eventId, 'registrations', regId), {
    checkedInAt: checkedIn ? serverTimestamp() : null,
  });
}

// Organizer marks/unmarks an attendee as paid (events with requiresPayment).
// updateDoc bypasses the converter, so the serverTimestamp()/null union is fine
// on the raw path ref. Gated by firestore.rules: any write touching paidAt
// requires the event organizer.
export async function setRegistrationPaid(
  eventId: string,
  regId: string,
  paid: boolean,
): Promise<void> {
  await updateDoc(doc(getDb(), 'events', eventId, 'registrations', regId), {
    paidAt: paid ? serverTimestamp() : null,
  });
}

interface AddWalkInCallableData {
  eventId: string;
  name: string;
  phone?: string;
}
interface AddWalkInCallableResult {
  registration: RegistrationSummary;
}

// Organizer adds an attendee who isn't a registered user (walk-in). Goes
// through a callable so the same capacity/waitlist logic and counter updates
// apply; the registration carries an empty userId/personId.
export async function addWalkInRegistration(
  eventId: string,
  name: string,
  phone?: string,
): Promise<RegistrationSummary> {
  const callable = httpsCallable<AddWalkInCallableData, AddWalkInCallableResult>(
    getFirebaseFunctions(),
    'addWalkInRegistration',
  );
  const res = await callable({ eventId, name, phone });
  return res.data.registration;
}

// Organizer-only read of a registrant's phone (the registration doc itself is
// public, so the phone lives in a separately-gated subcollection).
export async function getRegistrationPhone(eventId: string, regId: string): Promise<string | null> {
  const snap = await getDoc(eventRegistrationContactDoc(getDb(), eventId, regId));
  return snap.exists() ? ((snap.data() as { phone?: string }).phone ?? null) : null;
}

export async function getUserRegistrationsAcrossEvents(
  userId: string,
): Promise<(RegistrationData & { id: string; eventPath: string })[]> {
  // collectionGroup doesn't carry the per-collection converter from the ref
  // factory, so we attach it explicitly here.
  const cg = collectionGroup(getDb(), 'registrations').withConverter(registrationConverterClient);
  const q = query(
    cg,
    where('userId', '==', userId),
    orderBy('registeredAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const pathSegments = d.ref.path.split('/');
    const eventPath = pathSegments.slice(0, 2).join('/');
    return { id: d.id, ...d.data(), eventPath };
  });
}
