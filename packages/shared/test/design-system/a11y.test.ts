import { describe, expect, it } from 'vitest';
import { a11y } from '../../src/design-system/tokens/a11y';

describe('a11y tokens', () => {
  it('minimum touch target is 44 (Apple HIG / WCAG 2.5.5)', () => {
    expect(a11y.minTouchTarget).toBe(44);
  });

  it('default hit slop covers all four edges with the same value', () => {
    expect(a11y.defaultHitSlop).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
  });
});
