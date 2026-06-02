import { describe, it, expect } from 'vitest';
import {
  OrganizerRequestDataSchema,
  buildOrganizerRequestData,
} from '../../../src/models/municipality/OrganizerRequestDataModel';

const validRequest = {
  userId: 'u1',
  municipalityId: 'm1',
  requestedAt: new Date('2026-01-01T00:00:00Z'),
  status: 'pending' as const,
  motivation: null,
  reviewedAt: null,
  reviewedBy: null,
};

describe('OrganizerRequestDataSchema', () => {
  it('parses a valid pending request', () => {
    expect(() => OrganizerRequestDataSchema.parse(validRequest)).not.toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() =>
      OrganizerRequestDataSchema.parse({ ...validRequest, status: 'cancelled' }),
    ).toThrow();
  });

  it('rejects a missing municipalityId', () => {
    const { municipalityId: _municipalityId, ...rest } = validRequest;
    expect(() => OrganizerRequestDataSchema.parse(rest)).toThrow();
  });
});

describe('buildOrganizerRequestData', () => {
  it('initializes status pending, motivation null, reviewer fields null', () => {
    const r = buildOrganizerRequestData({ userId: 'u1', municipalityId: 'm1' });
    expect(r.status).toBe('pending');
    expect(r.motivation).toBeNull();
    expect(r.reviewedAt).toBeNull();
    expect(r.reviewedBy).toBeNull();
    expect(() => OrganizerRequestDataSchema.parse(r)).not.toThrow();
  });

  it('preserves provided motivation', () => {
    const r = buildOrganizerRequestData({
      userId: 'u1',
      municipalityId: 'm1',
      motivation: 'quiero ayudar',
    });
    expect(r.motivation).toBe('quiero ayudar');
  });
});
