import { describe, it, expect } from 'vitest';
import {
  OrganizationDataSchema,
  buildOrganizationData,
} from '../../../src/models/organization/OrganizationDataModel';

const validOrg = {
  name: 'Peña X',
  description: null,
  type: 'peña' as const,
  status: 'pending' as const,
  municipalityId: 'm-1',
  requestedBy: 'u-1',
  approvedBy: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  decidedAt: null,
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
    expect(o.approvedBy).toBeNull();
    expect(o.decidedAt).toBeNull();
    expect(o.createdAt).toBeInstanceOf(Date);
    expect(() => OrganizationDataSchema.parse(o)).not.toThrow();
  });
});
