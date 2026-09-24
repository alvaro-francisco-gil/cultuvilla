import { describe, it, expect } from 'vitest';
import { pickWordOfTheDay } from '../../src/utils/wordOfTheDay';

const terms = ['antier', 'horco', 'miaja', 'modorro', 'rilar', 'yunta'].map((id) => ({ id }));
const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe('pickWordOfTheDay', () => {
  it('returns null when the village has no words', () => {
    expect(pickWordOfTheDay([], 'm1', day('2026-09-14'))).toBeNull();
  });

  it('is stable for the whole day, whatever the hour', () => {
    const noon = pickWordOfTheDay(terms, 'm1', day('2026-09-14'));
    const lateNight = pickWordOfTheDay(terms, 'm1', new Date('2026-09-14T23:59:00'));
    expect(lateNight).toEqual(noon);
  });

  it('changes over the days instead of pinning one word', () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, i) =>
        pickWordOfTheDay(terms, 'm1', new Date(2026, 8, 1 + i, 12))?.id,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
