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
    expect(lateNight?.today).toEqual(noon?.today);
  });

  it('changes over the days instead of pinning one word', () => {
    const picks = new Set(
      Array.from({ length: 30 }, (_, i) =>
        pickWordOfTheDay(terms, 'm1', new Date(2026, 8, 1 + i, 12))?.today.id,
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('offers up to three other words, never repeating today’s', () => {
    const pick = pickWordOfTheDay(terms, 'm1', day('2026-09-14'));
    expect(pick?.more).toHaveLength(3);
    expect(pick?.more.map((t) => t.id)).not.toContain(pick?.today.id);
    expect(new Set(pick?.more.map((t) => t.id)).size).toBe(3);
  });

  it('offers only the words there are', () => {
    const pick = pickWordOfTheDay(terms.slice(0, 2), 'm1', day('2026-09-14'));
    expect(pick?.more).toHaveLength(1);
    expect(pickWordOfTheDay(terms.slice(0, 1), 'm1', day('2026-09-14'))?.more).toEqual([]);
  });
});
