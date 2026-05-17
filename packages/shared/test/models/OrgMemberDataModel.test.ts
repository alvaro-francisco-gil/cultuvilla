import { describe, it, expect } from 'vitest';
import { buildOrgMemberData } from '../../src/models/organization/OrgMemberDataModel';

describe('buildOrgMemberData', () => {
  it('defaults joinedAt to now', () => {
    const m = buildOrgMemberData();
    expect(m.joinedAt).toBeInstanceOf(Date);
  });

  it('preserves provided joinedAt', () => {
    const t = new Date('2026-03-15');
    const m = buildOrgMemberData({ joinedAt: t });
    expect(m.joinedAt).toEqual(t);
  });
});
