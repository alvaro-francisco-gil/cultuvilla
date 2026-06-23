export interface StaticMapParams {
  lat: number;
  lng: number;
  zoom?: number;
  w?: number;
  h?: number;
  scale?: number;
}

function assertCoords(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(`lat out of range: ${String(lat)}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(`lng out of range: ${String(lng)}`);
  }
}

/**
 * Builds a Google Static Maps URL centered on the coordinate. No marker pin,
 * and POI/transit features hidden so the map shows no place pins or labels
 * (restaurants, hostels, stations…) — just a clean basemap. Throws RangeError
 * on bad coords. (The Google attribution watermark is required by the Maps
 * Platform Terms and cannot be removed.)
 */
export function buildStaticMapUrl(p: StaticMapParams, apiKey: string): string {
  assertCoords(p.lat, p.lng);
  const zoom = p.zoom ?? 14;
  const w = p.w ?? 600;
  const h = p.h ?? 400;
  const scale = p.scale ?? 2;
  const center = `${String(p.lat)},${String(p.lng)}`;
  const q = new URLSearchParams({
    center,
    zoom: String(zoom),
    size: `${String(w)}x${String(h)}`,
    scale: String(scale),
    key: apiKey,
  });
  // Hide points of interest and transit (icons + labels) for a clutter-free map.
  q.append('style', 'feature:poi|visibility:off');
  q.append('style', 'feature:transit|visibility:off');
  return `https://maps.googleapis.com/maps/api/staticmap?${q.toString()}`;
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return n;
}

/** Parses & validates raw query params. Throws RangeError if lat/lng missing or invalid. */
export function parseStaticMapQuery(query: Record<string, unknown>): StaticMapParams {
  const lat = num(query.lat);
  const lng = num(query.lng);
  if (lat === undefined || lng === undefined) {
    throw new RangeError('lat and lng are required');
  }
  assertCoords(lat, lng);
  const out: StaticMapParams = { lat, lng };
  const zoom = num(query.zoom);
  const w = num(query.w);
  const h = num(query.h);
  const scale = num(query.scale);
  if (zoom !== undefined && Number.isFinite(zoom)) out.zoom = zoom;
  if (w !== undefined && Number.isFinite(w)) out.w = w;
  if (h !== undefined && Number.isFinite(h)) out.h = h;
  if (scale !== undefined && Number.isFinite(scale)) out.scale = scale;
  return out;
}
