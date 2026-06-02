import { describe, it, expect } from 'vitest';
import {
  OccupationDataSchema,
  OccupationProposalDataSchema,
  buildOccupationData,
  buildOccupationProposalData,
} from '../../../src/models/occupation/OccupationDataModel';

describe('OccupationDataSchema', () => {
  it('accepts a fully populated occupation', () => {
    const now = new Date();
    const parsed = OccupationDataSchema.parse({
      name: 'Agricultor',
      createdBy: 'admin1',
      createdAt: now,
    });
    expect(parsed.name).toBe('Agricultor');
    expect(parsed.createdAt).toBe(now);
  });

  it('rejects when a required field is missing', () => {
    expect(() =>
      OccupationDataSchema.parse({
        // name missing
        createdBy: 'admin1',
        createdAt: new Date(),
      }),
    ).toThrow();
  });

  it('buildOccupationData populates createdAt with a Date', () => {
    const result = buildOccupationData({ name: 'Agricultor', createdBy: 'admin1' });
    expect(result.name).toBe('Agricultor');
    expect(result.createdBy).toBe('admin1');
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});

describe('OccupationProposalDataSchema', () => {
  it('accepts a fully populated pending proposal', () => {
    const now = new Date();
    const parsed = OccupationProposalDataSchema.parse({
      name: 'Molinero',
      proposedBy: 'u1',
      proposedAt: now,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      approvedOccupationId: null,
    });
    expect(parsed.status).toBe('pending');
    expect(parsed.reviewedBy).toBeNull();
  });

  it('accepts an approved proposal with reviewer fields populated', () => {
    const now = new Date();
    const parsed = OccupationProposalDataSchema.parse({
      name: 'Molinero',
      proposedBy: 'u1',
      proposedAt: now,
      status: 'approved',
      reviewedBy: 'mod1',
      reviewedAt: now,
      approvedOccupationId: 'occ1',
    });
    expect(parsed.status).toBe('approved');
    expect(parsed.approvedOccupationId).toBe('occ1');
  });

  it('rejects an invalid status', () => {
    expect(() =>
      OccupationProposalDataSchema.parse({
        name: 'Molinero',
        proposedBy: 'u1',
        proposedAt: new Date(),
        status: 'banana',
        reviewedBy: null,
        reviewedAt: null,
        approvedOccupationId: null,
      }),
    ).toThrow();
  });

  it('rejects when a required field is missing', () => {
    expect(() =>
      OccupationProposalDataSchema.parse({
        // name missing
        proposedBy: 'u1',
        proposedAt: new Date(),
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        approvedOccupationId: null,
      }),
    ).toThrow();
  });

  it('buildOccupationProposalData defaults to pending with nulled reviewer fields', () => {
    const result = buildOccupationProposalData({ name: 'Molinero', proposedBy: 'user1' });
    expect(result.name).toBe('Molinero');
    expect(result.proposedBy).toBe('user1');
    expect(result.status).toBe('pending');
    expect(result.reviewedBy).toBeNull();
    expect(result.reviewedAt).toBeNull();
    expect(result.approvedOccupationId).toBeNull();
    expect(result.proposedAt).toBeInstanceOf(Date);
  });
});
