import { describe, expect, it, vi } from 'vitest';
import { watchMerged, type Unwatch, type WatchError } from '../../src/services/watch';

type Part = (onNext: (rows: number[]) => void, onError: WatchError) => Unwatch;

function part(): { part: Part; emit: (rows: number[]) => void; unwatch: ReturnType<typeof vi.fn> } {
  let next: ((rows: number[]) => void) | undefined;
  const unwatch = vi.fn();
  return {
    part: (onNext) => {
      next = onNext;
      return unwatch;
    },
    emit: (rows) => next?.(rows),
    unwatch,
  };
}

const sortAsc = (rows: number[]) => [...rows].sort((a, b) => a - b);

describe('watchMerged', () => {
  it('waits for every part before the first emission, then re-merges on each update', () => {
    const a = part();
    const b = part();
    const onNext = vi.fn();
    watchMerged([a.part, b.part], sortAsc, onNext, vi.fn());

    a.emit([3, 1]);
    expect(onNext).not.toHaveBeenCalled();
    b.emit([2]);
    expect(onNext).toHaveBeenLastCalledWith([1, 2, 3]);
    a.emit([5]);
    expect(onNext).toHaveBeenLastCalledWith([2, 5]);
  });

  it('emits the empty merge at once when there are no parts', () => {
    const onNext = vi.fn();
    watchMerged<number>([], sortAsc, onNext, vi.fn());
    expect(onNext).toHaveBeenCalledWith([]);
  });

  it('closes every part on unwatch', () => {
    const a = part();
    const b = part();
    watchMerged([a.part, b.part], sortAsc, vi.fn(), vi.fn())();
    expect(a.unwatch).toHaveBeenCalledTimes(1);
    expect(b.unwatch).toHaveBeenCalledTimes(1);
  });
});
