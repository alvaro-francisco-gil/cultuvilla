import {
  attachWheelToHorizontal,
  edgeState,
  pageScrollTarget,
  type HScrollNode,
  type WheelLike,
} from './horizontalScroll';

/** A fake scrollable DOM node with a single captured `wheel` listener. */
function makeNode(over: Partial<HScrollNode> = {}) {
  let listener: ((e: WheelLike) => void) | null = null;
  const node = {
    scrollLeft: 0,
    clientWidth: 300,
    scrollWidth: 900, // overflows → horizontally scrollable
    addEventListener: (_type: 'wheel' | 'scroll', l: (e: WheelLike) => void) => {
      listener = l;
    },
    removeEventListener: (_type: 'wheel' | 'scroll', l: (e: WheelLike) => void) => {
      if (listener === l) listener = null;
    },
    ...over,
  } as HScrollNode;
  const fire = (delta: Partial<WheelLike>) => {
    const e: WheelLike = { deltaX: 0, deltaY: 0, preventDefault: jest.fn(), ...delta };
    listener?.(e);
    return e;
  };
  return { node, fire, hasListener: () => listener !== null };
}

describe('attachWheelToHorizontal', () => {
  it('translates a vertical wheel into horizontal scroll and prevents the page scroll', () => {
    const { node, fire } = makeNode();
    attachWheelToHorizontal(node);
    const e = fire({ deltaY: 120 });
    expect(node.scrollLeft).toBe(120);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('leaves horizontal trackpad gestures (deltaX-dominant) to the browser', () => {
    const { node, fire } = makeNode();
    attachWheelToHorizontal(node);
    const e = fire({ deltaX: 80, deltaY: 10 });
    expect(node.scrollLeft).toBe(0);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('does nothing when the row does not overflow', () => {
    const { node, fire } = makeNode({ scrollWidth: 300, clientWidth: 300 });
    attachWheelToHorizontal(node);
    const e = fire({ deltaY: 120 });
    expect(node.scrollLeft).toBe(0);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('releases to the page when scrolling up at the start edge', () => {
    const { node, fire } = makeNode({ scrollLeft: 0 });
    attachWheelToHorizontal(node);
    const e = fire({ deltaY: -120 });
    expect(node.scrollLeft).toBe(0);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('releases to the page when scrolling down at the end edge', () => {
    const { node, fire } = makeNode({ scrollLeft: 600 }); // 600 + 300 === 900 (scrollWidth)
    attachWheelToHorizontal(node);
    const e = fire({ deltaY: 120 });
    expect(node.scrollLeft).toBe(600);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('detaches the listener', () => {
    const { node, hasListener } = makeNode();
    const detach = attachWheelToHorizontal(node);
    expect(hasListener()).toBe(true);
    detach();
    expect(hasListener()).toBe(false);
  });
});

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
