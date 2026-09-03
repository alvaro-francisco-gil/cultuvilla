/**
 * Pure geometry for the full-screen image viewer.
 *
 * The viewer's gestures run through `PanResponder`, whose gesture state cannot
 * be driven from jest (same reason `shouldDismissOnRelease` is extracted from
 * `BottomSheet`). Every decision the viewer makes — how far it may pan, where a
 * pinch lands, whether a downward flick dismisses — therefore lives here as a
 * plain function that a unit test can call directly.
 *
 * Coordinates: the origin is the CENTRE of the viewport, matching the
 * `translate` transform applied to a centred image. `Offset` is that translate.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
/** Where a double-tap lands when starting from 1x. */
export const DOUBLE_TAP_SCALE = 3;
/** Two taps closer together than this (ms) count as a double-tap. */
export const DOUBLE_TAP_MS = 280;
/** Downward drag (px) past which releasing dismisses the viewer. */
export const DISMISS_DISTANCE = 110;
/** Downward fling velocity that dismisses regardless of distance. */
export const DISMISS_VELOCITY = 0.7;

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };
export type Point = { x: number; y: number };

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * `contain` the natural image inside the viewport: the whole picture is
 * visible, letterboxed on the axis where it is relatively smaller. Falls back
 * to the viewport when either size is degenerate, so a not-yet-decoded image
 * still produces sane pan bounds instead of NaN.
 */
export function fitSize(natural: Size, viewport: Size): Size {
  const { width: nw, height: nh } = natural;
  const { width: vw, height: vh } = viewport;
  if (nw <= 0 || nh <= 0 || vw <= 0 || vh <= 0) return { width: vw, height: vh };
  const scale = Math.min(vw / nw, vh / nh);
  return { width: nw * scale, height: nh * scale };
}

/**
 * How far the image may be dragged from centre before an edge would come
 * inside the viewport. Zero on an axis the scaled image doesn't overflow —
 * there is nothing hidden to drag into view, so it stays pinned.
 */
export function panBounds(displayed: Size, viewport: Size, scale: number): Offset {
  return {
    x: Math.max(0, (displayed.width * scale - viewport.width) / 2),
    y: Math.max(0, (displayed.height * scale - viewport.height) / 2),
  };
}

export function clampOffset(
  offset: Offset,
  displayed: Size,
  viewport: Size,
  scale: number,
): Offset {
  const bounds = panBounds(displayed, viewport, scale);
  // `+ 0` normalises the -0 that clamping a negative drag to a zero bound
  // produces; -0 is a valid translate but an ugly surprise in assertions.
  return {
    x: Math.min(bounds.x, Math.max(-bounds.x, offset.x)) + 0,
    y: Math.min(bounds.y, Math.max(-bounds.y, offset.y)) + 0,
  };
}

/** A double-tap zooms in from any resting state, and any zoom back out to fit. */
export function nextScaleOnDoubleTap(current: number): number {
  return current > MIN_SCALE + 0.01 ? MIN_SCALE : DOUBLE_TAP_SCALE;
}

export function isDoubleTap(previousTapAt: number, tapAt: number): boolean {
  return previousTapAt > 0 && tapAt - previousTapAt <= DOUBLE_TAP_MS;
}

export function touchDistance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function touchMidpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Scale reached by spreading the fingers from `startDistance` to `distance`. */
export function pinchScale(startScale: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return clampScale(startScale);
  return clampScale((startScale * distance) / startDistance);
}

/**
 * Offset that keeps the content point under `focal` pinned while the scale
 * changes — what makes a pinch grow the picture under the fingers, and a
 * double-tap zoom into the spot that was tapped, rather than always the centre.
 *
 * `focal` is relative to the viewport centre.
 */
export function offsetForScaleAbout(
  focal: Point,
  offset: Offset,
  fromScale: number,
  toScale: number,
): Offset {
  if (fromScale <= 0) return offset;
  const ratio = toScale / fromScale;
  return {
    x: focal.x - (focal.x - offset.x) * ratio,
    y: focal.y - (focal.y - offset.y) * ratio,
  };
}

/**
 * Releasing a downward drag dismisses on a long pull or a fast flick — but only
 * at rest scale. Once zoomed in, a downward drag is panning the picture, and
 * dismissing under the user's finger there would be infuriating.
 */
export function shouldDismissOnRelease(dy: number, vy: number, scale: number): boolean {
  if (scale > MIN_SCALE + 0.01) return false;
  return dy > DISMISS_DISTANCE || vy > DISMISS_VELOCITY;
}

/** Backdrop opacity while dragging down to dismiss: fades out as it goes. */
export function dismissBackdropOpacity(dy: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return 1;
  const progress = Math.min(1, Math.max(0, dy) / viewportHeight);
  return Math.max(0.3, 1 - progress * 1.4);
}
