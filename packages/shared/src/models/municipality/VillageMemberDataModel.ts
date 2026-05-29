import { z } from 'zod';
import { ProfileAnswersSchema } from './CensoTypes';

export const VillageMemberRoleSchema = z.enum(['admin', 'user']);
export type VillageMemberRole = z.infer<typeof VillageMemberRoleSchema>;

/**
 * A member of the community living on a municipality.
 * Stored at /municipalities/{municipalityId}/members/{userId}.
 */
export const VillageMemberDataSchema = z.object({
  role: VillageMemberRoleSchema,
  joinedAt: z.date(),
  profileAnswers: ProfileAnswersSchema,
  profileCompletedAt: z.date().nullable(),
  trustedNewsAuthor: z.boolean(),
});
export type VillageMemberData = z.infer<typeof VillageMemberDataSchema>;

export interface VillageMemberDataInput {
  role?: VillageMemberRole;
  joinedAt?: Date;
  profileAnswers?: z.infer<typeof ProfileAnswersSchema>;
  profileCompletedAt?: Date | null;
  trustedNewsAuthor?: boolean;
}

export function buildVillageMemberData(input: VillageMemberDataInput = {}): VillageMemberData {
  return {
    role: input.role ?? 'user',
    joinedAt: input.joinedAt ?? new Date(),
    profileAnswers: input.profileAnswers ?? {},
    profileCompletedAt: input.profileCompletedAt ?? null,
    trustedNewsAuthor: input.trustedNewsAuthor ?? false,
  };
}
