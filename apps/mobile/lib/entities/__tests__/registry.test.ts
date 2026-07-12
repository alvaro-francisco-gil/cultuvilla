import { ENTITY_FALLBACK_ICON } from '../registry';

describe('entity registry', () => {
  it('maps every entity kind to a fallback icon', () => {
    expect(ENTITY_FALLBACK_ICON).toEqual({
      event: 'calendar-outline',
      festivalPoster: 'image-outline',
      place: 'location-outline',
      barrio: 'map-outline',
      organization: 'people-outline',
      news: 'newspaper-outline',
    });
  });
});
