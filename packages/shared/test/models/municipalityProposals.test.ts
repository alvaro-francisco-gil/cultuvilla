import { describe, it, expect } from 'vitest';
import {
  BarrioDataSchema,
  PlaceDataSchema,
  buildBarrioData,
  buildPlaceData,
} from '../../src/models/municipality/MunicipalityDataModel';

describe('Place/Barrio visibility fields', () => {
  it('buildBarrioData defaults to an active doc carrying the proposer, no hide metadata', () => {
    const b = buildBarrioData({ name: 'Centro', municipalityId: 'm1', proposedBy: 'alice' });
    expect(b.status).toBe('active');
    expect(b.proposedBy).toBe('alice');
    expect(b.hiddenBy).toBeNull();
    expect(b.hiddenAt).toBeNull();
    expect(b.hiddenReason).toBeNull();
    // fields removed by the review -> visibility migration
    expect('reviewedBy' in b).toBe(false);
    expect('reviewedAt' in b).toBe(false);
  });

  it('buildPlaceData defaults to an active doc, no hide metadata', () => {
    const p = buildPlaceData({ name: 'Iglesia', kind: 'church', municipalityId: 'm1' });
    expect(p.status).toBe('active');
    expect(p.hiddenBy).toBeNull();
    expect(p.hiddenAt).toBeNull();
    expect(p.hiddenReason).toBeNull();
    expect(p.proposedBy).toBeNull();
    // fields removed by the review -> visibility migration
    expect('reviewedBy' in p).toBe(false);
    expect('reviewedAt' in p).toBe(false);
  });

  it('requires the visibility fields on the persisted shape', () => {
    expect(() =>
      BarrioDataSchema.parse({ name: 'Viejo', municipalityId: 'm1', createdAt: new Date() }),
    ).toThrow();
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
