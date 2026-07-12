import { describe, it, expect } from 'vitest';
import {
  UserDataSchema,
  buildUserData,
  CURRENT_TERMS_VERSION,
} from '../../../src/models/user/UserDataModel';

const consent = { termsAcceptedAt: new Date(), termsVersion: '1.0' };

describe('UserDataSchema', () => {
  it('accepts a fully populated user (account state only)', () => {
    const parsed = UserDataSchema.parse({
      displayName: 'María García',
      email: 'maria@example.com',
      telephone: '+34612345678',
      activeMunicipalityId: 'mun1',
      personId: 'person-1',
      createdAt: new Date(),
      ...consent,
    });
    expect(parsed.displayName).toBe('María García');
    expect(parsed.personId).toBe('person-1');
  });

  it('defaults displayName to "" when missing (denormalized projection may lag)', () => {
    // createUserProfile writes the user doc without displayName; the
    // syncPersonDenormalization trigger fills it in asynchronously. A read in
    // that window must degrade to "" rather than throw in the converter.
    const parsed = UserDataSchema.parse({
      // displayName missing
      email: 'a@b.com',
      telephone: null,
      activeMunicipalityId: null,
      personId: null,
      createdAt: new Date(),
      ...consent,
    });
    expect(parsed.displayName).toBe('');
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
        ...consent,
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
      ...consent,
      birthday: { year: 1990, month: 5, day: 14 },
    });
    expect(parsed).not.toHaveProperty('birthday');
  });
});

describe('UserDataSchema — terms acceptance', () => {
  const base = {
    displayName: 'Ana',
    email: 'ana@b.com',
    telephone: null,
    activeMunicipalityId: null,
    personId: null,
    createdAt: new Date(),
  };

  it('accepts a doc carrying termsAcceptedAt + termsVersion', () => {
    const parsed = UserDataSchema.parse({
      ...base,
      termsAcceptedAt: new Date('2026-07-10T00:00:00Z'),
      termsVersion: '1.0',
    });
    expect(parsed.termsVersion).toBe('1.0');
    expect(parsed.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('throws when the consent fields are missing (strict — forces backfill)', () => {
    expect(() => UserDataSchema.parse(base)).toThrow();
  });

  it('CURRENT_TERMS_VERSION is the published version', () => {
    expect(CURRENT_TERMS_VERSION).toBe('1.0');
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

  it('stamps the current terms version and an acceptance date by default', () => {
    const user = buildUserData({ displayName: 'Ana', email: 'ana@b.com' });
    expect(user.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
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
