import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { membershipEventsCollection } from '@cultuvilla/shared/firebase/refs/admin';
import { buildMembershipEventData, type MembershipEventDataInput } from '@cultuvilla/shared';

/**
 * Append one membership/role audit event inside an existing transaction.
 *
 * Every server-side membership mutation (role change, organizer grant, seeded
 * member on approval, removal) routes its record through here so the
 * `membershipEvents` log stays the single source of truth. The event is written
 * in the SAME transaction as the mutation it records — the two commit together
 * or not at all.
 *
 * Uses `new Date()` (the function's server clock) rather than
 * `FieldValue.serverTimestamp()`: the record goes through the typed converter,
 * whose strict `schema.parse` rejects the sentinel on `set()`. Server time is
 * trustworthy here because only server code reaches this helper.
 */
export function writeMembershipEvent(
  tx: Transaction,
  db: Firestore,
  input: MembershipEventDataInput,
): void {
  const ref = membershipEventsCollection(db).doc();
  tx.set(ref, buildMembershipEventData(input));
}
