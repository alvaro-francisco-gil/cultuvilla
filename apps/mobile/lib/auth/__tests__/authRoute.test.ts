import { resolveAuthRoute, resolveIntentResume } from '../authRoute';

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

describe('resolveIntentResume', () => {
  const base = { user: true, profileChecked: true, hasPersonId: true, pendingIntent: '/event/e1' };

  it('returns the pending intent once the user is authed and onboarded', () => {
    expect(resolveIntentResume(base)).toBe('/event/e1');
  });

  it('returns null while onboarding is incomplete', () => {
    expect(resolveIntentResume({ ...base, hasPersonId: false })).toBeNull();
  });

  it('returns null before the profile fetch settles', () => {
    expect(resolveIntentResume({ ...base, profileChecked: false })).toBeNull();
  });

  it('returns null for a guest', () => {
    expect(resolveIntentResume({ ...base, user: false })).toBeNull();
  });

  it('returns null when there is no pending intent', () => {
    expect(resolveIntentResume({ ...base, pendingIntent: null })).toBeNull();
  });
});
