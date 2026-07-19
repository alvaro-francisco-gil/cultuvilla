/**
 * DOM-agnostic helpers for the desktop arrow controls on a horizontal RN-Web
 * `ScrollView`/`FlatList`. Kept free of React and real DOM types so the core
 * logic is unit-testable with a plain fake. The React wiring lives in
 * `components/feature/HorizontalScrollRow.tsx`.
 */

/** The slice of a scrolling DOM node these helpers read. */
export interface HScrollNode {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/** How close to an edge still counts as "at the edge" (sub-pixel rounding slack). */
const EDGE_SLACK = 1;
/** Fraction of the visible width a single arrow click travels. */
const PAGE_FRACTION = 0.85;

/** Which arrows a row should enable, given its current scroll position. */
export interface Edges {
  left: boolean;
  right: boolean;
}

/**
 * Whether the row can scroll further left / right from where it is now. A row
 * that doesn't overflow returns `{ left: false, right: false }`.
 */
export function edgeState(node: HScrollNode): Edges {
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
export function pageScrollTarget(node: HScrollNode, dir: 'left' | 'right'): number {
  const step = node.clientWidth * PAGE_FRACTION;
  const raw = dir === 'right' ? node.scrollLeft + step : node.scrollLeft - step;
  const maxScroll = Math.max(0, node.scrollWidth - node.clientWidth);
  return Math.max(0, Math.min(raw, maxScroll));
}
