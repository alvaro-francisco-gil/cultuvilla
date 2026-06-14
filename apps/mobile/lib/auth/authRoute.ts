export type AuthRouteHref = '/(onboarding)/complete-profile' | '/(tabs)';

export interface AuthRouteInput {
  /** Is there an authenticated Firebase user. */
  user: boolean;
  /** Has the profile fetch settled (so `hasPersonId` is meaningful). */
  profileChecked: boolean;
  /** Does the loaded profile have a linked personId (i.e. onboarding done). */
  hasPersonId: boolean;
  /** First expo-router segment, e.g. '(auth)' | '(onboarding)' | '(tabs)'. */
  topSegment: string | undefined;
}

/**
 * Single source of truth for post-auth routing. Returns the href to redirect
 * to, or null to render the current stack as-is.
 *
 * Kept pure (no expo-router imports) so the routing rules are unit-testable
 * without mounting the navigator.
 */
export function resolveAuthRoute({
  user,
  profileChecked,
  hasPersonId,
  topSegment,
}: AuthRouteInput): AuthRouteHref | null {
  const needsOnboarding = user && profileChecked && !hasPersonId;
  const inOnboardingGroup = topSegment === '(onboarding)';
  const inAuthGroup = topSegment === '(auth)';

  if (needsOnboarding && !inOnboardingGroup) {
    return '/(onboarding)/complete-profile';
  }
  // Authenticated + fully onboarded users should never be left sitting on an
  // /(auth) or /(onboarding) screen. Covering the onboarding group is what
  // moves a user into the app the instant their freshly-created profile loads.
  if (user && !needsOnboarding && (inAuthGroup || inOnboardingGroup)) {
    return '/(tabs)';
  }
  return null;
}
