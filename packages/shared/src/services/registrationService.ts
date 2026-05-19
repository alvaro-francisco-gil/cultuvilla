import {
  collection, doc, getDocs, deleteDoc, query, orderBy, where,
  Timestamp, collectionGroup, getCountFromServer,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDb, getFirebaseFunctions } from '../firebase'
import type { RegistrationData, RegistrationStatus } from '../models/event/RegistrationDataModel'

export interface RegisterInput {
  personId: string
  name: string
}

export interface RegistrationSummary {
  id: string
  status: RegistrationStatus
  position: number
  isMember: boolean
}

function regsCol(eventId: string) {
  return collection(getDb(), 'events', eventId, 'registrations')
}

function mapRegDoc(d: { id: string; data: () => Record<string, unknown> }): RegistrationData & { id: string } {
  const data = d.data()
  const isMember = typeof data['isMember'] === 'boolean' ? (data['isMember'] as boolean) : undefined
  return {
    id: d.id,
    userId: data['userId'] as string,
    personId: data['personId'] as string,
    name: data['name'] as string,
    status: data['status'] as RegistrationStatus,
    position: data['position'] as number,
    registeredAt: (data['registeredAt'] as Timestamp).toDate(),
    isMember,
  }
}

// Kept for callers that want a quick local prediction (e.g., showing "se irá a
// lista de espera" hints in the sign-up modal). The actual confirmed/waitlisted
// decision is made by the `registerToEvent` Cloud Function in a transaction.
export function determineRegistrationStatus(
  maxAttendees: number | null,
  currentConfirmedCount: number
): RegistrationStatus {
  if (maxAttendees === null) return 'confirmed'
  return currentConfirmedCount < maxAttendees ? 'confirmed' : 'waitlisted'
}

export async function getEventRegistrations(eventId: string): Promise<(RegistrationData & { id: string })[]> {
  const q = query(regsCol(eventId), orderBy('position', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => mapRegDoc(d as Parameters<typeof mapRegDoc>[0]))
}

export async function getConfirmedCount(eventId: string): Promise<number> {
  const q = query(regsCol(eventId), where('status', '==', 'confirmed'))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

export async function getTotalCount(eventId: string): Promise<number> {
  const snap = await getCountFromServer(regsCol(eventId))
  return snap.data().count
}

export async function getUserRegistrations(eventId: string, userId: string): Promise<(RegistrationData & { id: string })[]> {
  const q = query(regsCol(eventId), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => mapRegDoc(d as Parameters<typeof mapRegDoc>[0]))
}

interface RegisterToEventCallableData {
  eventId: string
  registrants: RegisterInput[]
}

interface RegisterToEventCallableResult {
  registrations: RegistrationSummary[]
}

export async function registerToEvent(
  eventId: string,
  registrants: RegisterInput[],
): Promise<RegistrationSummary[]> {
  const callable = httpsCallable<RegisterToEventCallableData, RegisterToEventCallableResult>(
    getFirebaseFunctions(),
    'registerToEvent',
  )
  const res = await callable({ eventId, registrants })
  return res.data.registrations
}

export async function cancelRegistration(eventId: string, regId: string): Promise<void> {
  await deleteDoc(doc(regsCol(eventId), regId))
}

export async function getUserRegistrationsAcrossEvents(
  userId: string
): Promise<(RegistrationData & { id: string; eventPath: string })[]> {
  const q = query(
    collectionGroup(getDb(), 'registrations'),
    where('userId', '==', userId),
    orderBy('registeredAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    const pathSegments = d.ref.path.split('/')
    const eventPath = pathSegments.slice(0, 2).join('/')
    const isMember = typeof data['isMember'] === 'boolean' ? (data['isMember'] as boolean) : undefined
    return {
      id: d.id,
      userId: data['userId'] as string,
      personId: data['personId'] as string,
      name: data['name'] as string,
      status: data['status'] as RegistrationStatus,
      position: data['position'] as number,
      registeredAt: (data['registeredAt'] as Timestamp).toDate(),
      isMember,
      eventPath,
    }
  })
}
