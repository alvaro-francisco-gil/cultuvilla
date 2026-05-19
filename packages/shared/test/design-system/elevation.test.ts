import { describe, expect, it } from 'vitest';
import {
  elevation,
  type ElevationLevel,
} from '../../src/design-system/tokens/elevation';

describe('elevation tokens', () => {
  it('exposes none, sm, md', () => {
    expect(Object.keys(elevation).sort()).toEqual(['md', 'none', 'sm']);
  });

  it('each level carries a web boxShadow CSS string', () => {
    for (const e of Object.values(elevation)) {
      expect(typeof e.web).toBe('string');
    }
  });

  it('each level carries an rn descriptor (color/offset/opacity/radius/elevation)', () => {
    for (const e of Object.values(elevation)) {
      expect(typeof e.rn.shadowColor).toBe('string');
      expect(typeof e.rn.shadowOffset.width).toBe('number');
      expect(typeof e.rn.shadowOffset.height).toBe('number');
      expect(typeof e.rn.shadowOpacity).toBe('number');
      expect(typeof e.rn.shadowRadius).toBe('number');
      expect(typeof e.rn.elevation).toBe('number');
    }
  });

  it('none has the expected zero-cost descriptor on both platforms', () => {
    expect(elevation.none.web).toBe('none');
    expect(elevation.none.rn.elevation).toBe(0);
    expect(elevation.none.rn.shadowOpacity).toBe(0);
  });

  it('ElevationLevel accepts known keys', () => {
    const l: ElevationLevel = 'sm';
    expect(elevation[l]).toBeDefined();
  });
});
