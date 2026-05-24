import { describe, it, expect } from 'vitest';
import { buildVillageMemberData } from '../../src/models/municipality/VillageMemberDataModel';

describe('buildVillageMemberData', () => {
  it('defaults role to user, empty profileAnswers, profileCompletedAt null', () => {
    const m = buildVillageMemberData();
    expect(m.role).toBe('user');
    expect(m.profileAnswers).toEqual({});
    expect(m.profileCompletedAt).toBeNull();
    expect(m.joinedAt).toBeInstanceOf(Date);
  });

  it('preserves role admin and answers', () => {
    const t = new Date('2026-05-01');
    const m = buildVillageMemberData({
      role: 'admin',
      profileAnswers: { barrio: 'Centro', householdSize: 4 },
      profileCompletedAt: t,
      joinedAt: t,
    });
    expect(m.role).toBe('admin');
    expect(m.profileAnswers).toEqual({ barrio: 'Centro', householdSize: 4 });
    expect(m.profileCompletedAt).toEqual(t);
    expect(m.joinedAt).toEqual(t);
  });

  it('defaults trustedNewsAuthor to false', () => {
    const m = buildVillageMemberData();
    expect(m.trustedNewsAuthor).toBe(false);
  });

  it('passes trustedNewsAuthor through', () => {
    const m = buildVillageMemberData({ trustedNewsAuthor: true });
    expect(m.trustedNewsAuthor).toBe(true);
  });
});
