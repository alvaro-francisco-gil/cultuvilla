import { describe, expect, it } from 'vitest';
import { generateSeatToken, isWellFormedSeatToken } from '../../helpers/seatToken';

describe('seat tokens', () => {
  it('generates URL-safe tokens that pass the shape guard', () => {
    const token = generateSeatToken();
    expect(isWellFormedSeatToken(token)).toBe(true);
    // base64url only: nothing that would need escaping in a path segment.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not repeat', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateSeatToken()));
    expect(tokens.size).toBe(200);
  });

  it('rejects anything that is not a plausible token', () => {
    for (const bad of ['', 'short', 'has/slash/', null, undefined, 42, 'a'.repeat(200)]) {
      expect(isWellFormedSeatToken(bad)).toBe(false);
    }
  });
});
