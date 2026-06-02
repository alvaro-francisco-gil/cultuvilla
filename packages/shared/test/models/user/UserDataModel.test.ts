import { describe, it, expect } from 'vitest';
import {
  UserDataSchema,
  buildUserData,
} from '../../../src/models/user/UserDataModel';

describe('UserDataSchema', () => {
  it('accepts a fully populated user', () => {
    const parsed = UserDataSchema.parse({
      displayName: 'María García',
      email: 'maria@example.com',
      telephone: '+34612345678',
      activeMunicipalityId: 'mun1',
      personId: 'person-1',
      birthday: { year: 1990, month: 5, day: 14 },
      biography: 'Hola',
      photoURL: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
    });
    expect(parsed.displayName).toBe('María García');
    expect(parsed.birthday).toEqual({ year: 1990, month: 5, day: 14 });
  });

  it('rejects when displayName is missing', () => {
    expect(() =>
      UserDataSchema.parse({
        // displayName missing
        email: 'a@b.com',
        telephone: null,
        activeMunicipalityId: null,
        personId: null,
        birthday: null,
        biography: null,
        photoURL: null,
        createdAt: new Date(),
      }),
    ).toThrow();
  });

  it('rejects when birthday is omitted (nullable not optional)', () => {
    expect(() =>
      UserDataSchema.parse({
        displayName: 'Ana',
        email: 'ana@b.com',
        telephone: null,
        activeMunicipalityId: null,
        personId: null,
        // birthday omitted
        biography: null,
        photoURL: null,
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});

describe('buildUserData', () => {
  it('builds a user with required fields and defaults', () => {
    const user = buildUserData({
      displayName: 'Juan García',
      email: 'juan@example.com',
    });
    expect(user.displayName).toBe('Juan García');
    expect(user.email).toBe('juan@example.com');
    expect(user.telephone).toBeNull();
    expect(user.activeMunicipalityId).toBeNull();
    expect(user.personId).toBeNull();
    expect(user.birthday).toBeNull();
    expect(user.biography).toBeNull();
    expect(user.photoURL).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('preserves all provided fields', () => {
    const user = buildUserData({
      displayName: 'María López',
      email: 'maria@example.com',
      telephone: '+34612345678',
      activeMunicipalityId: 'mun1',
      personId: 'person-1',
      birthday: { year: 1980, month: 3, day: 22 },
      biography: 'Bio',
      photoURL: 'https://example.com/p.jpg',
    });
    expect(user.telephone).toBe('+34612345678');
    expect(user.activeMunicipalityId).toBe('mun1');
    expect(user.personId).toBe('person-1');
    expect(user.birthday).toEqual({ year: 1980, month: 3, day: 22 });
    expect(user.biography).toBe('Bio');
    expect(user.photoURL).toBe('https://example.com/p.jpg');
  });
});
