// Native default: no-op until @react-native-firebase/analytics + Crashlytics
// are wired at native release. The seam contract is identical to the web impl.
export function createAnalyticsBackend() {
  return {
    trackEvent: (_name: string, _params: Record<string, unknown>, _userId: string | null) => {},
    setConsent: (_granted: boolean) => {},
    setUserId: (_id: string | null) => {},
  };
}
