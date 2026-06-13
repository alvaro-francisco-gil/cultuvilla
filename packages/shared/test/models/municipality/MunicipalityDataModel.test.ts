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
} from '../../../src/models/municipality/MunicipalityDataModel';

const validMunicipality = {
  name: 'Jódar',
  nameLower: 'jodar',
  province: 'Jaén',
  comunidadAutonoma: 'Andalucía',
  codigoINE: '23050',
  coordinates: { lat: 37.85, lng: -3.35 },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  escudoUrl: null,
  escudoThumbUrl: null,
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
          coverImages: [],
          adminUserId: 'u1',
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
        coverImages: [],
        adminUserId: 'u',
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

describe('buildVillageCommunity', () => {
  it('defaults coverImages to [] and profileForm to null', () => {
    const c = buildVillageCommunity({ description: 'p', adminUserId: 'a' });
    expect(c.coverImages).toEqual([]);
    expect(c.profileForm).toBeNull();
    expect(() => VillageCommunitySchema.parse(c)).not.toThrow();
  });
});

describe('BarrioDataSchema and buildBarrioData', () => {
  it('builds and round-trips', () => {
    const b = buildBarrioData({ name: 'El Castillo', municipalityId: 'm1' });
    expect(() => BarrioDataSchema.parse(b)).not.toThrow();
  });
});

describe('PlaceDataSchema and buildPlaceData', () => {
  it('defaults description to null, keeps kind, and round-trips', () => {
    const p = buildPlaceData({ name: 'C', kind: 'cemetery', municipalityId: 'm1' });
    expect(p.description).toBeNull();
    expect(p.kind).toBe('cemetery');
    expect(() => PlaceDataSchema.parse(p)).not.toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() =>
      PlaceDataSchema.parse({
        name: 'X',
        kind: 'castle',
        description: null,
        municipalityId: 'm1',
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});
