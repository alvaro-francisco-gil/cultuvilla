import { describe, it, expect } from 'vitest';
import { answeredCountByKey } from '../../src/services/membershipProfileService';

describe('answeredCountByKey', () => {
  it('counts members with a non-empty answer per key, ignoring empties', () => {
    const members = [
      { profileAnswers: { color: 'rojo', edad: 30 } },
      { profileAnswers: { color: 'azul', tags: [] as string[] } },
      { profileAnswers: { color: '', tags: ['a'] } },
    ];
    expect(answeredCountByKey(members)).toEqual({ color: 2, edad: 1, tags: 1 });
  });
});
