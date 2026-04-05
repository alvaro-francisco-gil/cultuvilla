import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseApp";
import type { EventData as Event } from "../models/event/EventDataModel";

const EVENTS_COLLECTION = "events";

export async function createEvent(
  event: Omit<Event, "createdAt" | "updatedAt">
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
    ...event,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function getEvent(id: string): Promise<Event | null> {
  const docRef = doc(db, EVENTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as unknown as Event;
}

export async function getEvents(): Promise<Event[]> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    orderBy("date", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as unknown as Event);
}

export async function updateEvent(
  id: string,
  data: Partial<Omit<Event, "createdAt">>
): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, id);
  await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteEvent(id: string): Promise<void> {
  const docRef = doc(db, EVENTS_COLLECTION, id);
  await deleteDoc(docRef);
}
