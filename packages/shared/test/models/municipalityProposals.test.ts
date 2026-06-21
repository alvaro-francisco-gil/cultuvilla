import { describe, it, expect } from 'vitest';
import {
  BarrioDataSchema,
  PlaceDataSchema,
  buildBarrioData,
  buildPlaceData,
} from '../../src/models/municipality/MunicipalityDataModel';

describe('Place/Barrio proposal fields', () => {
  it('buildBarrioData defaults to a pending proposal carrying the proposer', () => {
    const b = buildBarrioData({ name: 'Centro', municipalityId: 'm1', proposedBy: 'alice' });
    expect(b.status).toBe('pending');
    expect(b.proposedBy).toBe('alice');
    expect(b.approvedBy).toBeNull();
    expect(b.decidedAt).toBeNull();
  });

  it('buildPlaceData honours an explicit approved status (organizer direct create)', () => {
    const p = buildPlaceData({
      name: 'Iglesia', kind: 'church', municipalityId: 'm1', status: 'approved',
    });
    expect(p.status).toBe('approved');
    expect(p.proposedBy).toBeNull();
  });

  it('legacy barrio docs (no status/proposedBy keys) parse with safe defaults', () => {
    const parsed = BarrioDataSchema.parse({
      name: 'Viejo', municipalityId: 'm1', createdAt: new Date(),
    });
    expect(parsed.status).toBe('approved');
    expect(parsed.proposedBy).toBeNull();
    expect(parsed.approvedBy).toBeNull();
    expect(parsed.decidedAt).toBeNull();
  });

  it('legacy place docs parse with safe defaults', () => {
    const parsed = PlaceDataSchema.parse({
      name: 'Plaza', kind: 'plaza', description: null, municipalityId: 'm1', createdAt: new Date(),
    });
    expect(parsed.status).toBe('approved');
    expect(parsed.proposedBy).toBeNull();
  });

  it('rejects an invalid status', () => {
    expect(() =>
      PlaceDataSchema.parse({
        name: 'X', kind: 'plaza', description: null, municipalityId: 'm1',
        createdAt: new Date(), status: 'maybe',
      }),
    ).toThrow();
  });
});
