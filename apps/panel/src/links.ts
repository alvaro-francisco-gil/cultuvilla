import type { BusinessCard } from '@cultuvilla/shared/models';

const REPO = 'https://github.com/alvaro-francisco-gil/cultuvilla/blob/develop';

/** The record's Markdown on GitHub — where the full reasoning lives. */
export const sourceUrl = (card: BusinessCard): string => `${REPO}/${card.path}`;

/**
 * Where a click should land: the initiative's own page. Several records carry a
 * `[[confirmar]]` placeholder instead of a verified link, so anything that is not
 * a real URL falls back to the record rather than to a broken href.
 */
export function destinationUrl(card: BusinessCard): string {
  return card.url && /^https?:\/\//.test(card.url) ? card.url : sourceUrl(card);
}
