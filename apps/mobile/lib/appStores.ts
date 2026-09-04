// Single source of truth for where the native apps live. Fill each URL the day
// that platform's app is actually published; everything that offers a download
// derives from these two strings.
//
// Per-platform on purpose: the two did not go live together. An empty string
// means "no listing yet" and the offer for that platform stays dormant — the
// store banner and /descarga both simply omit it.
//
// iOS: 1.0.0 was accepted by App Review on 2026-09-04 and the listing is public.
// Android is still Play closed-track, so `android` stays empty — its listing
// 404s for a logged-out visitor, and a link to a 404 is worse than no banner at
// all. Paste the Play URL in once its page actually loads.
export const APP_STORES: { ios: string; android: string } = {
  ios: 'https://apps.apple.com/es/app/cultuvilla/id6804756586',
  android: '', // https://play.google.com/store/apps/details?id=com.cultuvilla.app
};

// Numeric App Store id (the `ASC_APP_ID` repo var). Safari builds its own smart
// app banner from this via the `apple-itunes-app` meta tag in app/+html.tsx —
// see SmartAppBanner for how the two are kept from stacking.
export const APP_STORE_ID = '6804756586';

// True once ANY store listing exists. Gates the /descarga landing page, which
// is a store picker and has nothing to show while both URLs are empty.
export const APP_AVAILABLE = Boolean(APP_STORES.ios || APP_STORES.android);

// Must match `scheme` in apps/mobile/app.config.ts. Used to attempt opening an
// already-installed app before falling back to the store.
export const APP_SCHEME = 'cultuvilla';
