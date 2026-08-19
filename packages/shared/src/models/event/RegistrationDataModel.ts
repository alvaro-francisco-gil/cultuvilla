// packages/shared/src/models/event/RegistrationDataModel.ts
import { z } from 'zod';

export const RegistrationStatusSchema = z.enum(['confirmed', 'waitlisted']);
export type RegistrationStatus = z.infer<typeof RegistrationStatusSchema>;

export const RegistrationDataSchema = z.object({
  userId: z.string(),
  personId: z.string(),
  name: z.string(),
  status: RegistrationStatusSchema,
  position: z.number().int(),
  registeredAt: z.date(),
  // Denormalized at write time by the `registerToEvent` Cloud Function so UIs
  // showing village-vs-visitor badges don't need a per-attendee membership
  // lookup.
  isMember: z.boolean(),
  // Set by an organizer when the attendee is checked in. `null` until then.
  checkedInAt: z.date().nullable(),
  // Set by an organizer when the attendee has paid (events with
  // requiresPayment). `.default(null)`: registrations created before this field
  // existed have no paidAt key, so reads normalize the absent field to null
  // instead of throwing the strict converter.
  paidAt: z.date().nullable().default(null),
  // ── Denormalized from persons/{personId} at write time ──────────────────
  // The roster is readable by the whole pueblo (see firestore.rules), so it
  // must render without a per-row read of `persons` — that fan-out used to be
  // paid by one organizer and would now be paid by every viewer.
  // These are a point-in-time copy: a later photo or name change does NOT
  // rewrite past registrations, which is fine for a roster (it records who
  // signed up, as they were then). `.default()` on each so registrations
  // written before this field parse instead of throwing the strict converter
  // (existing dev docs are backfilled in this same change).
  photoURL: z.string().nullable().default(null),
  // The attendee's OWN account, when the person is an account holder — not
  // `userId`, which is whoever did the signing up (a parent registering a
  // child carries the parent's uid there). Drives which profile a row opens.
  personUserId: z.string().nullable().default(null),
  // Mirrors persons.isPublic. A dependent persona marked private is COUNTED
  // but not named on the public roster — the person doc is already denied to
  // everyone but its creator, and the roster must not re-publish the name it
  // is hiding (typically a child's). Organizers always see the real name.
  isPersonPublic: z.boolean().default(true),
  // ── Group sign-up (events with signupGroupSize > 1) ─────────────────────
  // The seats booked together. `null` on every individual registration, which
  // is what an event with signupGroupSize 1 produces — so ordinary sign-up is
  // untouched by any of this. Seats sharing a groupId are seated atomically
  // and cancelled together.
  groupId: z.string().nullable().default(null),
  // Who created the group and stays accountable for its unclaimed seats. On
  // the creator's own seats this equals `userId`; on a seat someone claimed
  // through an invite link `userId` becomes the claimer and this still points
  // at the creator, which is how cancellation tells "the group is leaving"
  // apart from "one guest dropped out".
  groupOwnerId: z.string().nullable().default(null),
  // A held-but-unfilled seat, awaiting a claim. It is a real registration —
  // it occupies capacity and is paid for by the group owner from the moment
  // it is created — carrying a placeholder name and no person. The claim
  // token is NOT here: this doc is world-readable, so the secret lives in the
  // organizer-and-owner-gated `seatTokens` subcollection.
  isOpenSeat: z.boolean().default(false),
});
export type RegistrationData = z.infer<typeof RegistrationDataSchema>;

export interface RegistrationDataInput {
  userId: string;
  personId: string;
  name: string;
  status: RegistrationStatus;
  position: number;
  registeredAt?: Date;
  isMember?: boolean;
  checkedInAt?: Date | null;
  paidAt?: Date | null;
  photoURL?: string | null;
  personUserId?: string | null;
  isPersonPublic?: boolean;
  groupId?: string | null;
  groupOwnerId?: string | null;
  isOpenSeat?: boolean;
}

export function buildRegistrationData(input: RegistrationDataInput): RegistrationData {
  return {
    ...input,
    registeredAt: input.registeredAt ?? new Date(),
    isMember: input.isMember ?? false,
    checkedInAt: input.checkedInAt ?? null,
    paidAt: input.paidAt ?? null,
    photoURL: input.photoURL ?? null,
    personUserId: input.personUserId ?? null,
    isPersonPublic: input.isPersonPublic ?? true,
    groupId: input.groupId ?? null,
    groupOwnerId: input.groupOwnerId ?? null,
    isOpenSeat: input.isOpenSeat ?? false,
  };
}

/** The placeholder shown on the roster for a seat nobody has claimed yet. */
export const OPEN_SEAT_NAME = 'Plaza libre';
