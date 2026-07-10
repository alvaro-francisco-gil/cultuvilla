import { describe, it, expect } from 'vitest';
import {
  OrganizationDataSchema,
  buildOrganizationData,
} from '../../../src/models/organization/OrganizationDataModel';

const validOrg = {
  name: 'Peña X',
  description: null,
  imageURL: null,
  type: 'peña' as const,
  status: 'pending' as const,
  municipalityId: 'm-1',
  requestedBy: 'u-1',
  reviewedBy: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  reviewedAt: null,
  commentCount: 0,
  reactionCounts: { like: 0, heart: 0 },
};

describe('OrganizationDataSchema', () => {
  it('parses a complete valid organization', () => {
    expect(() => OrganizationDataSchema.parse(validOrg)).not.toThrow();
  });

  it('rejects a missing required field', () => {
    const { name: _name, ...rest } = validOrg;
    expect(() => OrganizationDataSchema.parse(rest)).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => OrganizationDataSchema.parse({ ...validOrg, status: 'archived' })).toThrow();
  });

  it('requires imageURL on the persisted shape', () => {
    const { imageURL: _omit, ...rest } = validOrg;
    expect(() => OrganizationDataSchema.parse(rest)).toThrow();
  });
});

describe('buildOrganizationData', () => {
  it('defaults status pending and decision fields null', () => {
    const o = buildOrganizationData({
      name: 'Peña X',
      type: 'peña',
      requestedBy: 'u1',
      municipalityId: 'v1',
    });
    expect(o.name).toBe('Peña X');
    expect(o.municipalityId).toBe('v1');
    expect(o.status).toBe('pending');
    expect(o.description).toBeNull();
    expect(o.imageURL).toBeNull();
    expect(o.reviewedBy).toBeNull();
    expect(o.reviewedAt).toBeNull();
    expect(o.createdAt).toBeInstanceOf(Date);
    expect(() => OrganizationDataSchema.parse(o)).not.toThrow();
  });
});
