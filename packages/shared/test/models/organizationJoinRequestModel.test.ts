import { describe, it, expect } from 'vitest';
import {
  OrganizationJoinRequestDataSchema, buildOrganizationJoinRequestData,
} from '../../src/models/organizationJoinRequest/OrganizationJoinRequestDataModel';

describe('OrganizationJoinRequestDataModel', () => {
  it('builds a pending request with null review fields', () => {
    const r = buildOrganizationJoinRequestData({ userId: 'u', orgId: 'o', municipalityId: 'm' });
    expect(r).toMatchObject({ status: 'pending', reviewedAt: null, reviewedBy: null });
    expect(r.requestedAt).toBeInstanceOf(Date);
  });
  it('rejects an unknown status', () => {
    expect(() => OrganizationJoinRequestDataSchema.parse({
      userId: 'u', orgId: 'o', municipalityId: 'm', status: 'maybe',
      requestedAt: new Date(), reviewedAt: null, reviewedBy: null,
    })).toThrow();
  });
});
