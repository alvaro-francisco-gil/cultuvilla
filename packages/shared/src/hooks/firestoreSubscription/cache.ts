// Module-scoped shared subscription cache for Firestore listeners.
//
// Multiple subscribers keyed by the same `cacheKey` share a single underlying
// Firestore listener. The cache stores the most recent emitted value so a new
// subscriber arriving after the first emission gets data synchronously.
//
// On the last unsubscribe, the listener is *not* torn down immediately — a
// short debounce gives screen transitions (mount → unmount → remount, e.g.
// tab navigation) a chance to reuse the still-open listener. Any resubscribe
// inside the debounce window cancels the pending close.
//
// Listeners are registered with `listenerManager` so they show up in the same
// global cleanup tracking used by the rest of the codebase — `clearAll()` on
// sign-out tears every entry down before auth flips closed.

import * as listenerManager from '../../services/listenerManager';

export type SubscriptionCallback<T> = (
  value: T | undefined,
  error: Error | null,
) => void;

export type OpenListener<T> = (
  onNext: (value: T) => void,
  onError: (error: Error) => void,
) => () => void;

type CacheEntry<T> = {
  unsubscribe: () => void;
  subscribers: Set<SubscriptionCallback<T>>;
  lastValue: T | undefined;
  lastError: Error | null;
  hasEmitted: boolean;
  closeTimer: ReturnType<typeof setTimeout> | null;
};

export const DEFAULT_CLOSE_DEBOUNCE_MS = 500;

const cache = new Map<string, CacheEntry<unknown>>();

let closeDebounceMs = DEFAULT_CLOSE_DEBOUNCE_MS;

export function subscribe<T>(
  cacheKey: string,
  openListener: OpenListener<T>,
  callback: SubscriptionCallback<T>,
): () => void {
  let entry = cache.get(cacheKey) as CacheEntry<T> | undefined;

  if (!entry) {
    const newEntry: CacheEntry<T> = {
      unsubscribe: () => {},
      subscribers: new Set<SubscriptionCallback<T>>(),
      lastValue: undefined,
      lastError: null,
      hasEmitted: false,
      closeTimer: null,
    };

    const onNext = (value: T) => {
      // The entry may have been deleted from the cache between open and emit
      // (e.g. a synchronous emit after `closeTimer` already fired). Guard.
      const current = cache.get(cacheKey) as CacheEntry<T> | undefined;
      if (!current || current !== newEntry) return;

      current.lastValue = value;
      current.lastError = null;
      current.hasEmitted = true;
      // Snapshot subscribers to a stable array so a subscriber unsubscribing
      // mid-iteration cannot skip a sibling.
      const subs = Array.from(current.subscribers);
      for (const sub of subs) {
        try {
          sub(value, null);
        } catch {
          // Swallow per-subscriber errors so one bad callback can't poison
          // the others or the cache entry.
        }
      }
    };

    const onError = (error: Error) => {
      const current = cache.get(cacheKey) as CacheEntry<T> | undefined;
      if (!current || current !== newEntry) return;

      current.lastError = error;
      current.hasEmitted = true;
      const subs = Array.from(current.subscribers);
      for (const sub of subs) {
        try {
          sub(undefined, error);
        } catch {
          // see onNext
        }
      }
    };

    // Stash the entry before opening the listener so any synchronous
    // emission (e.g. tests) sees a registered entry.
    cache.set(cacheKey, newEntry as CacheEntry<unknown>);

    let rawUnsubscribe: () => void;
    try {
      rawUnsubscribe = openListener(onNext, onError);
    } catch (err) {
      cache.delete(cacheKey);
      const error = err instanceof Error ? err : new Error(String(err));
      try {
        callback(undefined, error);
      } catch {
        // ignore
      }
      return () => {};
    }

    newEntry.unsubscribe = listenerManager.add(
      rawUnsubscribe,
      `firestoreSubscription:${cacheKey}`,
    );

    entry = newEntry;
  } else if (entry.closeTimer) {
    // Another subscriber arrived while debouncing close — cancel it.
    clearTimeout(entry.closeTimer);
    entry.closeTimer = null;
  }

  entry.subscribers.add(callback);

  // Synchronously deliver cached value so newly-mounted consumers don't flash
  // an unnecessary loading state.
  if (entry.hasEmitted) {
    try {
      callback(entry.lastValue, entry.lastError);
    } catch {
      // ignore
    }
  }

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;

    const current = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (!current) return;

    current.subscribers.delete(callback);
    if (current.subscribers.size > 0) return;

    if (current.closeTimer) {
      clearTimeout(current.closeTimer);
    }
    current.closeTimer = setTimeout(() => {
      const stillCurrent = cache.get(cacheKey) as CacheEntry<T> | undefined;
      if (!stillCurrent || stillCurrent !== current) return;
      if (stillCurrent.subscribers.size > 0) {
        stillCurrent.closeTimer = null;
        return;
      }
      try {
        stillCurrent.unsubscribe();
      } catch {
        // ignore
      }
      cache.delete(cacheKey);
    }, closeDebounceMs);
  };
}

// -----------------------------------------------------------------------------
// Test-only helpers — not exported from the package public surface.
// -----------------------------------------------------------------------------

export function _resetCache(): void {
  for (const entry of cache.values()) {
    if (entry.closeTimer) {
      clearTimeout(entry.closeTimer);
      entry.closeTimer = null;
    }
    try {
      entry.unsubscribe();
    } catch {
      // ignore
    }
  }
  cache.clear();
}

export function _getCacheSize(): number {
  return cache.size;
}

export function _setCloseDebounceMs(ms: number | null): void {
  closeDebounceMs = ms ?? DEFAULT_CLOSE_DEBOUNCE_MS;
}

export function _peekEntry(cacheKey: string):
  | {
      subscriberCount: number;
      hasEmitted: boolean;
      lastValue: unknown;
      lastError: Error | null;
      hasCloseTimer: boolean;
    }
  | undefined {
  const entry = cache.get(cacheKey);
  if (!entry) return undefined;
  return {
    subscriberCount: entry.subscribers.size,
    hasEmitted: entry.hasEmitted,
    lastValue: entry.lastValue,
    lastError: entry.lastError,
    hasCloseTimer: entry.closeTimer !== null,
  };
}
