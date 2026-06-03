import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  subscribe,
  _resetCache,
  _getCacheSize,
  _setCloseDebounceMs,
  _peekEntry,
} from '../../src/hooks/firestoreSubscription/cache';

describe('firestoreSubscription cache', () => {
  beforeEach(() => {
    _resetCache();
    vi.useFakeTimers();
    _setCloseDebounceMs(50);
  });

  afterEach(() => {
    _resetCache();
    vi.useRealTimers();
    _setCloseDebounceMs(null);
  });

  it('opens exactly one underlying listener for multiple subscribers on the same key', () => {
    const opener = vi.fn(() => () => {});
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    subscribe('k', opener, cb1);
    subscribe('k', opener, cb2);

    expect(opener).toHaveBeenCalledTimes(1);
    expect(_peekEntry('k')?.subscriberCount).toBe(2);
  });

  it('delivers each emission to every subscriber', () => {
    let emit: ((v: number) => void) | undefined;
    const opener = vi.fn<(onNext: (v: number) => void) => () => void>((onNext) => {
      emit = onNext;
      return () => {};
    });
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    subscribe<number>('k', opener, cb1);
    subscribe<number>('k', opener, cb2);
    emit?.(42);

    expect(cb1).toHaveBeenCalledWith(42, null);
    expect(cb2).toHaveBeenCalledWith(42, null);
  });

  it('synchronously delivers the cached value to a late-arriving subscriber', () => {
    let emit: ((v: number) => void) | undefined;
    const opener = vi.fn<(onNext: (v: number) => void) => () => void>((onNext) => {
      emit = onNext;
      return () => {};
    });
    subscribe<number>('k', opener, vi.fn());
    emit?.(7);

    const lateCb = vi.fn();
    subscribe<number>('k', opener, lateCb);
    expect(lateCb).toHaveBeenCalledWith(7, null);
    expect(opener).toHaveBeenCalledTimes(1);
  });

  it('debounces teardown so an unmount/remount inside the window keeps the listener open', () => {
    const teardown = vi.fn();
    const opener = vi.fn(() => teardown);

    const unsub1 = subscribe('k', opener, vi.fn());
    unsub1();

    expect(_peekEntry('k')?.hasCloseTimer).toBe(true);
    expect(teardown).not.toHaveBeenCalled();

    subscribe('k', opener, vi.fn());

    expect(opener).toHaveBeenCalledTimes(1);
    expect(_peekEntry('k')?.hasCloseTimer).toBe(false);
    expect(teardown).not.toHaveBeenCalled();
  });

  it('tears the listener down after the debounce when no subscribers return', () => {
    const teardown = vi.fn();
    const opener = vi.fn(() => teardown);

    const unsub = subscribe('k', opener, vi.fn());
    unsub();
    vi.advanceTimersByTime(50);

    expect(teardown).toHaveBeenCalledTimes(1);
    expect(_getCacheSize()).toBe(0);
  });

  it('isolates per-subscriber callback errors', () => {
    let emit: ((v: number) => void) | undefined;
    const opener = vi.fn<(onNext: (v: number) => void) => () => void>((onNext) => {
      emit = onNext;
      return () => {};
    });
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();

    subscribe<number>('k', opener, bad);
    subscribe<number>('k', opener, good);
    expect(() => emit?.(1)).not.toThrow();
    expect(good).toHaveBeenCalledWith(1, null);
  });

  it('reports a synchronous open() failure via the callback and does not retain the entry', () => {
    const opener = vi.fn(() => {
      throw new Error('open failed');
    });
    const cb = vi.fn();

    const unsub = subscribe('k', opener, cb);
    expect(cb).toHaveBeenCalledWith(undefined, expect.any(Error));
    expect(_getCacheSize()).toBe(0);
    // Returned unsubscribe is safe to call.
    expect(() => { unsub(); }).not.toThrow();
  });
});
