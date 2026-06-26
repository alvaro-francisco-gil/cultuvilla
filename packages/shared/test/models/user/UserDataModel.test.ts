import { describe, it, expect } from 'vitest';
import {
  UserDataSchema,
  buildUserData,
} from '../../../src/models/user/UserDataModel';

describe('UserDataSchema', () => {
  it('accepts a fully populated user (account state only)', () => {
    const parsed = UserDataSchema.parse({
      displayName: 'María García',
      email: 'maria@example.com',
      telephone: '+34612345678',
      activeMunicipalityId: 'mun1',
      personId: 'person-1',
      createdAt: new Date(),
    });
    expect(parsed.displayName).toBe('María García');
    expect(parsed.personId).toBe('person-1');
  });

  it('rejects when displayName is missing', () => {
    expect(() =>
      UserDataSchema.parse({
        // displayName missing
        email: 'a@b.com',
        telephone: null,
        activeMunicipalityId: null,
        personId: null,
        createdAt: new Date(),
      }),
    ).toThrow();
  });

  it('rejects profile fields that belong on the linked person', () => {
    expect(() =>
      UserDataSchema.parse({
        displayName: 'Ana',
        email: 'ana@b.com',
        telephone: null,
        activeMunicipalityId: null,
        personId: null,
        createdAt: new Date(),
        // birthday/biography/photoURL are NOT user fields; z.object strips
        // unknowns, so the doc still parses — assert they don't survive.
      }),
    ).not.toThrow();
    const parsed = UserDataSchema.parse({
      displayName: 'Ana',
      email: 'ana@b.com',
      telephone: null,
      activeMunicipalityId: null,
      personId: null,
      createdAt: new Date(),
      birthday: { year: 1990, month: 5, day: 14 },
    });
    expect(parsed).not.toHaveProperty('birthday');
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
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user).not.toHaveProperty('birthday');
    expect(user).not.toHaveProperty('photoURL');
  });

  it('preserves all provided account fields', () => {
    const user = buildUserData({
      displayName: 'María López',
      email: 'maria@example.com',
      telephone: '+34612345678',
      activeMunicipalityId: 'mun1',
      personId: 'person-1',
    });
    expect(user.telephone).toBe('+34612345678');
    expect(user.activeMunicipalityId).toBe('mun1');
    expect(user.personId).toBe('person-1');
  });
});
