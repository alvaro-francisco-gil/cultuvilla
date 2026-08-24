import { describe, it, expect } from 'vitest';
import {
  SettlementSeedSchema,
  SettlementSeedEntrySchema,
  settlementSeedId,
} from '../../../src/models/municipality/SettlementSeedModel';

const entry = {
  name: 'Villarino de Manzanas',
  kind: 'pedania' as const,
  isSeat: false,
  lat: 41.85,
  lng: -6.42,
};

describe('SettlementSeedSchema', () => {
  it('parses a municipality seed', () => {
    expect(() =>
      SettlementSeedSchema.parse({
        codigoINE: '49069',
        name: 'Figueruela de Arriba',
        settlements: [entry],
      }),
    ).not.toThrow();
  });

  it('accepts a municipality with no settlements', () => {
    expect(() =>
      SettlementSeedSchema.parse({ codigoINE: '49069', name: 'X', settlements: [] }),
    ).not.toThrow();
  });

  it('allows null coordinates — OSM does not always place a node', () => {
    expect(() =>
      SettlementSeedEntrySchema.parse({ ...entry, lat: null, lng: null }),
    ).not.toThrow();
  });

  it('rejects a kind outside the four', () => {
    expect(() => SettlementSeedEntrySchema.parse({ ...entry, kind: 'pueblo' })).toThrow();
  });

  it('rejects a settlement with no name', () => {
    const { name: _omitted, ...noName } = entry;
    expect(() => SettlementSeedEntrySchema.parse(noName)).toThrow();
  });
});

describe('settlementSeedId', () => {
  it('is stable for the same input, so re-seeding overwrites instead of duplicating', () => {
    expect(settlementSeedId('pedania', 'Villarino de Manzanas')).toBe(
      settlementSeedId('pedania', 'Villarino de Manzanas'),
    );
  });

  it('strips accents and punctuation', () => {
    expect(settlementSeedId('pedania', 'Cañizo')).toBe('osm-pedania-canizo');
    expect(settlementSeedId('aldea', "S'Agaró")).toBe('osm-aldea-s-agaro');
    expect(settlementSeedId('pedania', 'Villarino de Manzanas')).toBe(
      'osm-pedania-villarino-de-manzanas',
    );
  });

  it('separates kinds, because a barrio and a pedania can share a name', () => {
    expect(settlementSeedId('barrio', 'El Pueblo')).not.toBe(
      settlementSeedId('pedania', 'El Pueblo'),
    );
  });

  it('never produces an empty or slash-bearing id', () => {
    for (const name of ['...', '///', '   ', '—', '¿?']) {
      const id = settlementSeedId('barrio', name);
      expect(id.length).toBeGreaterThan(4);
      expect(id).not.toContain('/');
    }
  });

  it('gives punctuation-only names distinct ids rather than colliding', () => {
    expect(settlementSeedId('barrio', '...')).not.toBe(settlementSeedId('barrio', '///'));
  });

  it('bounds the id length for a pathological name', () => {
    expect(settlementSeedId('barrio', 'a'.repeat(500)).length).toBeLessThan(130);
  });
});
