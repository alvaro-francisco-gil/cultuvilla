import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as listenerManager from '../../src/services/listenerManager';

describe('listenerManager', () => {
  beforeEach(async () => {
    await listenerManager.clearAll();
  });

  it('returns a no-op when given a non-function', () => {
    const unsubscribe = listenerManager.add(undefined, 'invalid');
    expect(listenerManager.count()).toBe(0);
    expect(() => unsubscribe()).not.toThrow();
  });

  it('registers a listener and the returned unsubscribe deregisters + invokes', () => {
    const raw = vi.fn();
    const unsubscribe = listenerManager.add(raw, 'a');
    expect(listenerManager.count()).toBe(1);

    unsubscribe();
    expect(raw).toHaveBeenCalledTimes(1);
    expect(listenerManager.count()).toBe(0);
  });

  it('swallows errors from raw unsubscribers so unmount paths never throw', () => {
    const raw = vi.fn(() => {
      throw new Error('boom');
    });
    const unsubscribe = listenerManager.add(raw, 'b');
    expect(() => unsubscribe()).not.toThrow();
    expect(listenerManager.count()).toBe(0);
  });

  it('removeByLabel kills every entry sharing that label', () => {
    const a1 = vi.fn();
    const a2 = vi.fn();
    const b = vi.fn();
    listenerManager.add(a1, 'shared');
    listenerManager.add(a2, 'shared');
    listenerManager.add(b, 'other');

    listenerManager.removeByLabel('shared');
    expect(a1).toHaveBeenCalledTimes(1);
    expect(a2).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(listenerManager.count()).toBe(1);
  });

  it('clearAll tears down every active listener', async () => {
    const raws = [vi.fn(), vi.fn(), vi.fn()];
    raws.forEach((r, i) => listenerManager.add(r, `l${i}`));
    expect(listenerManager.count()).toBe(3);

    await listenerManager.clearAll();
    raws.forEach((r) => expect(r).toHaveBeenCalledTimes(1));
    expect(listenerManager.count()).toBe(0);
  });
});
