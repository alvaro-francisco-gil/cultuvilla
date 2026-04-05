import { GeoPoint } from 'firebase/firestore';

export type LocationType = 'coordinates' | 'text';

export interface LocationData {
  type: LocationType;
  coordinates: GeoPoint | null;
  text: string | null;
}

export interface LocationDataInput {
  type?: LocationType;
  coordinates?: GeoPoint | null;
  text?: string | null;
}

export function buildLocationData(input: LocationDataInput = {}): LocationData {
  const type = input.type ?? 'text';
  return {
    type,
    coordinates: type === 'coordinates' ? (input.coordinates ?? null) : null,
    text: type === 'text' ? (input.text ?? null) : null,
  };
}
