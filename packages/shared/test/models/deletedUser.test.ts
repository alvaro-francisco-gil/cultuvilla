import { describe, it, expect } from 'vitest';
import { DELETED_USER_UID } from '../../src/models/user/deletedUser';

describe('DELETED_USER_UID', () => {
  it('is the sentinel uid used to reattribute erased-user content', () => {
    expect(DELETED_USER_UID).toBe('deleted-user');
  });
});
