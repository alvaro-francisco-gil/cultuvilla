import { z } from 'zod';

export const OrgMemberRoleSchema = z.enum(['admin', 'member']);
export type OrgMemberRole = z.infer<typeof OrgMemberRoleSchema>;

export const OrgMemberDataSchema = z.object({
  joinedAt: z.date(),
  role: OrgMemberRoleSchema,
});
export type OrgMemberData = z.infer<typeof OrgMemberDataSchema>;

export interface OrgMemberDataInput {
  joinedAt?: Date;
  role?: OrgMemberRole;
}

export function buildOrgMemberData(input: OrgMemberDataInput = {}): OrgMemberData {
  return {
    joinedAt: input.joinedAt ?? new Date(),
    role: input.role ?? 'member',
  };
}
