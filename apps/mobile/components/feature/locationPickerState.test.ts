import { initialLocationState, locationReducer } from './locationPickerState';

const base = initialLocationState(null);

describe('locationReducer', () => {
  it('setQuery updates query and marks searching', () => {
    const s = locationReducer(base, { type: 'setQuery', query: 'Aba' });
    expect(s.query).toBe('Aba');
    expect(s.status).toBe('searching');
  });

  it('resultsLoaded stores results and returns to idle', () => {
    const s = locationReducer(base, {
      type: 'resultsLoaded',
      results: [{ label: 'Abadía', lat: 40.2, lng: -5.9 }],
    });
    expect(s.results).toHaveLength(1);
    expect(s.status).toBe('idle');
  });

  it('pickResult sets coords and clears the result list', () => {
    const withResults = locationReducer(base, {
      type: 'resultsLoaded',
      results: [{ label: 'Abadía', lat: 40.2, lng: -5.9 }],
    });
    const s = locationReducer(withResults, { type: 'pickResult', place: { label: 'Abadía', lat: 40.2, lng: -5.9 } });
    expect(s.coords).toEqual({ lat: 40.2, lng: -5.9 });
    expect(s.results).toHaveLength(0);
  });

  it('gpsResult sets coords', () => {
    const s = locationReducer(base, { type: 'gpsResult', coords: { lat: 1, lng: 2 } });
    expect(s.coords).toEqual({ lat: 1, lng: 2 });
  });

  it('clear resets coords to null', () => {
    const withCoords = locationReducer(base, { type: 'gpsResult', coords: { lat: 1, lng: 2 } });
    expect(locationReducer(withCoords, { type: 'clear' }).coords).toBeNull();
  });

  it('searchFailed sets error status', () => {
    expect(locationReducer(base, { type: 'searchFailed' }).status).toBe('error');
  });

  it('seeds initial coords', () => {
    expect(initialLocationState({ lat: 1, lng: 2 }).coords).toEqual({ lat: 1, lng: 2 });
  });
});
