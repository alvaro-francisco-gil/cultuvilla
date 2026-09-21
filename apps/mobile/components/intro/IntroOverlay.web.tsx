/**
 * No intro on web: web's visitors are mostly people opening a shared link or a
 * search result, and a 4 s animation would stand between them and the page
 * they asked for (see docs/decisions/web-parity-not-a-build-rule.md). This
 * override also keeps lottie-react-native and expo-audio out of the web bundle.
 */
export function IntroOverlay(_props: { appReady: boolean }) {
  return null;
}
