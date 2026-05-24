import { describe, it, expect } from 'vitest';
import { buildUserData } from '../../src/models/user/UserDataModel';

describe('buildUserData', () => {
  it('builds a user with required fields', () => {
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
  });

  it('builds a user with all optional fields', () => {
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

  it('defaults personId to null', () => {
    const user = buildUserData({
      displayName: 'Ana',
      email: 'ana@test.com',
    });
    expect(user.personId).toBeNull();
  });
});
