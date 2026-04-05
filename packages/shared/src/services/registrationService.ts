import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseApp";
import type { RegistrationData as EventRegistration } from "../models/event/RegistrationDataModel";

const REGISTRATIONS_COLLECTION = "registrations";

export async function registerToEvent(
  registration: Omit<EventRegistration, "registeredAt">
): Promise<string> {
  const docRef = await addDoc(collection(db, REGISTRATIONS_COLLECTION), {
    ...registration,
    registeredAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function unregisterFromEvent(
  eventId: string,
  userId: string
): Promise<void> {
  const q = query(
    collection(db, REGISTRATIONS_COLLECTION),
    where("eventId", "==", eventId),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(q);
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, REGISTRATIONS_COLLECTION, docSnap.id));
  }
}

export async function getEventRegistrations(
  eventId: string
): Promise<EventRegistration[]> {
  const q = query(
    collection(db, REGISTRATIONS_COLLECTION),
    where("eventId", "==", eventId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as unknown as EventRegistration
  );
}
