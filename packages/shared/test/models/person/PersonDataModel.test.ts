import { describe, it, expect } from 'vitest';
import {
  PersonDataSchema,
  buildPersonData,
  buildResidenceLinks,
  buildDisplayName,
  buildShortName,
} from '../../../src/models/person/PersonDataModel';

describe('PersonDataSchema', () => {
  it('accepts a full valid person literal', () => {
    const parsed = PersonDataSchema.parse({
      givenName: 'María',
      middleNames: ['Carmen'],
      firstSurname: 'García',
      secondSurname: 'López',
      nickname: 'Paca',
      sex: 'female',
      birthday: { year: 1943, month: 6, day: 15 },
      deathDate: { year: 2020, month: null, day: null },
      birthPlace: { municipalityId: 'mun1', barrioId: 'barrio1' },
      burialPlace: { municipalityId: 'mun1', placeId: 'place1' },
      municipalityLinks: [{ municipalityId: 'mun1', barrioId: null }],
      occupationIds: ['occ1', 'occ2'],
      pendingOccupations: ['Molinera'],
      biography: 'Fue agricultora',
      photoURL: 'https://example.com/photo.jpg',
      userId: 'user1',
      createdBy: 'user1',
      createdAt: new Date(),
    });
    expect(parsed.givenName).toBe('María');
    expect(parsed.sex).toBe('female');
  });

  it('rejects when a required field is missing', () => {
    expect(() =>
      PersonDataSchema.parse({
        // givenName missing
        middleNames: [],
        firstSurname: null,
        secondSurname: null,
        nickname: null,
        sex: null,
        birthday: null,
        deathDate: null,
        birthPlace: null,
        burialPlace: null,
        municipalityLinks: [],
        occupationIds: [],
        pendingOccupations: [],
        biography: null,
        photoURL: null,
        userId: null,
        createdBy: 'user1',
        createdAt: new Date(),
      }),
    ).toThrow();
  });

  it('rejects an unknown sex enum value', () => {
    expect(() =>
      PersonDataSchema.parse({
        givenName: 'Juan',
        middleNames: [],
        firstSurname: null,
        secondSurname: null,
        nickname: null,
        sex: 'unknown',
        birthday: null,
        deathDate: null,
        birthPlace: null,
        burialPlace: null,
        municipalityLinks: [],
        occupationIds: [],
        pendingOccupations: [],
        biography: null,
        photoURL: null,
        userId: null,
        createdBy: 'user1',
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});

describe('buildPersonData', () => {
  it('sets defaults for all optional fields', () => {
    const result = buildPersonData({ givenName: 'Juan', createdBy: 'user1' });
    expect(result.givenName).toBe('Juan');
    expect(result.middleNames).toEqual([]);
    expect(result.firstSurname).toBeNull();
    expect(result.secondSurname).toBeNull();
    expect(result.nickname).toBeNull();
    expect(result.sex).toBeNull();
    expect(result.birthday).toBeNull();
    expect(result.deathDate).toBeNull();
    expect(result.birthPlace).toBeNull();
    expect(result.burialPlace).toBeNull();
    expect(result.municipalityLinks).toEqual([]);
    expect(result.occupationIds).toEqual([]);
    expect(result.pendingOccupations).toEqual([]);
    expect(result.biography).toBeNull();
    expect(result.photoURL).toBeNull();
    expect(result.userId).toBeNull();
    expect(result.createdBy).toBe('user1');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('preserves all provided fields', () => {
    const result = buildPersonData({
      givenName: 'María',
      middleNames: ['Carmen'],
      firstSurname: 'García',
      secondSurname: 'López',
      nickname: 'Paca',
      sex: 'female',
      birthday: { year: 1943, month: 6, day: 15 },
      deathDate: { year: 2020, month: null, day: null },
      birthPlace: { municipalityId: 'mun1', barrioId: 'barrio1' },
      burialPlace: { municipalityId: 'mun1', placeId: 'place1' },
      municipalityLinks: [{ municipalityId: 'mun1', barrioId: null }],
      occupationIds: ['occ1', 'occ2'],
      pendingOccupations: ['Molinera'],
      biography: 'Fue agricultora',
      photoURL: 'https://example.com/photo.jpg',
      userId: 'user1',
      createdBy: 'user1',
    });
    expect(result.middleNames).toEqual(['Carmen']);
    expect(result.firstSurname).toBe('García');
    expect(result.sex).toBe('female');
    expect(result.birthday).toEqual({ year: 1943, month: 6, day: 15 });
    expect(result.deathDate).toEqual({ year: 2020, month: null, day: null });
    expect(result.burialPlace).toEqual({ municipalityId: 'mun1', placeId: 'place1' });
    expect(result.occupationIds).toEqual(['occ1', 'occ2']);
    expect(result.pendingOccupations).toEqual(['Molinera']);
  });

  it('accepts year-only birthday', () => {
    const result = buildPersonData({
      givenName: 'Ana',
      createdBy: 'u1',
      birthday: { year: 1900, month: null, day: null },
    });
    expect(result.birthday).toEqual({ year: 1900, month: null, day: null });
  });

  it('accepts fully-unknown birthday', () => {
    const result = buildPersonData({
      givenName: 'Ana',
      createdBy: 'u1',
      birthday: { year: null, month: null, day: null },
    });
    expect(result.birthday).toEqual({ year: null, month: null, day: null });
  });
});

describe('buildDisplayName', () => {
  it('joins all name parts', () => {
    expect(
      buildDisplayName({
        givenName: 'Juan',
        middleNames: ['Carlos'],
        firstSurname: 'García',
        secondSurname: 'López',
      }),
    ).toBe('Juan Carlos García López');
  });

  it('skips null surnames', () => {
    expect(
      buildDisplayName({
        givenName: 'Ana',
        middleNames: [],
        firstSurname: 'Martínez',
        secondSurname: null,
      }),
    ).toBe('Ana Martínez');
  });

  it('works with no surnames', () => {
    expect(
      buildDisplayName({ givenName: 'Paco', middleNames: [], firstSurname: null, secondSurname: null }),
    ).toBe('Paco');
  });
});

describe('buildResidenceLinks', () => {
  it('returns an empty array when no municipality is selected', () => {
    expect(buildResidenceLinks(null, null)).toEqual([]);
    expect(buildResidenceLinks(null, 'barrio-1')).toEqual([]);
  });

  it('returns a single link with barrioId null when only a village is selected', () => {
    expect(buildResidenceLinks('muni-1', null)).toEqual([
      { municipalityId: 'muni-1', barrioId: null },
    ]);
  });

  it('returns a single link with both ids when a barrio is selected', () => {
    expect(buildResidenceLinks('muni-1', 'barrio-1')).toEqual([
      { municipalityId: 'muni-1', barrioId: 'barrio-1' },
    ]);
  });

  it('produces a link whose shape exactly matches the getPersonsByBarrio query object', () => {
    // getPersonsByBarrio matches via array-contains { municipalityId, barrioId },
    // so the stored object must have exactly those two keys and no others.
    const [link] = buildResidenceLinks('muni-1', 'barrio-1');
    expect(Object.keys(link).sort()).toEqual(['barrioId', 'municipalityId']);
  });
});

describe('buildShortName', () => {
  it('returns nickname if set', () => {
    expect(buildShortName({ givenName: 'Juan', nickname: 'Juanito', firstSurname: 'García' })).toBe(
      'Juanito',
    );
  });

  it('returns givenName + firstSurname if no nickname', () => {
    expect(buildShortName({ givenName: 'Juan', nickname: null, firstSurname: 'García' })).toBe(
      'Juan García',
    );
  });
});
