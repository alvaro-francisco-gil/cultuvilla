import { useCallback, useEffect, useRef } from 'react';
import { isWeb } from './platform';

/** The slice of a scrolling DOM node this module needs. Kept minimal so the
 *  core logic is testable with a plain fake instead of a real HTMLElement. */
export interface WheelScrollable {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  addEventListener: (
    type: 'wheel',
    listener: (e: WheelLike) => void,
    options?: { passive?: boolean },
  ) => void;
  removeEventListener: (type: 'wheel', listener: (e: WheelLike) => void) => void;
}

/** The slice of a WheelEvent this module reads. */
export interface WheelLike {
  deltaX: number;
  deltaY: number;
  preventDefault: () => void;
}

/** Anything exposing getScrollableNode() — RN-Web's ScrollView and FlatList both do. */
interface Scrollable {
  getScrollableNode?: () => unknown;
}

/**
 * Translate a vertical mouse wheel into horizontal scrolling on `node`,
 * releasing back to the page once the row is scrolled to its edge. Returns a
 * detach function. Exported for unit tests; app code uses the hook below.
 */
export function attachWheelToHorizontal(node: WheelScrollable): () => void {
  const onWheel = (e: WheelLike) => {
    // Leave horizontal trackpad gestures (deltaX-dominant) to the browser's
    // native handling; only translate the vertical wheel a mouse produces.
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (node.scrollWidth <= node.clientWidth) return; // nothing to scroll
    const atStart = node.scrollLeft <= 0;
    const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
    // At an edge and pushing further out → let the page scroll vertically.
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
    node.scrollLeft += e.deltaY;
    e.preventDefault();
  };
  node.addEventListener('wheel', onWheel, { passive: false });
  return () => node.removeEventListener('wheel', onWheel);
}

/**
 * Desktop-web only: a horizontal RN-Web `ScrollView`/`FlatList` is an
 * `overflow-x` scroller, but a vertical mouse wheel never moves it and — with
 * the scroll indicator hidden — a mouse user has no way to reach the off-screen
 * cards (touch-drag only exists on a phone). This attaches a `wheel` listener
 * that scrolls the row horizontally instead. No-op on native, so iOS/Android
 * keep their native touch behaviour untouched.
 *
 * Spread the returned callback ref onto the list:
 *   `<FlatList ref={useHorizontalWheelScroll()} horizontal … />`
 */
export function useHorizontalWheelScroll<T extends Scrollable>(): (instance: T | null) => void {
  const detach = useRef<(() => void) | null>(null);

  // Detach on unmount so the listener doesn't outlive the row across route changes.
  useEffect(() => () => detach.current?.(), []);

  return useCallback((instance: T | null) => {
    detach.current?.();
    detach.current = null;
    if (!isWeb || !instance) return;
    const node = instance.getScrollableNode?.() as WheelScrollable | undefined;
    if (!node || typeof node.addEventListener !== 'function') return;
    detach.current = attachWheelToHorizontal(node);
  }, []);
}
