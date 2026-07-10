import { getAnalytics, logEvent, setUserId, setConsent, isSupported } from 'firebase/analytics';
import { getFirebaseApp } from '@cultuvilla/shared/firebase';

// Firebase Analytics is not supported in every environment (e.g. SSR/prerender).
// Guard init so the app never crashes when it's unavailable.
let analytics: ReturnType<typeof getAnalytics> | null = null;
let ready = false;

async function ensureAnalytics(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    if (await isSupported()) {
      analytics = getAnalytics(getFirebaseApp());
      // Consent Mode v2: denied by default until the user opts in.
      setConsent({ analytics_storage: 'denied', ad_storage: 'denied' });
    }
  } catch {
    analytics = null;
  }
}

export function createAnalyticsBackend() {
  void ensureAnalytics();
  return {
    trackEvent: (name: string, params: Record<string, unknown>, userId: string | null) => {
      if (!analytics) return;
      try {
        logEvent(analytics, name, userId ? { ...params, user_id: userId } : params);
      } catch {
        /* fire-and-forget */
      }
    },
    setConsent: (granted: boolean) => {
      try {
        setConsent({ analytics_storage: granted ? 'granted' : 'denied' });
      } catch {
        /* ignore */
      }
    },
    setUserId: (id: string | null) => {
      if (!analytics) return;
      try {
        setUserId(analytics, id);
      } catch {
        /* ignore */
      }
    },
  };
}
