/**
 * Walker functions that translate between Firestore SDK shapes and schema shapes.
 *
 * Reads:  Timestamp instance -> Date;  GeoPoint instance -> { lat, lng }.
 * Writes: Date instance      -> Timestamp;  { lat, lng } object -> GeoPoint.
 *
 * Convention: an object with EXACTLY two numeric keys `lat` and `lng` is
 * treated as a coordinate on writes. Do not introduce non-coordinate objects
 * with this shape elsewhere in the codebase.
 */

export interface SdkCtors {
  TimestampFromDate: (d: Date) => unknown;
  GeoPointFrom: (lat: number, lng: number) => unknown;
  isTimestamp: (v: unknown) => v is { toDate(): Date };
  isGeoPoint: (v: unknown) => v is { latitude: number; longitude: number };
}

export function normalize(value: unknown, sdk: SdkCtors): unknown {
  if (value === null || value === undefined) return value;
  if (sdk.isTimestamp(value)) return value.toDate();
  if (sdk.isGeoPoint(value)) return { lat: value.latitude, lng: value.longitude };
  if (Array.isArray(value)) return value.map((v) => normalize(v, sdk));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v, sdk);
    return out;
  }
  return value;
}

function isLatLng(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.lat !== 'number' || typeof o.lng !== 'number') return false;
  for (const k of Object.keys(o)) {
    if (k !== 'lat' && k !== 'lng' && o[k] !== undefined) return false;
  }
  return true;
}

export function denormalize(value: unknown, sdk: SdkCtors): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return sdk.TimestampFromDate(value);
  if (isLatLng(value)) return sdk.GeoPointFrom(value.lat, value.lng);
  if (Array.isArray(value)) return value.map((v) => denormalize(v, sdk));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = denormalize(v, sdk);
    return out;
  }
  return value;
}
