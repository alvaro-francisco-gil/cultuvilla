import { z } from 'zod';
import { ProfileAnswersSchema } from './CensoTypes';

export const VillageMemberRoleSchema = z.enum(['admin', 'user']);
export type VillageMemberRole = z.infer<typeof VillageMemberRoleSchema>;

/**
 * A member of the community living on a municipality.
 * Stored at /municipalities/{municipalityId}/members/{userId}.
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
  // Residence barrio within this municipality. null = "Todo el pueblo" (whole
  // village). Source of truth for an account-holder's barrio; a Cloud Function
  // trigger (syncMemberBarrioToResidence) projects it into the linked person's
  // `municipalityLinks` entry so `getPersonsByBarrio` keeps working. Defaults
  // to null so member docs written before this field existed still parse on
  // read (the converter strict-parses) — no backfill race.
  barrioId: z.string().nullable().default(null),
});
export type VillageMemberData = z.infer<typeof VillageMemberDataSchema>;

export interface VillageMemberDataInput {
  userId: string;
  role?: VillageMemberRole;
  joinedAt?: Date;
  profileAnswers?: z.infer<typeof ProfileAnswersSchema>;
  profileCompletedAt?: Date | null;
  trustedNewsAuthor?: boolean;
  barrioId?: string | null;
}

export function buildVillageMemberData(input: VillageMemberDataInput): VillageMemberData {
  return {
    userId: input.userId,
    role: input.role ?? 'user',
    joinedAt: input.joinedAt ?? new Date(),
    profileAnswers: input.profileAnswers ?? {},
    profileCompletedAt: input.profileCompletedAt ?? null,
    trustedNewsAuthor: input.trustedNewsAuthor ?? false,
    barrioId: input.barrioId ?? null,
  };
}
