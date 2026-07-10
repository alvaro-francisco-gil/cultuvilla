import { describe, it, expect } from 'vitest';
import { ENTITY_KINDS, EntityKindSchema } from '../../src/models/interaction/EntityKind';

describe('EntityKind', () => {
  it('lists all six entity kinds', () => {
    expect([...ENTITY_KINDS].sort()).toEqual(
      ['barrio', 'event', 'festivalPoster', 'news', 'organization', 'place'].sort(),
    );
  });
  it('schema accepts a valid kind and rejects an invalid one', () => {
    expect(EntityKindSchema.parse('event')).toBe('event');
    expect(() => EntityKindSchema.parse('user')).toThrow();
  });
});
