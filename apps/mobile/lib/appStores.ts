// Single source of truth for where the native apps live. Fill each URL the day
// that platform's app is actually published; everything that offers a download
// derives from these two strings.
//
// Per-platform on purpose: as of this writing Android is in Play closed testing
// and iOS has not started at all (docs/plans/ongoing/store-release.md), so the
// two will not go live together. An empty string means "no listing yet" and the
// offer for that platform stays dormant — the store banner and /descarga both
// simply omit it.
//
// Both listings exist but neither was publicly reachable when this was written
// (checked 2026-08-29: both URLs below 404 for a logged-out visitor, while a
// control Play listing returns 200). Play is still closed-track, and the App
// Store record is created but unpublished. Paste each URL in once its page
// actually loads — a link to a 404 is worse than no banner at all.
export const APP_STORES: { ios: string; android: string } = {
  ios: '', // https://apps.apple.com/es/app/id6804756586  (ASC_APP_ID repo var)
  android: '', // https://play.google.com/store/apps/details?id=com.cultuvilla.app
};

// True once ANY store listing exists. Gates the /descarga landing page, which
// is a store picker and has nothing to show while both URLs are empty.
export const APP_AVAILABLE = Boolean(APP_STORES.ios || APP_STORES.android);

// Must match `scheme` in apps/mobile/app.config.ts. Used to attempt opening an
// already-installed app before falling back to the store.
export const APP_SCHEME = 'cultuvilla';

// Not wired yet: Safari's native smart app banner (`<meta name="apple-itunes-app"
// content="app-id=...">` in app/+html.tsx) needs the numeric App Store id, which
// does not exist until the iOS app is registered in App Store Connect. Add it
// there alongside filling APP_STORES.ios — Safari renders its own bar above the
// page, so SmartAppBanner should then skip iOS to avoid showing two.
