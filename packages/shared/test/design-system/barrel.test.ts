import { describe, expect, it } from 'vitest';
import * as ds from '../../src/design-system';

describe('design-system barrel', () => {
  it('re-exports spacing, typography, colors, radii, elevation, zIndex, a11y, iconSizes', () => {
    expect(ds.spacing).toBeDefined();
    expect(ds.typography).toBeDefined();
    expect(ds.colors).toBeDefined();
    expect(ds.radii).toBeDefined();
    expect(ds.elevation).toBeDefined();
    expect(ds.zIndex).toBeDefined();
    expect(ds.a11y).toBeDefined();
    expect(ds.iconSizes).toBeDefined();
  });
});
