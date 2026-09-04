import {
  DISMISS_DISTANCE,
  DISMISS_VELOCITY,
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SCALE,
  MAX_SCALE,
  MIN_SCALE,
  clampOffset,
  clampScale,
  dismissBackdropOpacity,
  fitSize,
  isDoubleTap,
  nextScaleOnDoubleTap,
  offsetForScaleAbout,
  panBounds,
  pinchScale,
  shouldDismissOnRelease,
  touchDistance,
  touchMidpoint,
} from '../imageZoom';

const VIEWPORT = { width: 400, height: 800 };

describe('clampScale', () => {
  it('keeps the scale between fit and the maximum', () => {
    expect(clampScale(0.2)).toBe(MIN_SCALE);
    expect(clampScale(2.5)).toBe(2.5);
    expect(clampScale(99)).toBe(MAX_SCALE);
  });

  it('falls back to fit for a degenerate scale', () => {
    expect(clampScale(Number.NaN)).toBe(MIN_SCALE);
  });
});

describe('fitSize', () => {
  it('letterboxes a landscape image inside a portrait viewport', () => {
    expect(fitSize({ width: 2000, height: 1000 }, VIEWPORT)).toEqual({ width: 400, height: 200 });
  });

  it('pillarboxes a portrait image taller than the viewport', () => {
    expect(fitSize({ width: 1000, height: 4000 }, VIEWPORT)).toEqual({ width: 200, height: 800 });
  });

  it('falls back to the viewport before the image has decoded', () => {
    expect(fitSize({ width: 0, height: 0 }, VIEWPORT)).toEqual(VIEWPORT);
  });
});

describe('panBounds', () => {
  const displayed = { width: 400, height: 200 };

  it('is zero at rest — a fitted image has nothing hidden to drag in', () => {
    expect(panBounds(displayed, VIEWPORT, 1)).toEqual({ x: 0, y: 0 });
  });

  it('opens up only on the axis the scaled image overflows', () => {
    // 2x: width 800 overflows 400 by 400 (±200); height 400 still fits in 800.
    expect(panBounds(displayed, VIEWPORT, 2)).toEqual({ x: 200, y: 0 });
  });
});

describe('clampOffset', () => {
  const displayed = { width: 400, height: 200 };

  it('pins a fitted image to the centre', () => {
    expect(clampOffset({ x: 120, y: -90 }, displayed, VIEWPORT, 1)).toEqual({ x: 0, y: 0 });
  });

  it('stops the drag at the image edge', () => {
    expect(clampOffset({ x: 500, y: 0 }, displayed, VIEWPORT, 2)).toEqual({ x: 200, y: 0 });
    expect(clampOffset({ x: -500, y: 0 }, displayed, VIEWPORT, 2)).toEqual({ x: -200, y: 0 });
  });

  it('leaves an in-bounds drag untouched', () => {
    expect(clampOffset({ x: 50, y: 0 }, displayed, VIEWPORT, 2)).toEqual({ x: 50, y: 0 });
  });
});

describe('nextScaleOnDoubleTap', () => {
  it('zooms in from rest', () => {
    expect(nextScaleOnDoubleTap(MIN_SCALE)).toBe(DOUBLE_TAP_SCALE);
  });

  it('returns to fit from any zoomed state', () => {
    expect(nextScaleOnDoubleTap(1.4)).toBe(MIN_SCALE);
    expect(nextScaleOnDoubleTap(MAX_SCALE)).toBe(MIN_SCALE);
  });
});

describe('isDoubleTap', () => {
  it('pairs two taps inside the window', () => {
    expect(isDoubleTap(1000, 1000 + DOUBLE_TAP_MS - 1)).toBe(true);
  });

  it('rejects a slow second tap', () => {
    expect(isDoubleTap(1000, 1000 + DOUBLE_TAP_MS + 1)).toBe(false);
  });

  it('rejects the very first tap', () => {
    expect(isDoubleTap(0, 1000)).toBe(false);
  });
});

describe('pinch helpers', () => {
  it('measures distance and midpoint between two touches', () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(touchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });

  it('scales proportionally to how far the fingers spread', () => {
    expect(pinchScale(1, 100, 200)).toBe(2);
    expect(pinchScale(2, 100, 50)).toBe(1);
  });

  it('clamps a spread that would overshoot the maximum', () => {
    expect(pinchScale(2, 100, 1000)).toBe(MAX_SCALE);
  });

  it('survives a zero start distance', () => {
    expect(pinchScale(1.5, 0, 200)).toBe(1.5);
  });
});

describe('offsetForScaleAbout', () => {
  it('keeps the point under the fingers pinned while zooming in', () => {
    // Focal 100px right of centre, zooming 1x -> 2x: that content point must
    // stay put, so the image shifts left by the same 100px.
    expect(offsetForScaleAbout({ x: 100, y: 0 }, { x: 0, y: 0 }, 1, 2)).toEqual({ x: -100, y: 0 });
  });

  it('is a no-op when the focal point is the current offset', () => {
    expect(offsetForScaleAbout({ x: 40, y: 40 }, { x: 40, y: 40 }, 1, 3)).toEqual({ x: 40, y: 40 });
  });
});

describe('shouldDismissOnRelease', () => {
  it('dismisses on a long pull down', () => {
    expect(shouldDismissOnRelease(DISMISS_DISTANCE + 1, 0, 1)).toBe(true);
  });

  it('dismisses on a fast flick even when short', () => {
    expect(shouldDismissOnRelease(20, DISMISS_VELOCITY + 0.1, 1)).toBe(true);
  });

  it('springs back on a short, slow drag', () => {
    expect(shouldDismissOnRelease(20, 0.1, 1)).toBe(false);
  });

  it('never dismisses while zoomed in — that drag is a pan', () => {
    expect(shouldDismissOnRelease(500, 3, 2)).toBe(false);
  });
});

describe('dismissBackdropOpacity', () => {
  it('is opaque at rest and fades as the drag grows', () => {
    expect(dismissBackdropOpacity(0, 800)).toBe(1);
    expect(dismissBackdropOpacity(400, 800)).toBeLessThan(1);
    expect(dismissBackdropOpacity(800, 800)).toBe(0.3);
  });

  it('ignores an upward drag', () => {
    expect(dismissBackdropOpacity(-200, 800)).toBe(1);
  });
});
