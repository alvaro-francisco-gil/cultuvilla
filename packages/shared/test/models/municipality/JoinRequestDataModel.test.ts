import { describe, it, expect } from 'vitest';
import {
  JoinRequestDataSchema,
  buildJoinRequestData,
} from '../../../src/models/municipality/JoinRequestDataModel';

const validRequest = {
  userId: 'u1',
  requestedAt: new Date('2026-01-01T00:00:00Z'),
  status: 'pending' as const,
  message: null,
  reviewedAt: null,
  reviewedBy: null,
};

describe('JoinRequestDataSchema', () => {
  it('parses a valid pending request', () => {
    expect(() => JoinRequestDataSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() =>
      JoinRequestDataSchema.parse({ ...validRequest, status: 'cancelled' }),
    ).toThrow();
  });

  it('rejects a missing userId', () => {
    const { userId, ...rest } = validRequest;
    expect(() => JoinRequestDataSchema.parse(rest)).toThrow();
  });
});

describe('buildJoinRequestData', () => {
  it('initializes status pending, message null, reviewer fields null', () => {
    const r = buildJoinRequestData({ userId: 'u1' });
    expect(r.status).toBe('pending');
    expect(r.message).toBeNull();
    expect(r.reviewedAt).toBeNull();
    expect(r.reviewedBy).toBeNull();
    expect(() => JoinRequestDataSchema.parse(r)).not.toThrow();
  });

  it('preserves provided message', () => {
    const r = buildJoinRequestData({ userId: 'u1', message: 'hola' });
    expect(r.message).toBe('hola');
  });
});
