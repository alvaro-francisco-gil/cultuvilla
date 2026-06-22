import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import type { GeocodePlace } from '@cultuvilla/shared/services/mapsService';

export interface LocationPickerState {
  coords: LatLng | null;
  query: string;
  results: GeocodePlace[];
  status: 'idle' | 'searching' | 'error';
}

export type LocationAction =
  | { type: 'setQuery'; query: string }
  | { type: 'resultsLoaded'; results: GeocodePlace[] }
  | { type: 'pickResult'; place: GeocodePlace }
  | { type: 'gpsResult'; coords: LatLng }
  | { type: 'searchFailed' }
  | { type: 'clear' };

export function initialLocationState(coords: LatLng | null): LocationPickerState {
  return { coords, query: '', results: [], status: 'idle' };
}

export function locationReducer(state: LocationPickerState, action: LocationAction): LocationPickerState {
  switch (action.type) {
    case 'setQuery':
      return { ...state, query: action.query, status: action.query.trim() === '' ? 'idle' : 'searching' };
    case 'resultsLoaded':
      return { ...state, results: action.results, status: 'idle' };
    case 'pickResult':
      return { ...state, coords: { lat: action.place.lat, lng: action.place.lng }, results: [], query: '', status: 'idle' };
    case 'gpsResult':
      return { ...state, coords: action.coords, results: [], status: 'idle' };
    case 'searchFailed':
      return { ...state, status: 'error', results: [] };
    case 'clear':
      return { ...state, coords: null, results: [], query: '', status: 'idle' };
    default:
      return state;
  }
}
