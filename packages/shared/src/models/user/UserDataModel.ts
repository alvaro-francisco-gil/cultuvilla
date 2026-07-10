import { z } from 'zod';

/**
 * The Terms of Use + Privacy Policy version a new acceptance is stamped with.
 * Single source of truth — never inline the literal. Bump on a substantive
 * legal change (and plan a re-prompt for stale-version users at that point).
 */
export const CURRENT_TERMS_VERSION = '1.0';

/**
 * Minimum age to register one's OWN account, per the Terms of Use (Spanish
 * LOPDGDD art. 7). Family "personas" have no age floor — an adult registers
 * them — so this gates only the self-profile at onboarding, not PersonForm at large.
 */
export const MIN_SELF_REGISTRATION_AGE = 14;

/**
 * The account doc. The linked `persons/{personId}` is the **profile of record**
 * (name, birthday, biography, photo, places, occupations); the user doc holds
 * only account state plus a denormalized `displayName` projection so name
 * rendering doesn't need a persons JOIN. Read birthday/biography/photoURL from
 * the linked person, never from here. See
 * docs/architecture/denormalized-read-models.md.
 */
export const UserDataSchema = z.object({
  // Denormalized from persons/{personId} — kept in sync by
  // functions/src/users/syncPersonDenormalization.ts. Clients cannot write this
  // directly (firestore.rules), and createUserProfile omits it, so the doc has
  // no displayName field until that async trigger lands. `.default('')` makes a
  // read during that window degrade to "" instead of throwing in the converter.
  displayName: z.string().default(''),
  email: z.string(),
  telephone: z.string().nullable(),
  activeMunicipalityId: z.string().nullable(),
  personId: z.string().nullable(),
  createdAt: z.date(),
  // Legal acceptance captured at onboarding. Required: every account created
  // after this feature carries it, and existing docs are backfilled — so a
  // missing field is a data bug the strict converter should surface, not
  // silently tolerate.
  termsAcceptedAt: z.date(),
  termsVersion: z.string(),
});
export type UserData = z.infer<typeof UserDataSchema>;

export interface UserDataInput {
  displayName: string;
  email: string;
  telephone?: string | null;
  activeMunicipalityId?: string | null;
  personId?: string | null;
  createdAt?: Date;
  termsAcceptedAt?: Date | null;
  termsVersion?: string;
}

export function buildUserData(input: UserDataInput): UserData {
  return {
    displayName: input.displayName,
    email: input.email,
    telephone: input.telephone ?? null,
    activeMunicipalityId: input.activeMunicipalityId ?? null,
    personId: input.personId ?? null,
    createdAt: input.createdAt ?? new Date(),
    termsAcceptedAt: input.termsAcceptedAt ?? new Date(),
    termsVersion: input.termsVersion ?? CURRENT_TERMS_VERSION,
  };
}
