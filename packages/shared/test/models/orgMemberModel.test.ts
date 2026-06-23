import { describe, it, expect } from 'vitest';
import {
  OrgMemberDataSchema,
  buildOrgMemberData,
} from '../../src/models/organization/OrgMemberDataModel';

describe('OrgMemberDataModel', () => {
  it('defaults role to "member"', () => {
    const m = buildOrgMemberData();
    expect(m.role).toBe('member');
  });

  it('accepts an explicit admin role', () => {
    expect(buildOrgMemberData({ role: 'admin' }).role).toBe('admin');
  });

  it('parses a legacy doc without role as member (default)', () => {
    const parsed = OrgMemberDataSchema.parse({ joinedAt: new Date() });
    expect(parsed.role).toBe('member');
  });

  it('rejects an unknown role', () => {
    expect(() =>
      OrgMemberDataSchema.parse({ joinedAt: new Date(), role: 'owner' }),
    ).toThrow();
  });
});
