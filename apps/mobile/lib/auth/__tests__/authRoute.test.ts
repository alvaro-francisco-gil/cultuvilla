import { resolveAuthRoute } from '../authRoute';

describe('resolveAuthRoute', () => {
  it('redirects an authenticated user without a personId into onboarding', () => {
    expect(
      resolveAuthRoute({
        user: true,
        profileChecked: true,
        hasPersonId: false,
        topSegment: '(tabs)',
      }),
    ).toBe('/(onboarding)/complete-profile');
  });

  it('does not bounce a user already inside the onboarding group', () => {
    expect(
      resolveAuthRoute({
        user: true,
        profileChecked: true,
        hasPersonId: false,
        topSegment: '(onboarding)',
      }),
    ).toBeNull();
  });

  // Regression: pressing "Crear perfil" wrote the profile and refreshProfile()
  // flipped needsOnboarding false, but the gate only moved (auth)-group users
  // into (tabs) — never (onboarding)-group users. So the freshly-onboarded user
  // was left sitting on the completed form. The fix must redirect them in.
  it('moves a just-onboarded user out of the onboarding group into (tabs)', () => {
    expect(
      resolveAuthRoute({
        user: true,
        profileChecked: true,
        hasPersonId: true,
        topSegment: '(onboarding)',
      }),
    ).toBe('/(tabs)');
  });

  it('moves an onboarded user off an (auth) screen into (tabs)', () => {
    expect(
      resolveAuthRoute({
        user: true,
        profileChecked: true,
        hasPersonId: true,
        topSegment: '(auth)',
      }),
    ).toBe('/(tabs)');
  });

  it('leaves an onboarded user already in (tabs) alone', () => {
    expect(
      resolveAuthRoute({
        user: true,
        profileChecked: true,
        hasPersonId: true,
        topSegment: '(tabs)',
      }),
    ).toBeNull();
  });
});
