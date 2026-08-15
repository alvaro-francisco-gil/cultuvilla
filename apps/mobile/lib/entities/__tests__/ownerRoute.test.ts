import { ownerRoute } from '../ownerRoute';

describe('ownerRoute', () => {
  it('sends a credited user to their profile screen', () => {
    expect(ownerRoute('user', 'u1')).toBe('/user/u1');
  });

  it('sends a credited organization to its detail screen', () => {
    expect(ownerRoute('organization', 'o1')).toBe('/o/o1');
  });

  it('sends a persona to the person detail screen, not the edit form', () => {
    expect(ownerRoute('person', 'p1')).toBe('/person/p1');
  });
});
