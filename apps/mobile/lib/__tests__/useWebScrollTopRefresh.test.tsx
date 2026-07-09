import { useRef, type RefObject } from 'react';
import { render } from '@testing-library/react-native';
import { Platform, type FlatList } from 'react-native';

import { useWebScrollTopRefresh } from '../useWebScrollTopRefresh';

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
    wheel: (deltaY: number) => handlers.wheel?.({ deltaY }),
    touchStart: (clientY: number) => handlers.touchstart?.({ touches: [{ clientY }] }),
    touchMove: (clientY: number) => handlers.touchmove?.({ touches: [{ clientY }] }),
    touchEnd: () => handlers.touchend?.({}),
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
  useWebScrollTopRefresh(ref, onRefresh, enabled);
  return null;
}

describe('useWebScrollTopRefresh', () => {
  afterEach(() => setOS(originalOS));

  it('refetches when the accumulated upward wheel at the top passes the threshold', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-100); // one strong scroll-up, past the 80px threshold
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('accumulates several small upward wheels before firing', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-40);
    expect(onRefresh).not.toHaveBeenCalled();
    h.wheel(-50); // 90 total
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a sub-threshold flick', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-50);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('resets the accumulator on any downward wheel', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-50);
    h.wheel(10); // downward intent resets progress
    h.wheel(-50); // only 50 accumulated again
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('never fires when not scrolled to the very top', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    h.setScrollTop(120);
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.wheel(-200);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refetches when a finger drag at the top pulls down past the threshold', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.touchStart(100);
    h.touchMove(190); // pulled down 90px, past the 80px threshold
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a sub-threshold pull-down', () => {
    setOS('web');
    const onRefresh = jest.fn();
    const h = makeNode();
    render(<Probe node={h.node} onRefresh={onRefresh} enabled />);

    h.touchStart(100);
    h.touchMove(150); // only 50px
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
    h.touchMove(300); // big pull, but the drag began mid-list
    expect(onRefresh).not.toHaveBeenCalled();
  });

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
