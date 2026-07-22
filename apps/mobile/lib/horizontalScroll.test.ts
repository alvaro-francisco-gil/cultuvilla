import { animateScrollLeft, edgeState, pageScrollTarget } from './horizontalScroll';

describe('edgeState', () => {
  it('shows only the right arrow at the start', () => {
    expect(edgeState({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 })).toEqual({
      left: false,
      right: true,
    });
  });

  it('shows both arrows in the middle', () => {
    expect(edgeState({ scrollLeft: 300, clientWidth: 300, scrollWidth: 900 })).toEqual({
      left: true,
      right: true,
    });
  });

  it('shows only the left arrow at the end', () => {
    expect(edgeState({ scrollLeft: 600, clientWidth: 300, scrollWidth: 900 })).toEqual({
      left: true,
      right: false,
    });
  });

  it('shows no arrows when the row does not overflow', () => {
    expect(edgeState({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toEqual({
      left: false,
      right: false,
    });
  });
});

describe('pageScrollTarget', () => {
  const node = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 };

  it('advances by ~85% of the visible width to the right', () => {
    expect(pageScrollTarget(node, 'right')).toBeCloseTo(255); // 300 * 0.85
  });

  it('clamps to the max scroll instead of overshooting the end', () => {
    expect(pageScrollTarget({ ...node, scrollLeft: 500 }, 'right')).toBe(600); // max = 900 - 300
  });

  it('clamps to 0 instead of overshooting the start', () => {
    expect(pageScrollTarget({ ...node, scrollLeft: 100 }, 'left')).toBe(0);
  });
});

describe('animateScrollLeft', () => {
  it('reaches the page target through direct scrollLeft assignments', () => {
    const node = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 };
    const frames: Array<(timestamp: number) => void> = [];

    animateScrollLeft(node, 255, {
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame: jest.fn(),
    });

    frames.shift()?.(0);
    expect(node.scrollLeft).toBe(0);
    frames.shift()?.(320);
    expect(node.scrollLeft).toBe(255);
  });
});
