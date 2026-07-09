import { z } from 'zod';

export const OrgMemberRoleSchema = z.enum(['admin', 'member']);
export type OrgMemberRole = z.infer<typeof OrgMemberRoleSchema>;

/**
 * A member of an organization (peña/asociación/ayuntamiento).
 * Stored at /organizations/{orgId}/members/{userId}.
 */
export const OrgMemberDataSchema = z.object({
  // Denormalized so collection-group reverse lookups can filter by user.
  // Same value as the doc id (organizations/{orgId}/members/{userId}).
  userId: z.string(),
  joinedAt: z.date(),
  role: OrgMemberRoleSchema,
});
export type OrgMemberData = z.infer<typeof OrgMemberDataSchema>;

export interface OrgMemberDataInput {
  userId: string;
  joinedAt?: Date;
  role?: OrgMemberRole;
}

export function buildOrgMemberData(input: OrgMemberDataInput): OrgMemberData {
  return {
    userId: input.userId,
    joinedAt: input.joinedAt ?? new Date(),
    role: input.role ?? 'member',
  };
}
