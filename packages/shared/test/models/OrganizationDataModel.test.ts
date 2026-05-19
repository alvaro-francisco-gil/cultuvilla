import { describe, it, expect } from 'vitest';
import { buildOrganizationData } from '../../src/models/organization/OrganizationDataModel';

describe('OrganizationDataModel', () => {
  it('builds with municipalityId, defaults status pending and decision fields null', () => {
    const o = buildOrganizationData({
      name: 'Peña X',
      type: 'peña',
      requestedBy: 'u1',
      municipalityId: 'v1',
    });
    expect(o.name).toBe('Peña X');
    expect(o.municipalityId).toBe('v1');
    expect(o.status).toBe('pending');
    expect(o.approvedBy).toBeNull();
    expect(o.decidedAt).toBeNull();
  });

  it('preserves provided status, approvedBy, decidedAt', () => {
    const t = new Date('2026-04-01');
    const o = buildOrganizationData({
      name: 'A',
      type: 'asociación',
      requestedBy: 'u1',
      municipalityId: 'v1',
      status: 'approved',
      approvedBy: 'admin1',
      decidedAt: t,
    });
    expect(o.status).toBe('approved');
    expect(o.approvedBy).toBe('admin1');
    expect(o.decidedAt).toEqual(t);
  });
});
