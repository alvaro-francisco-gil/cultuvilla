import { describe, it, expect } from 'vitest';
import {
  OrgMemberDataSchema,
  buildOrgMemberData,
} from '../../../src/models/organization/OrgMemberDataModel';

describe('OrgMemberDataSchema', () => {
  it('parses a valid member doc', () => {
    expect(() =>
      OrgMemberDataSchema.parse({ joinedAt: new Date('2026-03-15T00:00:00Z') }),
    ).not.toThrow();
  });

  it('rejects when joinedAt is missing', () => {
    expect(() => OrgMemberDataSchema.parse({})).toThrow();
  });

  it('rejects when joinedAt is not a Date', () => {
    expect(() => OrgMemberDataSchema.parse({ joinedAt: '2026-03-15' })).toThrow();
  });
});

describe('buildOrgMemberData', () => {
  it('defaults joinedAt to now and preserves provided value', () => {
    const now = buildOrgMemberData();
    expect(now.joinedAt).toBeInstanceOf(Date);

    const t = new Date('2026-03-15');
    const m = buildOrgMemberData({ joinedAt: t });
    expect(m.joinedAt).toEqual(t);
  });
});
