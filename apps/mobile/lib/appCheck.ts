// Mobile App Check is wired here when product is ready to roll out.
// Per-env opt-in (debug provider on dev, real attestation on beta/prod).
// Until then, this is a no-op so the rest of the app boots without App Check.
//
// To enable: install @react-native-firebase/app-check (or the managed
// Expo equivalent), then in initMobileAppCheck() call the provider for
// DeviceCheck (iOS) / Play Integrity (Android) when an env-specific
// site key / token provider is configured.
//
// See docs/plans/ready/app-check-rollout.md for the
// per-env opt-in pattern.
export function initMobileAppCheck(): void {
  // intentionally empty
}
