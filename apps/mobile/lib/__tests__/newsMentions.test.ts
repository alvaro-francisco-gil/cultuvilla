import { describe, expect, it } from '@jest/globals';
import { mentionHref } from '../newsMentions';
import type { NewsMention } from '@cultuvilla/shared/models/news/NewsPostDataModel';

function mention(entityType: NewsMention['entityType'], entityId: string): NewsMention {
  return { entityType, entityId, label: 'x', offset: 0, length: 1 };
}

const MUN = 'mun-1';

describe('mentionHref', () => {
  it('routes each mentionable entity to its detail screen', () => {
    expect(mentionHref(mention('organization', 'o1'), MUN)).toBe('/o/o1');
    expect(mentionHref(mention('event', 'e1'), MUN)).toBe('/event/e1');
    expect(mentionHref(mention('place', 'p1'), MUN)).toBe('/village/mun-1/place/p1');
    expect(mentionHref(mention('barrio', 'b1'), MUN)).toBe('/village/mun-1/barrio/b1');
    expect(mentionHref(mention('festivalPoster', 'fp1'), MUN)).toBe('/village/mun-1/festival-poster/fp1');
    expect(mentionHref(mention('village', 'v1'), MUN)).toBe('/village/v1');
    expect(mentionHref(mention('news', 'n1'), MUN)).toBe('/news/n1');
  });
});
