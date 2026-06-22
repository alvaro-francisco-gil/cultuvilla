export interface GeocodePlace {
  label: string;
  lat: number;
  lng: number;
}

export function buildGeocodeUrl(query: string, apiKey: string): string {
  const q = new URLSearchParams({ address: query, region: 'es', language: 'es', key: apiKey });
  return `https://maps.googleapis.com/maps/api/geocode/json?${q.toString()}`;
}

interface RawResult {
  formatted_address?: unknown;
  geometry?: { location?: { lat?: unknown; lng?: unknown } };
}

/** Maps a Google Geocoding API response to GeocodePlace[]. Returns [] for any non-OK / malformed shape. */
export function mapGeocodeResponse(json: unknown): GeocodePlace[] {
  if (typeof json !== 'object' || json === null) return [];
  const obj = json as { status?: unknown; results?: unknown };
  if (obj.status !== 'OK' || !Array.isArray(obj.results)) return [];
  const out: GeocodePlace[] = [];
  for (const r of obj.results as RawResult[]) {
    const label = typeof r.formatted_address === 'string' ? r.formatted_address : null;
    const lat = r.geometry?.location?.lat;
    const lng = r.geometry?.location?.lng;
    if (label && typeof lat === 'number' && typeof lng === 'number') {
      out.push({ label, lat, lng });
    }
  }
  return out;
}
