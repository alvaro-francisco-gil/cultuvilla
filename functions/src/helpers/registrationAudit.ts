import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { eventRegistrationEventsCollection } from '@cultuvilla/shared/firebase/refs/admin';
// Import from the /models subpath, NOT the '@cultuvilla/shared' barrel: the
// barrel transitively pulls react-native into the functions esbuild bundle
// (Flow syntax esbuild can't parse). Subpath imports keep the bundle clean.
import {
  buildRegistrationEventData,
  type RegistrationEventDataInput,
} from '@cultuvilla/shared/models';

/**
 * Append one roster audit entry inside an existing transaction.
 *
 * Every server-side change to who is on an event's roster routes its record
 * through here, so `events/{eventId}/registrationEvents` stays the single
 * answer to "what happened to this roster". The entry is written in the SAME
 * transaction as the mutation it records — the two commit together or not at
 * all, which is the only reason the log can be trusted after the registration
 * doc it describes has been deleted.
 *
 * Uses `new Date()` (the function's server clock) rather than
 * `FieldValue.serverTimestamp()`: the record goes through the typed converter,
 * whose strict `schema.parse` rejects the sentinel on `set()`. Server time is
 * trustworthy here because only server code reaches this helper.
 */
export function writeRegistrationEvent(
  tx: Transaction,
  db: Firestore,
  eventId: string,
  input: RegistrationEventDataInput,
): void {
  const ref = eventRegistrationEventsCollection(db, eventId).doc();
  tx.set(ref, buildRegistrationEventData(input));
}

/**
 * Append one roster audit entry outside a transaction, for the waitlist
 * promotion trigger — which promotes with bare `update()` calls and has no
 * transaction to join.
 *
 * `entryId` is mandatory here precisely because there is no transaction:
 * Eventarc delivers at-least-once, so a redelivered promotion must overwrite
 * its entry rather than append a second one. Safe only for actions that can
 * happen at most once per registration (a promotion is terminal — a confirmed
 * seat is never re-waitlisted).
 */
export async function appendRegistrationEvent(
  db: Firestore,
  eventId: string,
  entryId: string,
  input: RegistrationEventDataInput,
): Promise<void> {
  await eventRegistrationEventsCollection(db, eventId)
    .doc(entryId)
    .set(buildRegistrationEventData(input));
}
