import { describe, it, expect } from 'vitest';
import {
  VillageMemberDataSchema,
  buildVillageMemberData,
} from '../../../src/models/municipality/VillageMemberDataModel';

const validMember = {
  userId: 'u-1',
  role: 'user' as const,
  joinedAt: new Date('2026-01-01T00:00:00Z'),
  profileAnswers: { barrio: 'Centro', householdSize: 4 },
  profileCompletedAt: null,
  trustedNewsAuthor: false,
  barrioId: null,
};

describe('VillageMemberDataSchema', () => {
  it('parses a valid member', () => {
    expect(() => VillageMemberDataSchema.parse(validMember)).not.toThrow();
  });

  it('rejects an unknown role', () => {
    expect(() =>
      VillageMemberDataSchema.parse({ ...validMember, role: 'moderator' }),
    ).toThrow();
  });

  it('rejects missing trustedNewsAuthor', () => {
    const { trustedNewsAuthor: _trustedNewsAuthor, ...rest } = validMember;
    expect(() => VillageMemberDataSchema.parse(rest)).toThrow();
  });

  it('defaults a missing barrioId to null (pre-backfill docs still parse)', () => {
    const { barrioId: _barrioId, ...rest } = validMember;
    expect(VillageMemberDataSchema.parse(rest).barrioId).toBeNull();
  });
});

describe('buildVillageMemberData', () => {
  it('fills defaults and round-trips through the schema', () => {
    const m = buildVillageMemberData({ userId: 'u-1' });
    expect(m.userId).toBe('u-1');
    expect(m.role).toBe('user');
    expect(m.profileAnswers).toEqual({});
    expect(m.profileCompletedAt).toBeNull();
    expect(m.trustedNewsAuthor).toBe(false);
    expect(m.barrioId).toBeNull();
    expect(() => VillageMemberDataSchema.parse(m)).not.toThrow();
  });

  it('preserves a provided barrioId', () => {
    const m = buildVillageMemberData({ userId: 'u-1', barrioId: 'b-centro' });
    expect(m.barrioId).toBe('b-centro');
    expect(() => VillageMemberDataSchema.parse(m)).not.toThrow();
  });

  it('preserves provided fields', () => {
    const t = new Date('2026-05-01T00:00:00Z');
    const m = buildVillageMemberData({
      userId: 'u-1',
      role: 'admin',
      joinedAt: t,
      profileAnswers: { barrio: 'Centro' },
      profileCompletedAt: t,
      trustedNewsAuthor: true,
    });
    expect(m.role).toBe('admin');
    expect(m.trustedNewsAuthor).toBe(true);
    expect(() => VillageMemberDataSchema.parse(m)).not.toThrow();
  });
});
