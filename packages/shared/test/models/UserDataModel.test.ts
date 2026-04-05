import { describe, it, expect } from 'vitest';
import { buildUserData } from '../../src/models/user/UserDataModel';

describe('buildUserData', () => {
  it('builds a user with required fields', () => {
    const user = buildUserData({
      displayName: 'Juan García',
      email: 'juan@example.com',
      birthday: new Date('1990-05-15'),
    });
    expect(user.displayName).toBe('Juan García');
    expect(user.email).toBe('juan@example.com');
    expect(user.birthday).toEqual(new Date('1990-05-15'));
    expect(user.biography).toBeNull();
    expect(user.telephone).toBeNull();
    expect(user.photoURL).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('builds a user with all optional fields', () => {
    const user = buildUserData({
      displayName: 'María López',
      email: 'maria@example.com',
      birthday: new Date('1985-03-20'),
      biography: 'Vecina del pueblo',
      telephone: '+34612345678',
      photoURL: 'https://example.com/photo.jpg',
    });
    expect(user.biography).toBe('Vecina del pueblo');
    expect(user.telephone).toBe('+34612345678');
    expect(user.photoURL).toBe('https://example.com/photo.jpg');
  });
});
