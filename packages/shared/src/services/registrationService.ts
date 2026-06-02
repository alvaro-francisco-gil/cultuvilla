import {
  getDocs,
  deleteDoc,
  query,
  orderBy,
  where,
  collectionGroup,
  getCountFromServer,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDb, getFirebaseFunctions } from '../firebase';
import {
  eventRegistrationsCollection,
  eventRegistrationDoc,
} from '../firebase/refs/client';
import { registrationConverterClient } from '../firebase/converters/registrationConverter';
import type {
  RegistrationData,
  RegistrationStatus,
} from '../models/event/RegistrationDataModel';

export interface RegisterInput {
  personId: string;
  name: string;
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
