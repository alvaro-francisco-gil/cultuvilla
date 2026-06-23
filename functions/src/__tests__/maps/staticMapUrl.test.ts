import { describe, it, expect } from 'vitest';
import { buildStaticMapUrl, parseStaticMapQuery } from '../../maps/staticMapUrl';

describe('buildStaticMapUrl', () => {
  it('builds a clean Google Static Maps URL (no marker, POI/transit hidden) with defaults', () => {
    const url = buildStaticMapUrl({ lat: 40.4168, lng: -3.7038 }, 'KEY123');
    expect(url).toContain('https://maps.googleapis.com/maps/api/staticmap?');
    expect(url).toContain('center=40.4168%2C-3.7038');
    expect(url).toContain('zoom=14');
    expect(url).toContain('size=600x400');
    expect(url).toContain('scale=2');
    expect(url).toContain('key=KEY123');
    // No marker pin.
    expect(url).not.toContain('markers');
    // POI and transit hidden.
    expect(url).toContain('style=feature%3Apoi%7Cvisibility%3Aoff');
    expect(url).toContain('style=feature%3Atransit%7Cvisibility%3Aoff');
  });

  it('throws RangeError for out-of-range latitude', () => {
    expect(() => buildStaticMapUrl({ lat: 91, lng: 0 }, 'K')).toThrow(RangeError);
  });

  it('throws RangeError for non-finite longitude', () => {
    expect(() => buildStaticMapUrl({ lat: 0, lng: Number.NaN }, 'K')).toThrow(RangeError);
  });
});

describe('parseStaticMapQuery', () => {
  it('coerces string query params to numbers', () => {
    const p = parseStaticMapQuery({ lat: '40.4', lng: '-3.7', zoom: '12' });
    expect(p).toEqual({ lat: 40.4, lng: -3.7, zoom: 12 });
  });

  it('throws RangeError when lat is missing', () => {
    expect(() => parseStaticMapQuery({ lng: '-3.7' })).toThrow(RangeError);
  });

  it('throws RangeError when lng is missing', () => {
    expect(() => parseStaticMapQuery({ lat: '40.4' })).toThrow(RangeError);
  });

  it('throws RangeError for out-of-range numeric value', () => {
    expect(() => parseStaticMapQuery({ lat: '200', lng: '0' })).toThrow(RangeError);
  });
});
