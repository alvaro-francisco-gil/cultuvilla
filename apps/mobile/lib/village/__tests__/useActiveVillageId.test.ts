import { resolveActiveVillageId } from '../useActiveVillageId';

describe('resolveActiveVillageId', () => {
  it("returns the signed-in user's active village when present", () => {
    expect(resolveActiveVillageId('mun-profile', 'mun-guest')).toBe('mun-profile');
  });

  it('falls back to the guest village when there is no profile village', () => {
    expect(resolveActiveVillageId(null, 'mun-guest')).toBe('mun-guest');
  });

  it('returns null when neither is set', () => {
    expect(resolveActiveVillageId(null, null)).toBeNull();
  });
});
