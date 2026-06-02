import { z } from 'zod';
import { PartialDateSchema, type PartialDate } from '../person/PersonDataModel';

export const UserDataSchema = z.object({
  // Denormalized from persons/{personId} — kept in sync by
  // functions/src/users/syncPersonDenormalization.ts. The persons doc owns
  // givenName / firstSurname / secondSurname; this field is the
  // buildDisplayName(person) projection. Clients cannot write this directly
  // (firestore.rules), so reads can briefly observe "" for users created
  // before their persona exists.
  displayName: z.string(),
  email: z.string(),
  telephone: z.string().nullable(),
  activeMunicipalityId: z.string().nullable(),
  personId: z.string().nullable(),
  // Denormalized user-display fields written by acceptInvite and the
  // onboarding flow. Always present after acceptInvite, hence nullable but
  // not optional. Old docs lacking these fields will fail strict parse on
  // read — a one-off backfill is tracked as a follow-up.
  birthday: PartialDateSchema.nullable(),
  biography: z.string().nullable(),
  photoURL: z.string().nullable(),
  createdAt: z.date(),
});
export type UserData = z.infer<typeof UserDataSchema>;

export interface UserDataInput {
  displayName: string;
  email: string;
  telephone?: string | null;
  activeMunicipalityId?: string | null;
  personId?: string | null;
  birthday?: PartialDate | null;
  biography?: string | null;
  photoURL?: string | null;
  createdAt?: Date;
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    telephone: input.telephone ?? null,
    activeMunicipalityId: input.activeMunicipalityId ?? null,
    personId: input.personId ?? null,
    birthday: input.birthday ?? null,
    biography: input.biography ?? null,
    photoURL: input.photoURL ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
