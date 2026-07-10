import { describe, it, expect } from 'vitest';
import { OccupationDataSchema } from '../../../src/models/occupation/OccupationDataModel';

describe('OccupationDataSchema', () => {
  it('accepts a fully populated collected occupation', () => {
    const now = new Date();
    const parsed = OccupationDataSchema.parse({
      name: 'Agricultor',
      count: 3,
      updatedAt: now,
    });
    expect(parsed.name).toBe('Agricultor');
    expect(parsed.count).toBe(3);
    expect(parsed.updatedAt).toBe(now);
  });

  it('rejects when a required field is missing', () => {
    expect(() =>
      OccupationDataSchema.parse({
        // name missing
        count: 1,
        updatedAt: new Date(),
      }),
    ).toThrow();
  });
});
