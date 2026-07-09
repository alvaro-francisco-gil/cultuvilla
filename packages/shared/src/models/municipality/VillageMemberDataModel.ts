import { z } from 'zod';
import { ProfileAnswersSchema } from './CensoTypes';

export const VillageMemberRoleSchema = z.enum(['admin', 'user']);
export type VillageMemberRole = z.infer<typeof VillageMemberRoleSchema>;

/**
 * A member of the community living on a municipality.
 * Stored at /municipalities/{municipalityId}/members/{userId}.
 *
 * Residence barrio is NOT here — it lives solely on the linked person's
 * `persons.municipalityLinks` (the query surface for `getPersonsByBarrio`),
 * written directly by the owner. See docs/decisions/per-village-barrio-membership.md.
 */
export const VillageMemberDataSchema = z.object({
  // Denormalized so collection-group reverse lookups can filter by user.
  // Same value as the doc id (municipalities/{municipalityId}/members/{userId}).
  userId: z.string(),
  role: VillageMemberRoleSchema,
  joinedAt: z.date(),
  profileAnswers: ProfileAnswersSchema,
  profileCompletedAt: z.date().nullable(),
  trustedNewsAuthor: z.boolean(),
});
export type VillageMemberData = z.infer<typeof VillageMemberDataSchema>;

export interface VillageMemberDataInput {
  userId: string;
  role?: VillageMemberRole;
  joinedAt?: Date;
  profileAnswers?: z.infer<typeof ProfileAnswersSchema>;
  profileCompletedAt?: Date | null;
  trustedNewsAuthor?: boolean;
}

export function buildVillageMemberData(input: VillageMemberDataInput): VillageMemberData {
  return {
    userId: input.userId,
    role: input.role ?? 'user',
    joinedAt: input.joinedAt ?? new Date(),
    profileAnswers: input.profileAnswers ?? {},
    profileCompletedAt: input.profileCompletedAt ?? null,
    trustedNewsAuthor: input.trustedNewsAuthor ?? false,
  };
}
