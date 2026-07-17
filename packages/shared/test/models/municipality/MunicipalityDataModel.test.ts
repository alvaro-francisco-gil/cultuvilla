import { describe, it, expect } from 'vitest';
import {
  MunicipalityDataSchema,
  BarrioDataSchema,
  PlaceDataSchema,
  VillageCommunitySchema,
  buildMunicipalityData,
  buildVillageCommunity,
  buildBarrioData,
  buildPlaceData,
  municipalitySearchKey,
  hasManualEscudo,
  escudoFullUrl,
  escudoThumbDisplayUrl,
} from '../../../src/models/municipality/MunicipalityDataModel';

const validMunicipality = {
  name: 'Jódar',
  nameLower: 'jodar',
  province: 'Jaén',
  comunidadAutonoma: 'Andalucía',
  codigoINE: '23050',
  coordinates: { lat: 37.85, lng: -3.35 },
  mapZoom: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  escudoUrl: null,
  escudoThumbUrl: null,
  escudoManualUrl: null,
  community: null,
  communityActive: false,
};

describe('MunicipalityDataSchema', () => {
  it('parses a valid municipality with null community', () => {
    expect(() => MunicipalityDataSchema.parse(validMunicipality)).not.toThrow();
  });

  it('parses a municipality with an active community', () => {
    expect(() =>
      MunicipalityDataSchema.parse({
        ...validMunicipality,
        community: {
          description: 'Hola',
          organizerId: 'u1',
          profileForm: null,
          activatedAt: new Date('2026-01-02T00:00:00Z'),
        },
        communityActive: true,
      }),
    ).not.toThrow();
  });

  it('rejects a missing required field', () => {
    const { name: _name, ...rest } = validMunicipality;
    expect(() => MunicipalityDataSchema.parse(rest)).toThrow();
  });

  it('rejects coordinates with wrong shape', () => {
    expect(() =>
      MunicipalityDataSchema.parse({
        ...validMunicipality,
        coordinates: { latitude: 1, longitude: 2 },
      }),
    ).toThrow();
  });
});

describe('VillageCommunitySchema', () => {
  it('parses a community with a profileForm', () => {
    expect(() =>
      VillageCommunitySchema.parse({
        description: '',
        organizerId: 'u',
        profileForm: {
          fields: [{ source: 'predefined', key: 'barrio', required: true }],
          updatedAt: new Date(),
        },
        activatedAt: new Date(),
      }),
    ).not.toThrow();
  });
});

describe('buildMunicipalityData', () => {
  it('fills defaults and derives nameLower', () => {
    const built = buildMunicipalityData({
      name: 'Ávila',
      province: 'Ávila',
      comunidadAutonoma: 'Castilla y León',
      codigoINE: '05019',
    });
    expect(built.nameLower).toBe(municipalitySearchKey('Ávila'));
    expect(built.coordinates).toBeNull();
    expect(built.community).toBeNull();
    expect(built.communityActive).toBe(false);
    expect(() => MunicipalityDataSchema.parse(built)).not.toThrow();
  });

  it('preserves provided LatLng coordinates', () => {
    const built = buildMunicipalityData({
      name: 'X',
      province: 'P',
      comunidadAutonoma: 'C',
      codigoINE: '00000',
      coordinates: { lat: 37.85, lng: -3.35 },
    });
    expect(built.coordinates).toEqual({ lat: 37.85, lng: -3.35 });
  });
});

describe('escudo resolution helpers', () => {
  const wikidata = { escudoUrl: 'wiki-full', escudoThumbUrl: 'wiki-thumb', escudoManualUrl: null };
  const manual = { escudoUrl: 'wiki-full', escudoThumbUrl: 'wiki-thumb', escudoManualUrl: 'manual' };
  const none = { escudoUrl: null, escudoThumbUrl: null, escudoManualUrl: null };
  const legacy = { escudoUrl: 'wiki-full', escudoThumbUrl: 'wiki-thumb' }; // pre-field doc

  it('hasManualEscudo is true only when a manual upload exists', () => {
    expect(hasManualEscudo(manual)).toBe(true);
    expect(hasManualEscudo(wikidata)).toBe(false);
    expect(hasManualEscudo(legacy)).toBe(false);
  });

  it('escudoFullUrl prefers the manual upload, else Wikidata, else null', () => {
    expect(escudoFullUrl(manual)).toBe('manual');
    expect(escudoFullUrl(wikidata)).toBe('wiki-full');
    expect(escudoFullUrl(none)).toBeNull();
  });

  it('escudoThumbDisplayUrl prefers the manual upload, else the Wikidata thumb', () => {
    expect(escudoThumbDisplayUrl(manual)).toBe('manual');
    expect(escudoThumbDisplayUrl(wikidata)).toBe('wiki-thumb');
    expect(escudoThumbDisplayUrl(none)).toBeNull();
  });
});

describe('buildVillageCommunity', () => {
  it('defaults profileForm to null', () => {
    const c = buildVillageCommunity({ description: 'p', organizerId: 'a' });
    expect(c.profileForm).toBeNull();
    expect(() => VillageCommunitySchema.parse(c)).not.toThrow();
  });

  // A village "started" by a villager has no organizer yet — organizerId is null.
  it('defaults organizerId to null when omitted (no organizer yet)', () => {
    const c = buildVillageCommunity({ description: 'p' });
    expect(c.organizerId).toBeNull();
    expect(() => VillageCommunitySchema.parse(c)).not.toThrow();
  });

  it('VillageCommunitySchema accepts a null organizerId', () => {
    expect(() =>
      VillageCommunitySchema.parse({
        description: '',
        organizerId: null,
        profileForm: null,
        activatedAt: new Date(),
      }),
    ).not.toThrow();
  });
});

describe('BarrioDataSchema and buildBarrioData', () => {
  it('builds, defaults imageURL to null and residentCount to 0, and round-trips', () => {
    const b = buildBarrioData({ name: 'El Castillo', municipalityId: 'm1' });
    expect(b.imageURL).toBeNull();
    expect(b.residentCount).toBe(0);
    expect(() => BarrioDataSchema.parse(b)).not.toThrow();
  });

  it('keeps a provided imageURL', () => {
    const b = buildBarrioData({ name: 'El Castillo', municipalityId: 'm1', imageURL: 'https://x/b.png' });
    expect(b.imageURL).toBe('https://x/b.png');
    expect(() => BarrioDataSchema.parse(b)).not.toThrow();
  });
});

describe('PlaceDataSchema and buildPlaceData', () => {
  it('defaults description + imageURL to null, keeps kind, and round-trips', () => {
    const p = buildPlaceData({ name: 'C', kind: 'cemetery', municipalityId: 'm1' });
    expect(p.description).toBeNull();
    expect(p.imageURL).toBeNull();
    expect(p.kind).toBe('cemetery');
    expect(() => PlaceDataSchema.parse(p)).not.toThrow();
  });

  it('keeps a provided imageURL', () => {
    const p = buildPlaceData({ name: 'C', kind: 'church', municipalityId: 'm1', imageURL: 'https://x/p.png' });
    expect(p.imageURL).toBe('https://x/p.png');
    expect(() => PlaceDataSchema.parse(p)).not.toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() =>
      PlaceDataSchema.parse({
        name: 'X',
        kind: 'castle',
        description: null,
        municipalityId: 'm1',
        imageURL: null,
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});
