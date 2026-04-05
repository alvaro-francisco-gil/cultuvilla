export interface OrgMemberData {
  joinedAt: Date;
}

export interface OrgMemberDataInput {
  joinedAt?: Date;
}

export function buildOrgMemberData(input: OrgMemberDataInput = {}): OrgMemberData {
  return {
    joinedAt: input.joinedAt ?? new Date(),
  };
}
