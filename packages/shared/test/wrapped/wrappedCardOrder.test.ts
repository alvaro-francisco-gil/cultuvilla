import { describe, it, expect } from 'vitest';
import { WRAPPED_CARDS, WrappedCardSchema } from '../../src/models/wrapped/WrappedDataModel';

/**
 * The deck order is a product decision, and until now nothing held it: the two
 * tests that touch the card set both `.sort()` the keys, so any reshuffle of
 * this array passed unnoticed. It is also the ONLY definition of the order —
 * the review screen walks it to lay a Wrapped out, so a change here re-orders
 * Wrappeds that were rendered months ago, with no re-render and no migration.
 * That is worth stating out loud rather than discovering from a screenshot.
 */
describe('WRAPPED_CARDS', () => {
  it('tells the story before it counts it', () => {
    expect([...WRAPPED_CARDS]).toEqual([
      'cover',
      'events', // "Lo que se hizo" — what the pueblo did
      'stats', // "En números" — the evidence, as a payoff rather than a preamble
      'news',
      'people',
      'organizers',
      'posters', // carteles close the set: this year, added to a long history
    ]);
  });

  it('is the enum the stored document validates against, so no card can drift out of the deck', () => {
    for (const card of WRAPPED_CARDS) {
      expect(WrappedCardSchema.parse(card)).toBe(card);
    }
    expect(WrappedCardSchema.options).toHaveLength(WRAPPED_CARDS.length);
  });

  it('names every card exactly once', () => {
    expect(new Set(WRAPPED_CARDS).size).toBe(WRAPPED_CARDS.length);
  });
});
