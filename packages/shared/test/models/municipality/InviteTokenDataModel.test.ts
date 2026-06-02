import { describe, it, expect } from 'vitest';
import {
  InviteTokenDataSchema,
  buildInviteTokenData,
} from '../../../src/models/municipality/InviteTokenDataModel';

describe('InviteTokenDataSchema', () => {
  it('parses a valid token', () => {
    expect(() =>
      InviteTokenDataSchema.parse({
        createdAt: new Date('2026-01-01T00:00:00Z'),
        expiresAt: null,
        usageCount: 0,
      }),
    ).not.toThrow();
  });

  it('rejects non-integer usageCount', () => {
    expect(() =>
      InviteTokenDataSchema.parse({
        createdAt: new Date(),
        expiresAt: null,
        usageCount: 1.5,
      }),
    ).toThrow();
  });

  it('rejects missing createdAt', () => {
    expect(() =>
      InviteTokenDataSchema.parse({ expiresAt: null, usageCount: 0 }),
    ).toThrow();
  });
});

describe('buildInviteTokenData', () => {
  it('fills defaults and round-trips through the schema', () => {
    const t = buildInviteTokenData();
    expect(t.usageCount).toBe(0);
    expect(t.expiresAt).toBeNull();
    expect(() => InviteTokenDataSchema.parse(t)).not.toThrow();
  });

  it('preserves provided fields', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const expires = new Date('2026-12-31T00:00:00Z');
    const t = buildInviteTokenData({ createdAt: created, expiresAt: expires, usageCount: 3 });
    expect(t.createdAt).toEqual(created);
    expect(t.expiresAt).toEqual(expires);
    expect(t.usageCount).toBe(3);
  });
});
