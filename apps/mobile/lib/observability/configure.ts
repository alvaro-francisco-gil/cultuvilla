import { Platform } from 'react-native';
import {
  configureObservability,
  observability,
  OBSERVABILITY_EVENTS,
  type ObservabilityAdapter,
  type UserContext,
} from '@cultuvilla/shared';
import { createAnalyticsBackend } from './analytics';
import { sendClientError } from './errorBridge';
import { attachGlobalHandlers } from './globalHandlers';

let booted = false;

function toErrorPayload(error: unknown, context: Record<string, unknown>): Record<string, unknown> {
  const e = error instanceof Error ? error : new Error(String(error));
  return {
    message: e.message,
    name: e.name,
    stack: e.stack,
    platform: Platform.OS,
    ...context,
  };
}

// The analytics user id is the (later hashed) uid; AuthContext supplies the hash
// via setUserContext once fetchUserIdHash resolves.
function userIdOf(user: UserContext): string {
  return user.uid;
}

export function bootstrapObservability(): void {
  if (booted) return;
  booted = true;

  const analytics = createAnalyticsBackend();

  const adapter: ObservabilityAdapter = {
    trackEvent: (name, params, user) => analytics.trackEvent(name, params, user ? userIdOf(user) : null),
    captureError: (error, context) => {
      // Both sinks (design decision): Cloud Logging for diagnosis + an
      // analytics event for funnel/impact correlation.
      void sendClientError(toErrorPayload(error, context));
      analytics.trackEvent(OBSERVABILITY_EVENTS.APP_EXCEPTION, context, null);
    },
    log: (_level, _msg, _fields) => {
      // Client structured logs currently ride the error bridge only for errors;
      // info/warn are dev-console today. Native Crashlytics breadcrumbs later.
    },
    setUserContext: (user) => analytics.setUserId(user ? userIdOf(user) : null),
    setConsent: (consent) => analytics.setConsent(consent.analytics),
  };

  configureObservability(adapter);
  // Analytics is enabled app-wide with no per-session consent prompt: the Terms of
  // Use + Privacy Policy — accepted via the single registration checkbox — cover
  // usage analytics (Google Analytics for Firebase is named in the Privacy Policy).
  // Granted once at boot; pre-registration/guest sessions are included by design.
  observability.setConsent({ analytics: true });
  attachGlobalHandlers();
}
