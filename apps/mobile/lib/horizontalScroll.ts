/**
 * DOM-agnostic helpers for making a horizontal RN-Web `ScrollView`/`FlatList`
 * usable on desktop. Kept free of React and real DOM types so the core logic is
 * unit-testable with a plain fake. The React wiring lives in
 * `components/feature/HorizontalScrollRow.tsx`.
 */

/** The slice of a scrolling DOM node these helpers read/write. */
export interface HScrollNode {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  addEventListener: (
    type: 'wheel' | 'scroll',
    listener: (e: WheelLike) => void,
    options?: { passive?: boolean },
  ) => void;
  removeEventListener: (type: 'wheel' | 'scroll', listener: (e: WheelLike) => void) => void;
}

/** The slice of a WheelEvent these helpers read. */
export interface WheelLike {
  deltaX: number;
  deltaY: number;
  preventDefault: () => void;
}

/** How close to an edge still counts as "at the edge" (sub-pixel rounding slack). */
const EDGE_SLACK = 1;
/** Fraction of the visible width a single arrow click travels. */
const PAGE_FRACTION = 0.85;

/** Which arrows a row should show, given its current scroll position. */
export interface Edges {
  left: boolean;
  right: boolean;
}

/**
 * Whether the row can scroll further left / right from where it is now. A row
 * that doesn't overflow returns `{ left: false, right: false }`.
 */
export function edgeState(
  node: Pick<HScrollNode, 'scrollLeft' | 'clientWidth' | 'scrollWidth'>,
): Edges {
  const maxScroll = node.scrollWidth - node.clientWidth;
  if (maxScroll <= EDGE_SLACK) return { left: false, right: false };
  return {
    left: node.scrollLeft > EDGE_SLACK,
    right: node.scrollLeft < maxScroll - EDGE_SLACK,
  };
}

/**
 * The target `scrollLeft` for one arrow click in `dir`, clamped to the
 * scrollable range so a click never overshoots past an edge.
 */
export function pageScrollTarget(
  node: Pick<HScrollNode, 'scrollLeft' | 'clientWidth' | 'scrollWidth'>,
  dir: 'left' | 'right',
): number {
  const step = node.clientWidth * PAGE_FRACTION;
  const raw = dir === 'right' ? node.scrollLeft + step : node.scrollLeft - step;
  const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
  return Math.max(0, Math.min(raw, maxScroll));
}

/**
 * Translate a vertical mouse wheel into horizontal scrolling on `node`,
 * releasing back to the page once the row is scrolled to its edge. Returns a
 * detach function.
 */
export function attachWheelToHorizontal(node: HScrollNode): () => void {
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
