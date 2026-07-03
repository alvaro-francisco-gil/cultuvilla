import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type FlatList } from 'react-native';

// Accumulated upward wheel distance (px) required at the top before we refetch.
// Enough that a stray flick doesn't refresh, small enough for one deliberate
// scroll-up to trigger it.
const WHEEL_UP_THRESHOLD = 80;

/**
 * Web-only "scroll up at the top to refresh" gesture.
 *
 * `RefreshControl` is a native-only widget — react-native-web renders it inert,
 * so the feed's pull-to-refresh never fires on the Firebase Hosting build. This
 * attaches a `wheel` listener to the list's scroll node and re-runs `onRefresh`
 * once the user is already at the very top and keeps scrolling up past a small
 * threshold. No-op on iOS/Android (there `RefreshControl` handles it).
 *
 * `enabled` must flip to `true` only once the FlatList is actually mounted —
 * the feed shows a spinner while loading, so the list ref is null until then.
 */
export function useWebScrollTopRefresh<T>(
  listRef: RefObject<FlatList<T> | null>,
  onRefresh: () => void | Promise<void>,
  enabled: boolean,
): void {
  // Keep the latest callback without re-attaching the listener every render.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const node = listRef.current?.getScrollableNode() as HTMLElement | undefined;
    if (!node) return;

    let accumulated = 0;
    let firing = false;

    const onWheel = (e: WheelEvent) => {
      if (firing) return;
      // Only react at the very top, and only to upward intent; any downward
      // wheel (or being scrolled away from the top) resets the accumulator.
      if (node.scrollTop > 0 || e.deltaY >= 0) {
        accumulated = 0;
        return;
      }
      accumulated += -e.deltaY;
      if (accumulated >= WHEEL_UP_THRESHOLD) {
        accumulated = 0;
        firing = true;
        Promise.resolve(onRefreshRef.current()).finally(() => {
          firing = false;
        });
      }
    };

    node.addEventListener('wheel', onWheel, { passive: true });
    return () => node.removeEventListener('wheel', onWheel);
  }, [listRef, enabled]);
}
