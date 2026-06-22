import { describe, it, expect } from 'vitest';
import { mapGeocodeResponse, buildGeocodeUrl } from '../../maps/geocode';

const SAMPLE = {
  status: 'OK',
  results: [
    {
      formatted_address: 'Abadía, Cáceres, España',
      geometry: { location: { lat: 40.2891, lng: -5.9876 } },
    },
  ],
};

describe('mapGeocodeResponse', () => {
  it('maps Google geocoding results to GeocodePlace[]', () => {
    expect(mapGeocodeResponse(SAMPLE)).toEqual([
      { label: 'Abadía, Cáceres, España', lat: 40.2891, lng: -5.9876 },
    ]);
  });

  it('returns [] when status is not OK or results missing', () => {
    expect(mapGeocodeResponse({ status: 'ZERO_RESULTS', results: [] })).toEqual([]);
    expect(mapGeocodeResponse({})).toEqual([]);
    expect(mapGeocodeResponse(null)).toEqual([]);
  });
});

describe('buildGeocodeUrl', () => {
  it('encodes the query and biases to Spain/Spanish', () => {
    const url = buildGeocodeUrl('Abadía', 'KEY');
    expect(url).toContain('https://maps.googleapis.com/maps/api/geocode/json?');
    expect(url).toContain('address=Abad%C3%ADa');
    expect(url).toContain('region=es');
    expect(url).toContain('language=es');
    expect(url).toContain('key=KEY');
  });
});
