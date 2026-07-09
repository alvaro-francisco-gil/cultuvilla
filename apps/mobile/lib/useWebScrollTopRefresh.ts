import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type FlatList } from 'react-native';

// Overscroll distance (px) required at the top before we refetch. Enough that a
// stray flick doesn't refresh, small enough for one deliberate gesture to fire.
// Shared by both input paths: upward wheel (desktop) and downward drag (touch).
const OVERSCROLL_THRESHOLD = 80;

/**
 * Web-only "overscroll at the top to refresh" gesture.
 *
 * `RefreshControl` is a native-only widget — react-native-web renders it inert,
 * so the feed's pull-to-refresh never fires on the Firebase Hosting build. This
 * attaches listeners to the list's scroll node and re-runs `onRefresh` once the
 * user is already at the very top and keeps overscrolling past a small
 * threshold — via the mouse wheel on desktop (scroll up) and via a finger drag
 * on a phone browser (pull down). Touchscreens never emit `wheel` events, so the
 * touch path is what makes the gesture work on the phone web build, mirroring
 * the browser's own pull-to-refresh that fires on document-scrolling screens.
 * No-op on iOS/Android (there `RefreshControl` handles it).
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

    const fire = () => {
      accumulated = 0;
      firing = true;
      Promise.resolve(onRefreshRef.current()).finally(() => {
        firing = false;
      });
    };

    const onWheel = (e: WheelEvent) => {
      if (firing) return;
      // Only react at the very top, and only to upward intent; any downward
      // wheel (or being scrolled away from the top) resets the accumulator.
      if (node.scrollTop > 0 || e.deltaY >= 0) {
        accumulated = 0;
        return;
      }
      accumulated += -e.deltaY;
      if (accumulated >= OVERSCROLL_THRESHOLD) fire();
    };

    // Touch path (phone web): track a finger drag that starts at the very top
    // and pulls down past the threshold. `tracking` is only armed when the drag
    // begins at scrollTop 0, so a pull-down that starts mid-list never refreshes.
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      tracking = node.scrollTop <= 0 && e.touches.length === 1;
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (firing || !tracking) return;
      // Scrolled away from the top mid-drag → this is a normal scroll, not a pull.
      if (node.scrollTop > 0) {
        tracking = false;
        return;
      }
      const dy = (e.touches[0]?.clientY ?? startY) - startY;
      if (dy >= OVERSCROLL_THRESHOLD) {
        tracking = false;
        fire();
      }
    };
    const onTouchEnd = () => {
      tracking = false;
    };

    node.addEventListener('wheel', onWheel, { passive: true });
    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: true });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
    };
  }, [listRef, enabled]);
}
