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
  };
}
