import { describe, it, expect } from 'vitest';
import {
  buildInviteTokenData,
  isTokenExpired,
} from '../../src/models/municipality/InviteTokenDataModel';

describe('buildInviteTokenData', () => {
  it('defaults expiresAt to null, usageCount to 0, createdAt to Date', () => {
    const t = buildInviteTokenData();
    expect(t.expiresAt).toBeNull();
    expect(t.usageCount).toBe(0);
    expect(t.createdAt).toBeInstanceOf(Date);
  });

  it('preserves provided fields', () => {
    const created = new Date('2026-01-01');
    const expires = new Date('2026-12-31');
    const t = buildInviteTokenData({
      createdAt: created,
      expiresAt: expires,
      usageCount: 3,
    });
    expect(t.createdAt).toEqual(created);
    expect(t.expiresAt).toEqual(expires);
    expect(t.usageCount).toBe(3);
  });
});

describe('isTokenExpired', () => {
  it('returns false when expiresAt is null (never expires)', () => {
    expect(
      isTokenExpired({ createdAt: new Date(), expiresAt: null, usageCount: 0 }),
    ).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 1000);
    expect(
      isTokenExpired({ createdAt: new Date(), expiresAt: past, usageCount: 0 }),
    ).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(
      isTokenExpired({ createdAt: new Date(), expiresAt: future, usageCount: 0 }),
    ).toBe(false);
  });
});
