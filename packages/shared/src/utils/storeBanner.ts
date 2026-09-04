/** A mobile platform we have a store listing for. */
export type StorePlatform = 'ios' | 'android';

/**
 * Which app store, if any, this browser's visitor should be offered.
 *
 * User-agent sniffing is unreliable in general, but the question here is narrow
 * ("which store listing would even install on this device?") and there is no
 * standard API that answers it. `navigator.userAgentData` does not help: it is
 * Chromium-only, so it is absent on exactly the platform that needs the most
 * care (Safari).
 *
 * Returns `null` for desktop and for anything unrecognised — the banner is an
 * offer, so the safe failure is to stay silent rather than to send a Windows
 * visitor to the App Store.
 *
 * @param userAgent `navigator.userAgent`
 * @param maxTouchPoints `navigator.maxTouchPoints` — load-bearing, see below
 */
export function resolveStorePlatform(
  userAgent: string | null | undefined,
  maxTouchPoints: number,
): StorePlatform | null {
  if (!userAgent) return null;

  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';

  // iPadOS 13+ ships the *desktop* Safari user agent by default, so an iPad is
  // indistinguishable from a Mac by UA alone. The one signal that separates
  // them is touch: Macs report 0 touch points, iPads report 5. Scope this to
  // Macintosh — touchscreen Windows laptops report touch points too, and are
  // not iPads.
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';

  // "Windows Phone" UAs also carry an "Android" token for compatibility, so the
  // Android check has to exclude them explicitly. Android tablets omit the
  // "Mobile" token but still install from Play, so we deliberately don't
  // require it.
  if (/Android/.test(userAgent) && !/Windows Phone/.test(userAgent)) return 'android';

  return null;
}

/** Persisted record of the last time the visitor dismissed the store banner. */
export interface StoreBannerDismissal {
  /** Epoch millis at which the banner was dismissed. */
  dismissedAt: number;
}

/** Days to stay quiet after the visitor dismisses the banner. */
export const STORE_BANNER_DISMISS_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is the banner still suppressed by an earlier dismissal?
 *
 * Dismissal is a cooldown rather than a permanent opt-out: someone who says
 * "not now" in June may well want the app in July, and there is no account to
 * hang a durable preference off (the banner shows to signed-out visitors too).
 *
 * Compares the *absolute* distance so that a clock skewed into the future — or
 * a record copied between devices — cannot strand the banner as dismissed for
 * longer than the cooldown itself.
 */
export function isStoreBannerDismissed(
  record: StoreBannerDismissal | null,
  now: number,
  cooldownDays: number = STORE_BANNER_DISMISS_DAYS,
): boolean {
  if (!record || !Number.isFinite(record.dismissedAt)) return false;
  return Math.abs(now - record.dismissedAt) < cooldownDays * DAY_MS;
}

/**
 * Will *this* browser draw Apple's own smart app banner for us?
 *
 * Safari on iOS renders a native install bar from the `apple-itunes-app` meta
 * tag, above the page and outside our control. Where it does, our own banner is
 * a second bar saying the same thing, so we stand down. Where it does not —
 * Chrome/Firefox/Edge on iOS, and every in-app webview (a link opened from
 * Instagram or WhatsApp, which is how most shared village links get opened) —
 * the meta tag does nothing and our banner is the only offer there is.
 *
 * The caller is responsible for having already established that this is iOS;
 * this answers only the Safari-vs-everything-else half.
 *
 * Detected by exclusion rather than by matching "Safari", because every iOS
 * browser is WebKit and carries a "Safari" token in its UA. What distinguishes
 * the real one is the *absence* of a wrapper's marker: the alternative browsers
 * add a vendor token (CriOS, FxiOS, EdgiOS, OPiOS), and in-app webviews add
 * their app's name while dropping the "Version/" token that genuine Safari
 * always sends. Unknown wrappers therefore fall through to "not Safari", which
 * is the safe way to be wrong: a redundant banner, never a missing one.
 */
export function rendersNativeSmartBanner(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  // Alternative iOS browsers: each adds a vendor token.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)) return false;
  // Named in-app webviews. Android's `wv` token and Facebook's FB_IAB/FBAN are
  // here so the answer stays right off iOS too, rather than relying on the
  // caller to only ask about iPhones.
  if (/; wv\)|FB_IAB|FBAN|FBAV|Instagram|Line\/|MicroMessenger/.test(userAgent)) return false;
  // Genuine Safari always sends a `Version/` token; unnamed webviews do not.
  return /Version\/\d/.test(userAgent) && /Safari/.test(userAgent);
}
