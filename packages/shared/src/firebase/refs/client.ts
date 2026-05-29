// packages/shared/src/firebase/refs/client.ts
import { collection, doc, type Firestore } from 'firebase/firestore';
import { eventConverterClient } from '../converters/eventConverter';
import { registrationConverterClient } from '../converters/registrationConverter';

export const eventsCollection = (db: Firestore) =>
  collection(db, 'events').withConverter(eventConverterClient);

export const eventDoc = (db: Firestore, eventId: string) =>
  doc(db, 'events', eventId).withConverter(eventConverterClient);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  collection(db, 'events', eventId, 'registrations').withConverter(registrationConverterClient);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  doc(db, 'events', eventId, 'registrations', registrationId).withConverter(registrationConverterClient);
