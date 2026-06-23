import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import type { GeocodePlace } from '@cultuvilla/shared/services/mapsService';

export interface LocationPickerState {
  coords: LatLng | null;
  query: string;
  results: GeocodePlace[];
  status: 'idle' | 'searching' | 'error';
  /** True when `query` holds a committed selection (picked result, GPS, or the
   *  seeded value) rather than something the user is typing. Suppresses the
   *  geocode search so a chosen label doesn't immediately re-trigger results. */
  selected: boolean;
}

export type LocationAction =
  | { type: 'setQuery'; query: string }
  | { type: 'resultsLoaded'; results: GeocodePlace[] }
  | { type: 'pickResult'; place: GeocodePlace }
  | { type: 'gpsResult'; coords: LatLng }
  | { type: 'searchFailed' }
  | { type: 'clear' };

/** Human-ish text for a raw coordinate (used when there's no place label). */
export function coordLabel(c: LatLng): string {
  return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
}

export function initialLocationState(coords: LatLng | null): LocationPickerState {
  return {
    coords,
    query: coords ? coordLabel(coords) : '',
    results: [],
    status: 'idle',
    selected: coords != null,
  };
}

export function locationReducer(state: LocationPickerState, action: LocationAction): LocationPickerState {
  switch (action.type) {
    case 'setQuery':
      return {
        ...state,
        query: action.query,
        selected: false,
        status: action.query.trim() === '' ? 'idle' : 'searching',
      };
    case 'resultsLoaded':
      return { ...state, results: action.results, status: 'idle' };
    case 'pickResult':
      return {
        ...state,
        coords: { lat: action.place.lat, lng: action.place.lng },
        results: [],
        query: action.place.label,
        selected: true,
        status: 'idle',
      };
    case 'gpsResult':
      return {
        ...state,
        coords: action.coords,
        results: [],
        query: coordLabel(action.coords),
        selected: true,
        status: 'idle',
      };
    case 'searchFailed':
      return { ...state, status: 'error', results: [] };
    case 'clear':
      return { ...state, coords: null, results: [], query: '', selected: false, status: 'idle' };
    default:
      return state;
  }
}
