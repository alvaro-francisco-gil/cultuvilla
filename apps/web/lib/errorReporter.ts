// Web error reporter. Crashlytics is mobile-only; the equivalent on web is
// Firebase Analytics' `app_exception` event, which shows up in the Analytics
// dashboard alongside other events. This is intentionally a thin wrapper so we
// can swap in Google Cloud Error Reporting later without touching call sites.

import '@/lib/firebaseInit';
import { getFirebaseApp } from '@cultuvilla/shared/firebase';
import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from 'firebase/analytics';

let analyticsPromise: Promise<Analytics | null> | null = null;

function getAnalyticsLazy(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(getFirebaseApp()) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}

export interface ErrorContext {
  componentStack?: string;
  source?: string;
  extra?: Record<string, unknown>;
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Always log to console so dev sees the full error.
  console.error('[errorReporter]', error, context);

  void getAnalyticsLazy().then((analytics) => {
    if (!analytics) return;
    // 'app_exception' is GA4's reserved event for crashes. Custom params
    // (description, stack, ...) are truncated to 100 chars by GA4; we send the
    // first 100 of each which is enough to identify the error in the dashboard.
    logEvent(analytics, 'app_exception', {
      description: message.slice(0, 100),
      fatal: context.source === 'error-boundary',
      source: context.source ?? 'unknown',
      stack: stack?.slice(0, 100),
      component_stack: context.componentStack?.slice(0, 100),
    });
  });
}
