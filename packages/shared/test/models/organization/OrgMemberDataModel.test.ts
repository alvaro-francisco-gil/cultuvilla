import { describe, it, expect } from 'vitest';
import {
  OrgMemberDataSchema,
  buildOrgMemberData,
} from '../../../src/models/organization/OrgMemberDataModel';

describe('OrgMemberDataSchema', () => {
  it('parses a valid member doc', () => {
    expect(() =>
      OrgMemberDataSchema.parse({
        userId: 'u-1',
        joinedAt: new Date('2026-03-15T00:00:00Z'),
        role: 'member',
      }),
    ).not.toThrow();
  });

  it('rejects when role is missing', () => {
    expect(() =>
      OrgMemberDataSchema.parse({ userId: 'u-1', joinedAt: new Date('2026-03-15T00:00:00Z') }),
    ).toThrow();
  });

  it('rejects when joinedAt is missing', () => {
    expect(() => OrgMemberDataSchema.parse({ userId: 'u-1', role: 'member' })).toThrow();
  });

  it('rejects when joinedAt is not a Date', () => {
    expect(() =>
      OrgMemberDataSchema.parse({ userId: 'u-1', joinedAt: '2026-03-15', role: 'member' }),
    ).toThrow();
  });

  it('rejects when userId is missing', () => {
    expect(() =>
      OrgMemberDataSchema.parse({ joinedAt: new Date('2026-03-15T00:00:00Z'), role: 'member' }),
    ).toThrow();
  });
});

describe('buildOrgMemberData', () => {
  it('defaults joinedAt to now and preserves provided value', () => {
    const now = buildOrgMemberData({ userId: 'u-1' });
    expect(now.joinedAt).toBeInstanceOf(Date);

    const t = new Date('2026-03-15');
    const m = buildOrgMemberData({ userId: 'u-1', joinedAt: t });
    expect(m.joinedAt).toEqual(t);
  });
});
