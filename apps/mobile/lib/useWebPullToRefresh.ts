import { useEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Platform, type FlatList } from 'react-native';

// ── feel constants (tune these to taste) ──
// Upward wheel distance (px) required at the top before a desktop refresh fires.
const WHEEL_UP_THRESHOLD = 80;
// Finger travel is damped into visible pull so the content rubber-bands rather
// than tracking 1:1, then capped so it can't be dragged arbitrarily far.
const DAMPING = 0.5;
const MAX_PULL = 96;
// Visible pull (px) that must be reached before releasing triggers a refresh.
const PULL_TRIGGER = 48;
// Where the content settles while the refetch runs.
const REST_OFFSET = 56;
// Keep the spinner up at least this long so an instant refetch still registers.
const MIN_VISIBLE_MS = 600;

/**
 * Web-only pull-to-refresh for the feed lists.
 *
 * `RefreshControl` is a native-only widget — react-native-web renders it inert,
 * so the feed's pull-to-refresh never fires on the Firebase Hosting build, and
 * (unlike a document-scrolling page) the browser's own pull-to-refresh can't
 * reach a list nested inside scrollers. This drives the gesture in-app:
 *
 * - **Touch (phone web):** a finger drag that starts at the very top follows the
 *   finger (damped), and on release past {@link PULL_TRIGGER} settles at a rest
 *   offset, runs `onRefresh`, then springs back. Touchscreens never emit `wheel`.
 * - **Wheel (desktop web):** scrolling up past {@link WHEEL_UP_THRESHOLD} while
 *   already at the top fires the same refresh (no finger to follow).
 *
 * Returns an animated `translateY` the caller applies to the list wrapper (so
 * the cards move with the pull) and a `refreshing` flag for the spinner. No-op
 * on iOS/Android, where `RefreshControl` owns refresh — there `translateY`
 * stays 0 and `refreshing` stays false.
 *
 * `enabled` must flip to `true` only once the FlatList is actually mounted —
 * the feed shows a spinner while loading, so the list ref is null until then.
 *
 * Transforms are interpolated on JS (`useNativeDriver: false`): the web build
 * mishandles native-driven transforms (see the mobile-web-compat notes).
 */
export function useWebPullToRefresh<T>(
  listRef: RefObject<FlatList<T> | null>,
  onRefresh: () => void | Promise<void>,
  enabled: boolean,
): { translateY: Animated.Value; refreshing: boolean } {
  // Keep the latest callback without re-attaching listeners every render.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const translateY = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);
  // Mirror of `refreshing` readable synchronously inside the DOM handlers.
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const node = listRef.current?.getScrollableNode() as HTMLElement | undefined;
    if (!node) return;

    const springBack = () => {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 4,
        speed: 14,
      }).start();
    };

    const runRefresh = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      Animated.timing(translateY, {
        toValue: REST_OFFSET,
        duration: 160,
        useNativeDriver: false,
      }).start();
      const started = Date.now();
      Promise.resolve(onRefreshRef.current())
        .catch(() => undefined)
        .finally(() => {
          const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - started));
          setTimeout(() => {
            refreshingRef.current = false;
            setRefreshing(false);
            springBack();
          }, wait);
        });
    };

    // ── wheel (desktop) ──
    let accumulated = 0;
    const onWheel = (e: WheelEvent) => {
      if (refreshingRef.current) return;
      if (node.scrollTop > 0 || e.deltaY >= 0) {
        accumulated = 0;
        return;
      }
      accumulated += -e.deltaY;
      if (accumulated >= WHEEL_UP_THRESHOLD) {
        accumulated = 0;
        runRefresh();
      }
    };

    // ── touch (phone web) ──
    // `tracking` is armed only when the drag begins at scrollTop 0, so a
    // pull-down that starts mid-list scrolls normally and never refreshes.
    let startY = 0;
    let tracking = false;
    let pulled = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      tracking = node.scrollTop <= 0 && e.touches.length === 1;
      startY = e.touches[0]?.clientY ?? 0;
      pulled = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (refreshingRef.current || !tracking) return;
      if (node.scrollTop > 0) {
        tracking = false;
        translateY.setValue(0);
        return;
      }
      const dy = (e.touches[0]?.clientY ?? startY) - startY;
      pulled = dy <= 0 ? 0 : Math.min(dy * DAMPING, MAX_PULL);
      translateY.setValue(pulled);
    };
    const onTouchEnd = () => {
      if (refreshingRef.current || !tracking) return;
      tracking = false;
      if (pulled >= PULL_TRIGGER) runRefresh();
      else springBack();
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
  }, [listRef, enabled, translateY]);

  return { translateY, refreshing };
}
