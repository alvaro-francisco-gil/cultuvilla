import { useRef, type RefObject } from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform, type FlatList } from 'react-native';

import { useWebPullToRefresh } from '../useWebPullToRefresh';

const originalOS = Platform.OS;
function setOS(os: typeof Platform.OS) {
  (Platform as { OS: typeof Platform.OS }).OS = os;
}

type AnyHandler = (e: unknown) => void;

/** A stand-in for the FlatList's scroll DOM node that captures its listeners. */
function makeNode() {
  const handlers: Record<string, AnyHandler | undefined> = {};
  const node = {
    scrollTop: 0,
    addEventListener: (type: string, h: AnyHandler) => {
      handlers[type] = h;
    },
    removeEventListener: jest.fn(),
  };
  return {
    node,
    setScrollTop: (v: number) => {
      node.scrollTop = v;
    },
    wheel: (deltaY: number) => act(() => handlers.wheel?.({ deltaY })),
    touchStart: (clientY: number) => act(() => handlers.touchstart?.({ touches: [{ clientY }] })),
    touchMove: (clientY: number) => act(() => handlers.touchmove?.({ touches: [{ clientY }] })),
    touchEnd: () => act(() => handlers.touchend?.({})),
    hasHandler: () => handlers.wheel !== undefined,
  };
}

function Probe({
  node,
  onRefresh,
  enabled,
}: {
  node: unknown;
  onRefresh: () => void;
  enabled: boolean;
}): null {
  const ref = useRef({ getScrollableNode: () => node }) as unknown as RefObject<FlatList<unknown>>;
  useWebPullToRefresh(ref, onRefresh, enabled);
  return null;
}

describe('useWebPullToRefresh', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    setOS(originalOS);
  });

  // ── wheel (desktop) ──
  it('refetches when the accumulated upward wheel at the top passes the threshold', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-100); // one strong scroll-up, past the 80px threshold
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a sub-threshold upward flick', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-50);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('resets the wheel accumulator on any downward wheel', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-50);
    h.wheel(10); // downward intent resets progress
    h.wheel(-50); // only 50 accumulated again
    expect(onRefresh).not.toHaveBeenCalled();
  });

  // ── touch (phone web) ──
  it('refetches when a finger drag past the threshold is released', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.touchStart(100);
    h.touchMove(220); // dy 120 → 60px visible pull, past the 48px trigger
    expect(onRefresh).not.toHaveBeenCalled(); // fires on release, not mid-drag
    h.touchEnd();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a sub-threshold pull-down', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.touchStart(100);
    h.touchMove(150); // dy 50 → 25px visible pull, below the trigger
    h.touchEnd();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('never fires for a drag that does not start at the very top', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    h.setScrollTop(120);
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.touchStart(100);
    h.touchMove(400); // big pull, but the drag began mid-list
    h.touchEnd();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  // ── platform / lifecycle ──
  it('is inert on native (RefreshControl owns refresh there)', () => {
    setOS('ios');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    expect(h.hasHandler()).toBe(false);
    h.wheel(-200);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not attach until the list is enabled (mounted)', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled={false} />);

    expect(h.hasHandler()).toBe(false);
  });
});
