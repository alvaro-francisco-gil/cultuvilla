import { fitLabel, MIN_LABEL_SCALE } from '../fitFontSize';

describe('fitLabel', () => {
  it('keeps the base size while unmeasured', () => {
    expect(fitLabel(null, 100, 16)).toEqual({ fontSize: 16, fitsOneLine: true });
    expect(fitLabel(120, null, 16)).toEqual({ fontSize: 16, fitsOneLine: true });
  });

  it('keeps the base size when the label already fits', () => {
    expect(fitLabel(80, 100, 16)).toEqual({ fontSize: 16, fitsOneLine: true });
    expect(fitLabel(100, 100, 16)).toEqual({ fontSize: 16, fitsOneLine: true });
  });

  it('shrinks by the overflow ratio so the label stays on one line', () => {
    // 120pt of text in 90pt of space -> 75% -> exactly at the floor.
    expect(fitLabel(120, 90, 16)).toEqual({ fontSize: 12, fitsOneLine: true });
    expect(fitLabel(100, 90, 20)).toEqual({ fontSize: 18, fitsOneLine: true });
  });

  it('stops at the floor and wraps rather than shrinking further', () => {
    const { fontSize, fitsOneLine } = fitLabel(200, 100, 16);
    expect(fontSize).toBe(16 * MIN_LABEL_SCALE);
    // Below the floor the caller must allow a second line — never an ellipsis.
    expect(fitsOneLine).toBe(false);
  });

  it('ignores degenerate measurements', () => {
    expect(fitLabel(0, 100, 16)).toEqual({ fontSize: 16, fitsOneLine: true });
    expect(fitLabel(100, 0, 16)).toEqual({ fontSize: 16, fitsOneLine: true });
  });
});
