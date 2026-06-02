import { z } from 'zod';

export const OrgMemberDataSchema = z.object({
  joinedAt: z.date(),
});
export type OrgMemberData = z.infer<typeof OrgMemberDataSchema>;

export interface OrgMemberDataInput {
  joinedAt?: Date;
}

export function buildOrgMemberData(input: OrgMemberDataInput = {}): OrgMemberData {
  return {
    joinedAt: input.joinedAt ?? new Date(),
  };
}
