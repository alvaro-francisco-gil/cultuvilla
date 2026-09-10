import { describe, it, expect } from 'vitest';
import { creditedUserIds } from '../../src/models/core/ContributorsModel';

describe('creditedUserIds', () => {
  it('always credits the author, even when nobody else is picked', () => {
    expect(creditedUserIds('alice')).toEqual(['alice']);
    expect(creditedUserIds('alice', [])).toEqual(['alice']);
  });

  it('puts the author first, so the byline leads with whoever recorded it', () => {
    expect(creditedUserIds('alice', ['bob', 'carol'])).toEqual(['alice', 'bob', 'carol']);
  });

  it('does not credit the author twice when the picker already included them', () => {
    expect(creditedUserIds('alice', ['bob', 'alice'])).toEqual(['alice', 'bob']);
  });

  it('credits each person once', () => {
    expect(creditedUserIds('alice', ['bob', 'bob', 'carol'])).toEqual(['alice', 'bob', 'carol']);
  });
});
