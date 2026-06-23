import { httpsCallable } from 'firebase/functions';
import { getFirebaseApp, getFirebaseFunctions } from '../firebase';

export interface GeocodePlace {
  label: string;
  lat: number;
  lng: number;
}

// staticMap is deployed to europe-west1 (see functions/src/maps/staticMap.ts).
const STATIC_MAP_REGION = 'europe-west1';

// Cache-buster: the staticMap responses carry a long Cache-Control, and the URL
// is otherwise identical for a given coordinate. Bump this whenever the map's
// server-side rendering changes (markers, style, size) so clients fetch the new
// image instead of a stale cached one. v2 = no pin + POI/transit hidden.
const STATIC_MAP_VERSION = '2';

/** Absolute URL of the staticMap proxy for a coordinate. Works on web and native (plain <Image> src). */
export function staticMapUrl(
  lat: number,
  lng: number,
  opts: { zoom?: number; w?: number; h?: number; scale?: number } = {},
): string {
  const projectId = getFirebaseApp().options.projectId;
  if (!projectId) throw new Error('staticMapUrl: Firebase projectId is not set');
  const base = `https://${STATIC_MAP_REGION}-${projectId}.cloudfunctions.net/staticMap`;
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (opts.zoom !== undefined) q.set('zoom', String(opts.zoom));
  if (opts.w !== undefined) q.set('w', String(opts.w));
  if (opts.h !== undefined) q.set('h', String(opts.h));
  if (opts.scale !== undefined) q.set('scale', String(opts.scale));
  q.set('v', STATIC_MAP_VERSION);
  return `${base}?${q.toString()}`;
}

const geocodeFn = () =>
  httpsCallable<{ query: string }, { results: GeocodePlace[] }>(getFirebaseFunctions(), 'geocodeSearch');

/** Geocodes a free-text address/town via the server-side proxy. Returns [] on no match. */
export async function geocodeSearch(query: string): Promise<GeocodePlace[]> {
  const res = await geocodeFn()({ query });
  return res.data.results;
}
