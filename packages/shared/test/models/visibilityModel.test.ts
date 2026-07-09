import { describe, it, expect } from 'vitest';
import { VisibilityStatusSchema, visibilityFields, defaultVisibility }
  from '../../src/models/core/VisibilityModel';
import { z } from 'zod';

describe('VisibilityModel', () => {
  it('parses active/hidden and rejects legacy review statuses', () => {
    expect(VisibilityStatusSchema.parse('active')).toBe('active');
    expect(VisibilityStatusSchema.parse('hidden')).toBe('hidden');
    expect(() => VisibilityStatusSchema.parse('pending')).toThrow();
  });
  it('defaultVisibility is active with null hide metadata', () => {
    expect(defaultVisibility()).toEqual({
      status: 'active', hiddenBy: null, hiddenAt: null, hiddenReason: null,
    });
  });
  it('visibilityFields compose into a schema', () => {
    const s = z.object({ ...visibilityFields });
    expect(s.parse(defaultVisibility()).status).toBe('active');
  });
});
