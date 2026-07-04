import { describe, it, expect } from 'vitest';
import {
  MembershipEventDataSchema,
  buildMembershipEventData,
} from '../../../src/models/membership/MembershipEventDataModel';

describe('MembershipEventData', () => {
  const base = {
    scopeType: 'village' as const,
    scopeId: 'muni-1',
    municipalityId: 'muni-1',
    actorUserId: 'admin-1',
    targetUserId: 'user-1',
    action: 'role_changed' as const,
    fromRole: 'user',
    toRole: 'admin',
  };

  it('builds a valid event and round-trips through the schema', () => {
    const e = buildMembershipEventData(base);
    expect(() => MembershipEventDataSchema.parse(e)).not.toThrow();
    expect(e.action).toBe('role_changed');
    expect(e.at).toBeInstanceOf(Date);
  });

  it('defaults fromRole/toRole to null and stamps `at`', () => {
    const e = buildMembershipEventData({
      scopeType: 'org',
      scopeId: 'org-1',
      municipalityId: 'muni-1',
      actorUserId: 'a',
      targetUserId: 't',
      action: 'added',
    });
    expect(e.fromRole).toBeNull();
    expect(e.toRole).toBeNull();
    expect(e.at).toBeInstanceOf(Date);
  });

  it('rejects an unknown action', () => {
    const result = MembershipEventDataSchema.safeParse({ ...base, action: 'nuked', at: new Date() });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown scopeType', () => {
    const result = MembershipEventDataSchema.safeParse({ ...base, scopeType: 'planet', at: new Date() });
    expect(result.success).toBe(false);
  });
});
