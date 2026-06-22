# Pueblo location map + "Cómo llegar" + organizer location picker

## Goal

Show where a pueblo is on a map in its info modal, with a "Cómo llegar" button that opens Google Maps directions — and replace the raw lat/lng text inputs in the organizer settings with a real location picker so coordinates actually get filled in.

## Context

A village's location lives on the municipality document as `coordinates: LatLng | null` ([packages/shared/src/models/municipality/MunicipalityDataModel.ts](../../../packages/shared/src/models/municipality/MunicipalityDataModel.ts), `LatLng = { lat: number; lng: number }` from [packages/shared/src/models/core/LocationDataModel.ts](../../../packages/shared/src/models/core/LocationDataModel.ts)). It is **nullable and almost never set**: a dev Firestore query found that of 6,186 municipalities (the full INE reference dataset), only 3 have coordinates — and those 3 are seeded fixtures whose coords are hand-set in [scripts/seed/villages.mjs](../../../scripts/seed/villages.mjs). The INE import creates the field as `null`; coordinates are only ever introduced by an organizer.

Today that introduction happens through two raw lat/lng **text inputs** in [apps/mobile/components/feature/CommunitySettingsEditor.tsx](../../../apps/mobile/components/feature/CommunitySettingsEditor.tsx) (placeholders `40.4168` / `-3.7038`) — a non-starter for real organizers. So a map in the info modal would be blank for essentially everyone until the entry experience is fixed.

Constraints that shaped the design:
- `apps/mobile/` ships **both** as a native dev-client and as a web build on Firebase Hosting. `react-native-maps` does not run on RN-Web — so the map must be a plain `<Image>` that renders identically on both targets.
- The repo leans hard on server-side guardrails; a billable Google key must not ship to clients.

## Design / approach

Three client touchpoints, two new Cloud Functions, one new native dependency. The Google API key never leaves the server.

### Cloud Functions (new, `functions/src/maps/`)

Both gen-2, region `us-central1`, reading the key via `defineSecret('GOOGLE_MAPS_API_KEY')` (Secret Manager). Logging follows the repo convention `logger.info(msg, { handler, ...fields })`.

- **`staticMap`** (`onRequest`): `?lat=&lng=&zoom=&w=&h=&scale=` → proxies the Google Static Maps PNG bytes with a long `Cache-Control`. Validates finite `lat ∈ [-90,90]`, `lng ∈ [-180,180]`; bad params → `400`. Serves **both** the info-modal map and the picker preview. Chosen over generate-on-save-and-store because it needs no Storage writes, no Firestore trigger, and no regeneration-on-change logic; per-view cost is negligible at this scale and responses are CDN/`Cache-Control`-cacheable.
- **`geocodeSearch`** (`onCall`): `{ query }` → `[{ label, lat, lng }]` via Google Geocoding/Places. Validates a non-empty trimmed `query` (`HttpsError('invalid-argument')`); on Google error returns `[]` and logs. Backs the picker search box.

### Info modal (read path) — [apps/mobile/components/feature/VillageInfoModal.tsx](../../../apps/mobile/components/feature/VillageInfoModal.tsx)

- `village.coordinates` present → render a map card below the name/escudo row: `<Image source={{ uri: staticMapUrl(lat, lng) }}>` (fixed aspect, rounded like the gallery images) with a pin marker, and below it a full-width **"Cómo llegar"** pressable → `Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=LAT,LNG')`. Tapping the map itself also triggers it.
- `village.coordinates` null → no map block. Managers reach the editor via the existing "Editar" button, so no special prompt is needed in the modal.
- Image fails to load → the `<Image>` shows its rounded placeholder background; the "Cómo llegar" button still works (it needs only the coords, not the tile).

`Linking` import follows the established pattern (`import { Linking } from 'react-native'`; `await Linking.openURL(...)` in try/catch, as in [apps/mobile/components/feature/UserMenuModal.tsx](../../../apps/mobile/components/feature/UserMenuModal.tsx)).

### Location picker (write path) — [apps/mobile/components/feature/CommunitySettingsEditor.tsx](../../../apps/mobile/components/feature/CommunitySettingsEditor.tsx)

Replaces the two `<Input>` coordinate fields (lines 174–182) with a `<LocationPicker>` component holding `coords: LatLng | null`:

- **Search**: type → debounced `geocodeSearch({ query })` → result list → pick sets `coords`.
- **GPS**: "Usar mi ubicación actual" → `Location.requestForegroundPermissionsAsync()` → `getCurrentPositionAsync()` → sets `coords`. Permission denied / unavailable → `showAlert` with a friendly message (web-safe via the existing `showAlert` helper; on web `expo-location` falls back to the browser geolocation API).
- **Preview + confirm**: once `coords` set, show the `staticMap` image of it + a "Quitar ubicación" affordance that clears back to `null`.
- **Save**: the existing `save()` writes `coordinates` (the candidate `coords`) through `updateMunicipality`. The old `parseCoordinates` / `invalidCoordinates` validation path is **removed** — coords now always come from a valid source.

### Native config — [apps/mobile/app.config.ts](../../../apps/mobile/app.config.ts)

- Add `expo-location` to deps + the `plugins` array with permission copy; iOS `infoPlist.NSLocationWhenInUseUsageDescription`. This triggers a native rebuild (`expo-native-rebuild` skill).
- Create `GOOGLE_MAPS_API_KEY` in Secret Manager, bind it to the two functions, and restrict the GCP key to the Static Maps + Geocoding APIs.

### i18n — [packages/i18n/messages/es.json](../../../packages/i18n/messages/es.json)

- Add `village.info.directions` = "Cómo llegar".
- Under `village.admin.community`: `location` = "Ubicación", plus `searchPlaceholder`, `useMyLocation`, `removeLocation`, `locationPermissionDenied`, `searchFailed`.
- Remove now-unused `latitude` / `longitude` / `invalidCoordinates` keys; repurpose `coordinates` → `location`.

### Testing

- `geocodeSearch`: vitest emulator harness in `functions/` — empty/whitespace query → `invalid-argument`; valid query maps Google's response to `[{label, lat, lng}]`; Google failure → `[]`. The Google HTTP call is stubbed (no live key in CI).
- `staticMap`: unit-test the param-validation + URL-builder as a pure function (lat/lng bounds, zoom/size defaults; out-of-range → 400). The fetch is thin and mocked.
- `LocationPicker`: test the candidate-coords reducer logic (search-pick sets coords, "quitar" clears to null, GPS result sets coords) — extracted so it's testable without rendering native modules.
- Info modal: render smoke only (coords present → map block renders; null → absent).

## Out of scope

- **No backfill** of the ~6,183 null-coordinate municipalities. The map simply stays absent until an organizer sets the location. (Rejected during brainstorming in favor of "picker only".)
- **No interactive pan/zoom map.** Static image only — driven by the web + native cross-target constraint. (Rejected: react-native-maps native + web fallback, and WebView embed.)
- **No map on event/place detail screens.** This plan covers the pueblo info modal only.
- **No client-side / restricted-client key.** All Google calls proxy through Cloud Functions. (Rejected: restricted client key, and hybrid.)

## Open questions

None — resolved during brainstorming (see "Out of scope" for the rejected alternatives).

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks that touch `packages/shared/src/services/` must follow the `touch-service` skill; the new Cloud Functions follow `cloud-function-logging`; the `expo-location` install follows `expo-native-rebuild`; deploying functions follows `firestore-deploy`.

**Goal:** Render a static map of a pueblo in its info modal with a "Cómo llegar" button, and replace the raw lat/lng inputs in the organizer editor with a search + GPS location picker — keeping the Google API key server-side.

**Architecture:** Two new Cloud Functions in `functions/src/maps/` proxy Google (`staticMap` onRequest streams Static Maps PNGs; `geocodeSearch` onCall returns geocoded places), both reading the key from `defineSecret('GOOGLE_MAPS_API_KEY')`. A shared `mapsService` exposes a `staticMapUrl()` URL builder and a `geocodeSearch()` callable wrapper. The mobile `LocationPicker` (pure reducer + component) drives coordinate entry; `VillageInfoModal` renders the map + directions button.

**Tech Stack:** Firebase Functions gen 2 (Node 22, global `fetch`), `firebase-functions/params` secrets, Google Static Maps + Geocoding APIs, Expo SDK 56 / React Native, `expo-location`, vitest.

## Global Constraints

- Node runtime **22**; gen-2 functions only (`firebase-functions/v2/*`). `fetch` is the Node 22 global — do not add a fetch polyfill.
- `onCall` functions use region **`us-central1`** (matches the client `DEFAULT_FUNCTIONS_REGION`); the `staticMap` `onRequest` uses **`europe-west1`** (closer to Spanish users; reached via an explicit URL, so region independence is fine).
- Cloud Function logging: `logger.info(msg, { handler, ...fields })` with a `const handler = '<fnName>'` — never `console.*` (the no-console test fails the build).
- The Google key lives **only** in `defineSecret('GOOGLE_MAPS_API_KEY')`; never returned to clients, never in a client bundle.
- `LatLng = { lat: number; lng: number }` from `@cultuvilla/shared/models/core/LocationDataModel`; coordinates stored on the municipality doc as `coordinates: LatLng | null`.
- All user-facing strings via `useT()` / i18n keys (`i18n-add-string` skill); no hardcoded Spanish in app components.
- Web-safe dialogs: use `showAlert` from `apps/mobile/lib/dialogs`, never `Alert.alert` directly (`mobile-web-compat`).

## File Structure

**Create:**
- `functions/src/maps/staticMapUrl.ts` — pure: validate params + build the Google Static Maps URL.
- `functions/src/maps/staticMap.ts` — `onRequest` handler streaming the PNG.
- `functions/src/maps/geocode.ts` — pure: map Google Geocoding JSON → `GeocodePlace[]`.
- `functions/src/maps/geocodeSearch.ts` — `onCall` handler.
- `functions/src/maps/secret.ts` — the shared `defineSecret` instance.
- `functions/src/__tests__/maps/staticMapUrl.test.ts`, `.../maps/geocode.test.ts`, `.../maps/geocodeSearch.test.ts`.
- `packages/shared/src/services/mapsService.ts` — `staticMapUrl()` + `geocodeSearch()` + `GeocodePlace`.
- `apps/mobile/components/feature/locationPickerState.ts` — pure reducer.
- `apps/mobile/components/feature/locationPickerState.test.ts` — reducer tests.
- `apps/mobile/components/feature/LocationPicker.tsx` — the picker component.

**Modify:**
- `functions/src/index.ts` — export the two functions.
- `packages/shared/src/services/index.ts` (+ services map, per `touch-service`) — re-export `mapsService`.
- `packages/i18n/messages/es.json` — add/rename keys.
- `apps/mobile/app.config.ts` — `expo-location` plugin + iOS `infoPlist`.
- `apps/mobile/package.json` — `expo-location` dep (via `npx expo install`).
- `apps/mobile/components/feature/CommunitySettingsEditor.tsx` — swap lat/lng inputs for `<LocationPicker>`, drop `parseCoordinates`.
- `apps/mobile/components/feature/VillageInfoModal.tsx` — map card + "Cómo llegar".

---

## Stage 1 — Cloud Functions (Google proxy, key server-side)

### Task 1: Static-map URL builder + validation

**Files:**
- Create: `functions/src/maps/staticMapUrl.ts`
- Test: `functions/src/__tests__/maps/staticMapUrl.test.ts`

**Interfaces:**
- Produces: `interface StaticMapParams { lat: number; lng: number; zoom?: number; w?: number; h?: number; scale?: number }`; `function buildStaticMapUrl(p: StaticMapParams, apiKey: string): string` (throws `RangeError` on out-of-range/non-finite lat/lng); `function parseStaticMapQuery(q: Record<string, unknown>): StaticMapParams` (coerces query strings, throws `RangeError` on bad input).

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/__tests__/maps/staticMapUrl.test.ts
import { describe, it, expect } from 'vitest';
import { buildStaticMapUrl, parseStaticMapQuery } from '../../maps/staticMapUrl';

describe('buildStaticMapUrl', () => {
  it('builds a Google Static Maps URL with a red marker and defaults', () => {
    const url = buildStaticMapUrl({ lat: 40.4168, lng: -3.7038 }, 'KEY123');
    expect(url).toContain('https://maps.googleapis.com/maps/api/staticmap?');
    expect(url).toContain('center=40.4168%2C-3.7038');
    expect(url).toContain('zoom=14');
    expect(url).toContain('size=600x400');
    expect(url).toContain('scale=2');
    expect(url).toContain('markers=color%3Ared%7C40.4168%2C-3.7038');
    expect(url).toContain('key=KEY123');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && pnpm vitest run src/__tests__/maps/staticMapUrl.test.ts`
Expected: FAIL — cannot find module `../../maps/staticMapUrl`.

- [ ] **Step 3: Write the implementation**

```ts
// functions/src/maps/staticMapUrl.ts
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
    throw new RangeError(`lat out of range: ${lat}`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(`lng out of range: ${lng}`);
  }
}

/** Builds a Google Static Maps URL with a red pin at the coordinate. Throws RangeError on bad coords. */
export function buildStaticMapUrl(p: StaticMapParams, apiKey: string): string {
  assertCoords(p.lat, p.lng);
  const zoom = p.zoom ?? 14;
  const w = p.w ?? 600;
  const h = p.h ?? 400;
  const scale = p.scale ?? 2;
  const center = `${p.lat},${p.lng}`;
  const q = new URLSearchParams({
    center,
    zoom: String(zoom),
    size: `${w}x${h}`,
    scale: String(scale),
    markers: `color:red|${center}`,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${q.toString()}`;
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? Number.NaN : n;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && pnpm vitest run src/__tests__/maps/staticMapUrl.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/maps/staticMapUrl.ts functions/src/__tests__/maps/staticMapUrl.test.ts
git commit -m "feat(functions): add static-map URL builder + query parser"
```

### Task 2: `staticMap` onRequest handler + secret + export

**Files:**
- Create: `functions/src/maps/secret.ts`, `functions/src/maps/staticMap.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `buildStaticMapUrl`, `parseStaticMapQuery` (Task 1).
- Produces: `const GOOGLE_MAPS_API_KEY` (defineSecret); `const staticMap` (onRequest, region `europe-west1`).

- [ ] **Step 1: Write the secret module**

```ts
// functions/src/maps/secret.ts
import { defineSecret } from 'firebase-functions/params';

/** Google Maps Platform key — used by staticMap and geocodeSearch. Server-side only. */
export const GOOGLE_MAPS_API_KEY = defineSecret('GOOGLE_MAPS_API_KEY');
```

- [ ] **Step 2: Write the handler**

```ts
// functions/src/maps/staticMap.ts
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GOOGLE_MAPS_API_KEY } from './secret';
import { buildStaticMapUrl, parseStaticMapQuery } from './staticMapUrl';

/**
 * Proxies Google Static Maps so the API key never reaches the client.
 * Loaded directly as an <Image> source. Long Cache-Control: a pueblo's
 * coordinates rarely change and the tile for a coord is immutable.
 */
export const staticMap = onRequest(
  { region: 'europe-west1', cors: true, secrets: [GOOGLE_MAPS_API_KEY], memory: '256MiB', maxInstances: 10 },
  async (req, res) => {
    const handler = 'staticMap';
    let params;
    try {
      params = parseStaticMapQuery(req.query as Record<string, unknown>);
    } catch (err) {
      logger.info('staticMap bad request', { handler, err: err instanceof Error ? err.message : String(err) });
      res.status(400).set('Content-Type', 'text/plain').send('Bad Request');
      return;
    }
    try {
      const upstream = await fetch(buildStaticMapUrl(params, GOOGLE_MAPS_API_KEY.value()));
      if (!upstream.ok) {
        logger.error('staticMap upstream error', { handler, status: upstream.status });
        res.status(502).set('Content-Type', 'text/plain').send('Bad Gateway');
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res
        .status(200)
        .set('Content-Type', upstream.headers.get('content-type') ?? 'image/png')
        .set('Cache-Control', 'public, max-age=86400, s-maxage=604800')
        .send(buf);
    } catch (err) {
      logger.error('staticMap failed', { handler, err: err instanceof Error ? err.message : String(err) });
      res.status(500).set('Content-Type', 'text/plain').send('Internal Server Error');
    }
  },
);
```

- [ ] **Step 3: Export from index**

Add to `functions/src/index.ts` after the OG export:

```ts
// Maps (Google Static Maps proxy + geocoding — key stays server-side)
export { staticMap } from './maps/staticMap';
```

- [ ] **Step 4: Typecheck + lint (no test — thin I/O wrapper, logic is Task 1)**

Run: `cd functions && pnpm typecheck && pnpm lint`
Expected: PASS (in particular the no-console lint passes — we used `logger`).

- [ ] **Step 5: Commit**

```bash
git add functions/src/maps/secret.ts functions/src/maps/staticMap.ts functions/src/index.ts
git commit -m "feat(functions): add staticMap proxy for Google Static Maps"
```

### Task 3: Geocoding response mapper

**Files:**
- Create: `functions/src/maps/geocode.ts`
- Test: `functions/src/__tests__/maps/geocode.test.ts`

**Interfaces:**
- Produces: `interface GeocodePlace { label: string; lat: number; lng: number }`; `function mapGeocodeResponse(json: unknown): GeocodePlace[]`; `function buildGeocodeUrl(query: string, apiKey: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/__tests__/maps/geocode.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && pnpm vitest run src/__tests__/maps/geocode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// functions/src/maps/geocode.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && pnpm vitest run src/__tests__/maps/geocode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/maps/geocode.ts functions/src/__tests__/maps/geocode.test.ts
git commit -m "feat(functions): add geocoding response mapper + URL builder"
```

### Task 4: `geocodeSearch` onCall handler + export

**Files:**
- Create: `functions/src/maps/geocodeSearch.ts`
- Test: `functions/src/__tests__/maps/geocodeSearch.test.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**
- Consumes: `GOOGLE_MAPS_API_KEY` (Task 2), `mapGeocodeResponse`, `buildGeocodeUrl`, `GeocodePlace` (Task 3).
- Produces: `const geocodeSearch` (onCall, region `us-central1`). Input `{ query: string }`, output `{ results: GeocodePlace[] }`.

- [ ] **Step 1: Write the failing test** (validation + mapping, with `fetch` stubbed)

```ts
// functions/src/__tests__/maps/geocodeSearch.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

// The handler reads the secret via .value(); stub the params module.
vi.mock('../../maps/secret', () => ({ GOOGLE_MAPS_API_KEY: { value: () => 'TEST_KEY' } }));

import { runGeocodeSearch } from '../../maps/geocodeSearch';

afterEach(() => vi.restoreAllMocks());

describe('runGeocodeSearch', () => {
  it('throws invalid-argument for empty/whitespace query', async () => {
    await expect(runGeocodeSearch('   ')).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('returns mapped results on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [{ formatted_address: 'Abadía', geometry: { location: { lat: 40.2, lng: -5.9 } } }],
      }),
    })) as unknown as typeof fetch);
    const results = await runGeocodeSearch('Abadía');
    expect(results).toEqual([{ label: 'Abadía', lat: 40.2, lng: -5.9 }]);
  });

  it('returns [] when Google responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch);
    expect(await runGeocodeSearch('Abadía')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && pnpm vitest run src/__tests__/maps/geocodeSearch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation** (testable core `runGeocodeSearch` + thin `onCall` wrapper)

```ts
// functions/src/maps/geocodeSearch.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { GOOGLE_MAPS_API_KEY } from './secret';
import { buildGeocodeUrl, mapGeocodeResponse, type GeocodePlace } from './geocode';

const handler = 'geocodeSearch';

/** Core logic, separated from the onCall envelope so it is unit-testable. */
export async function runGeocodeSearch(query: unknown): Promise<GeocodePlace[]> {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new HttpsError('invalid-argument', 'query requerido.');
  }
  const resp = await fetch(buildGeocodeUrl(query.trim(), GOOGLE_MAPS_API_KEY.value()));
  if (!resp.ok) {
    logger.error('geocodeSearch upstream error', { handler, status: resp.status });
    return [];
  }
  const results = mapGeocodeResponse(await resp.json());
  logger.info('geocode search', { handler, count: results.length });
  return results;
}

interface GeocodeSearchData {
  query?: string;
}

export const geocodeSearch = onCall<GeocodeSearchData, Promise<{ results: GeocodePlace[] }>>(
  { region: 'us-central1', cors: true, secrets: [GOOGLE_MAPS_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const results = await runGeocodeSearch(request.data?.query);
    return { results };
  },
);
```

- [ ] **Step 4: Export from index** — add below the `staticMap` export:

```ts
export { geocodeSearch } from './maps/geocodeSearch';
```

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `cd functions && pnpm vitest run src/__tests__/maps/geocodeSearch.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS (3 tests; no-console lint clean).

- [ ] **Step 6: Commit**

```bash
git add functions/src/maps/geocodeSearch.ts functions/src/__tests__/maps/geocodeSearch.test.ts functions/src/index.ts
git commit -m "feat(functions): add geocodeSearch callable"
```

---

## Stage 2 — Shared client helpers

### Task 5: `mapsService` (URL builder + callable wrapper)

**Files:**
- Create: `packages/shared/src/services/mapsService.ts`
- Modify: `packages/shared/src/services/index.ts` (+ services map — follow the `touch-service` skill)

**Interfaces:**
- Consumes: `getFirebaseApp`, `getFirebaseFunctions` from `../firebase`; `httpsCallable` from `firebase/functions`.
- Produces: `interface GeocodePlace { label: string; lat: number; lng: number }`; `function staticMapUrl(lat: number, lng: number, opts?: { zoom?: number; w?: number; h?: number; scale?: number }): string`; `async function geocodeSearch(query: string): Promise<GeocodePlace[]>`.

- [ ] **Step 1: Write the implementation** (follow `touch-service` conventions; no separate unit test — `staticMapUrl` is a URL concatenation verified by the functions-side tests and exercised by the picker/modal)

```ts
// packages/shared/src/services/mapsService.ts
import { httpsCallable } from 'firebase/functions';
import { getFirebaseApp, getFirebaseFunctions } from '../firebase';

export interface GeocodePlace {
  label: string;
  lat: number;
  lng: number;
}

// staticMap is deployed to europe-west1 (see functions/src/maps/staticMap.ts).
const STATIC_MAP_REGION = 'europe-west1';

/** Absolute URL of the staticMap proxy for a coordinate. Works on web and native (plain <Image> src). */
export function staticMapUrl(
  lat: number,
  lng: number,
  opts: { zoom?: number; w?: number; h?: number; scale?: number } = {},
): string {
  const projectId = getFirebaseApp().options.projectId;
  const base = `https://${STATIC_MAP_REGION}-${projectId}.cloudfunctions.net/staticMap`;
  const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (opts.zoom !== undefined) q.set('zoom', String(opts.zoom));
  if (opts.w !== undefined) q.set('w', String(opts.w));
  if (opts.h !== undefined) q.set('h', String(opts.h));
  if (opts.scale !== undefined) q.set('scale', String(opts.scale));
  return `${base}?${q.toString()}`;
}

const geocodeFn = () =>
  httpsCallable<{ query: string }, { results: GeocodePlace[] }>(getFirebaseFunctions(), 'geocodeSearch');

/** Geocodes a free-text address/town via the server-side proxy. Returns [] on no match. */
export async function geocodeSearch(query: string): Promise<GeocodePlace[]> {
  const res = await geocodeFn()({ query });
  return res.data.results;
}
```

- [ ] **Step 2: Re-export from the services barrel** — add to `packages/shared/src/services/index.ts` (and the services map if present, per `touch-service`):

```ts
export * from './mapsService';
```

- [ ] **Step 3: Build shared + typecheck**

Run: `pnpm --filter @cultuvilla/shared build && pnpm --filter @cultuvilla/shared typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/services/mapsService.ts packages/shared/src/services/index.ts
git commit -m "feat(shared): add mapsService (staticMapUrl + geocodeSearch)"
```

---

## Stage 3 — Native dependency + config

### Task 6: Add `expo-location` + Expo config

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.config.ts`

> Follow the `expo-native-rebuild` skill: this adds a config plugin, so a native rebuild of the dev client is required before the GPS path works. Read https://docs.expo.dev/versions/v56.0.0/sdk/location/ before editing.

- [ ] **Step 1: Install the SDK-pinned version**

Run: `cd apps/mobile && npx expo install expo-location`
Expected: `expo-location` added to `package.json` at the version matching Expo SDK 56.

- [ ] **Step 2: Add the plugin + iOS usage string to `app.config.ts`**

In the `plugins` array, add (alongside the existing entries):

```ts
[
  'expo-location',
  {
    locationWhenInUsePermission:
      'Cultuvilla usa tu ubicación para fijar la del pueblo en el mapa.',
  },
],
```

In the `ios` config object, add an `infoPlist`:

```ts
infoPlist: {
  NSLocationWhenInUseUsageDescription:
    'Cultuvilla usa tu ubicación para fijar la del pueblo en el mapa.',
},
```

- [ ] **Step 3: Verify config resolves**

Run: `cd apps/mobile && npx expo config --type public >/dev/null && echo OK`
Expected: `OK` (no plugin-resolution error).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.config.ts pnpm-lock.yaml
git commit -m "build(mobile): add expo-location for the village location picker"
```

---

## Stage 4 — i18n

### Task 7: Add / rename message keys

**Files:**
- Modify: `packages/i18n/messages/es.json`

> Follow the `i18n-add-string` skill. Mirror the changes into any non-`es` catalogs that exist in `packages/i18n/messages/`.

- [ ] **Step 1: Edit `village.info`** — add the directions key:

```json
"info": {
  "title": "Información sobre el pueblo",
  "directions": "Cómo llegar"
}
```

- [ ] **Step 2: Replace the coordinate keys in `village.admin.community`** — remove `coordinates`, `latitude`, `longitude`, `invalidCoordinates`; add:

```json
"location": "Ubicación",
"locationSearchPlaceholder": "Busca el pueblo o una dirección",
"useMyLocation": "Usar mi ubicación actual",
"removeLocation": "Quitar ubicación",
"locationPermissionDenied": "Necesitamos permiso de ubicación para usar el GPS.",
"locationSearchFailed": "No se pudo buscar la ubicación. Inténtalo de nuevo.",
"noLocationResults": "Sin resultados"
```

- [ ] **Step 3: Validate JSON + i18n typegen**

Run: `pnpm --filter @cultuvilla/i18n build 2>/dev/null; node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('valid json')"`
Expected: `valid json` (and i18n build, if it has one, passes).

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n: add location-picker + directions strings, drop raw-coordinate keys"
```

---

## Stage 5 — Location picker (organizer write path)

### Task 8: Picker reducer (pure state machine)

**Files:**
- Create: `apps/mobile/components/feature/locationPickerState.ts`
- Test: `apps/mobile/components/feature/locationPickerState.test.ts`

**Interfaces:**
- Consumes: `LatLng` from `@cultuvilla/shared/models/core/LocationDataModel`; `GeocodePlace` from `@cultuvilla/shared/services/mapsService`.
- Produces: `interface LocationPickerState { coords: LatLng | null; query: string; results: GeocodePlace[]; status: 'idle' | 'searching' | 'error' }`; `type LocationAction`; `function initialLocationState(coords: LatLng | null): LocationPickerState`; `function locationReducer(s: LocationPickerState, a: LocationAction): LocationPickerState`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/components/feature/locationPickerState.test.ts
import { describe, it, expect } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm vitest run components/feature/locationPickerState.test.ts`
Expected: FAIL — module not found.

> Note: if `apps/mobile` has no vitest runner, place this test where the mobile unit tests live (mirror an existing `*.test.ts` under `apps/mobile`) and use that command. The logic must stay in a plain `.ts` file with no React-Native imports so it runs without the native bundler.

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/components/feature/locationPickerState.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && pnpm vitest run components/feature/locationPickerState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/locationPickerState.ts apps/mobile/components/feature/locationPickerState.test.ts
git commit -m "feat(mobile): add location-picker reducer"
```

### Task 9: `LocationPicker` component

**Files:**
- Create: `apps/mobile/components/feature/LocationPicker.tsx`

**Interfaces:**
- Consumes: `locationReducer`, `initialLocationState` (Task 8); `geocodeSearch`, `staticMapUrl`, `GeocodePlace` from `@cultuvilla/shared/services/mapsService`; `LatLng` type; `showAlert` from `../../lib/dialogs`; `useT` from `../../lib/i18n`; primitives `Input`, `Button`, `Pressable`, `Text`, `VStack` from `../primitives`; `expo-location`.
- Produces: `function LocationPicker(props: { value: LatLng | null; onChange: (c: LatLng | null) => void }): JSX.Element`.

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/components/feature/LocationPicker.tsx
import { useEffect, useReducer } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { VStack, Text, Input, Button, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { showAlert } from '../../lib/dialogs';
import { geocodeSearch, staticMapUrl } from '@cultuvilla/shared/services/mapsService';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';
import { initialLocationState, locationReducer } from './locationPickerState';

const ACCENT = '#bb5d3a';

export function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (c: LatLng | null) => void }) {
  const { t } = useT();
  const [state, dispatch] = useReducer(locationReducer, value, initialLocationState);

  // Push coord changes up to the parent form.
  useEffect(() => {
    onChange(state.coords);
    // onChange identity is stable enough for this controlled-ish usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.coords]);

  // Debounced geocoding whenever the query is non-empty.
  useEffect(() => {
    const q = state.query.trim();
    if (q === '') return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const results = await geocodeSearch(q);
        if (!cancelled) dispatch({ type: 'resultsLoaded', results });
      } catch {
        if (!cancelled) dispatch({ type: 'searchFailed' });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [state.query]);

  async function useMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(t('village.admin.community.locationPermissionDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      dispatch({ type: 'gpsResult', coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
    } catch {
      showAlert(t('village.admin.community.locationSearchFailed'));
    }
  }

  return (
    <VStack gap={2}>
      <Text variant="h3">{t('village.admin.community.location')}</Text>
      <Input
        value={state.query}
        onChangeText={(query) => dispatch({ type: 'setQuery', query })}
        placeholder={t('village.admin.community.locationSearchPlaceholder')}
      />
      {state.status === 'searching' ? <ActivityIndicator color={ACCENT} /> : null}
      {state.status === 'error' ? (
        <Text tone="muted" variant="bodySm">{t('village.admin.community.locationSearchFailed')}</Text>
      ) : null}
      {state.results.map((place) => (
        <Pressable
          key={`${place.lat},${place.lng}`}
          onPress={() => dispatch({ type: 'pickResult', place })}
          className="py-2 border-b border-subtle flex-row items-center gap-2"
        >
          <Ionicons name="location-outline" size={16} color={ACCENT} />
          <Text variant="body" className="flex-1">{place.label}</Text>
        </Pressable>
      ))}
      <Button onPress={useMyLocation}>{t('village.admin.community.useMyLocation')}</Button>
      {state.coords ? (
        <View className="gap-2">
          <Image
            source={{ uri: staticMapUrl(state.coords.lat, state.coords.lng) }}
            style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 16 }}
            resizeMode="cover"
          />
          <Pressable onPress={() => dispatch({ type: 'clear' })} className="self-start flex-row items-center gap-1">
            <Ionicons name="close-circle-outline" size={16} color={ACCENT} />
            <Text style={{ color: ACCENT }} className="font-semibold">{t('village.admin.community.removeLocation')}</Text>
          </Pressable>
        </View>
      ) : null}
    </VStack>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && pnpm typecheck` (or the repo-root `pnpm check`)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/feature/LocationPicker.tsx
git commit -m "feat(mobile): add LocationPicker (search + GPS + static preview)"
```

### Task 10: Wire `LocationPicker` into `CommunitySettingsEditor`

**Files:**
- Modify: `apps/mobile/components/feature/CommunitySettingsEditor.tsx`

**Interfaces:**
- Consumes: `LocationPicker` (Task 9).

- [ ] **Step 1: Replace coordinate state + parsing with a single `coords` state**

In [CommunitySettingsEditor.tsx](apps/mobile/components/feature/CommunitySettingsEditor.tsx): remove the `lat`/`lng` `useState` (lines 33-34), the `HStack`/`Input` import of those, the `parseCoordinates` function (lines 88-98), and the `coordinates` block in `load` (lines 45-46). Add:

```tsx
const [coords, setCoords] = useState<LatLng | null>(null);
```

In `load`, replace the lat/lng lines with:

```tsx
setCoords(m?.coordinates ?? null);
```

- [ ] **Step 2: Simplify `save`** — replace the `parseCoordinates` branch (lines 102-106, 110) with a direct write:

```tsx
async function save() {
  if (!villageId || description === null) return;
  setSaving(true);
  try {
    await updateCommunity(villageId, { description, coverImages: images });
    await updateMunicipality(villageId, { coordinates: coords });
    showAlert(t('village.admin.community.saved'));
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 3: Replace the coordinate UI** — swap the `Coordenadas` heading + `HStack` of two `Input`s (lines 174-182) for:

```tsx
<LocationPicker value={coords} onChange={setCoords} />
```

Add the import: `import { LocationPicker } from './LocationPicker';` and drop now-unused `HStack` from the primitives import if nothing else uses it.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm check` (repo root)
Expected: PASS — no references to `lat`, `lng`, `parseCoordinates`, or the removed i18n keys remain.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/feature/CommunitySettingsEditor.tsx
git commit -m "feat(mobile): use LocationPicker in community settings editor"
```

---

## Stage 6 — Info modal map + "Cómo llegar"

### Task 11: Map card + directions button in `VillageInfoModal`

**Files:**
- Modify: `apps/mobile/components/feature/VillageInfoModal.tsx`

**Interfaces:**
- Consumes: `staticMapUrl` from `@cultuvilla/shared/services/mapsService`; `Linking` from `react-native`.

- [ ] **Step 1: Add imports** — extend the `react-native` import with `Linking`, and add:

```tsx
import { staticMapUrl } from '@cultuvilla/shared/services/mapsService';
```

- [ ] **Step 2: Add an `openDirections` helper** inside the component (after `close`):

```tsx
function openDirections() {
  const c = village.coordinates;
  if (!c) return;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;
  void Linking.openURL(url).catch(() => {
    /* best-effort, mirrors UserMenuModal */
  });
}
```

- [ ] **Step 3: Render the map card** — inside the `ScrollView`, after the description block and before the `MasonryGallery`, add:

```tsx
{village.coordinates ? (
  <View className="gap-2">
    <Pressable onPress={openDirections} accessibilityLabel={t('village.info.directions')}>
      <Image
        source={{ uri: staticMapUrl(village.coordinates.lat, village.coordinates.lng) }}
        style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: 16 }}
        resizeMode="cover"
      />
    </Pressable>
    <Pressable
      onPress={openDirections}
      accessibilityLabel={t('village.info.directions')}
      className="flex-row items-center justify-center bg-surface"
      style={{ paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, borderColor: ACCENT }}
    >
      <Ionicons name="navigate-outline" size={18} color={ACCENT} />
      <Text style={{ color: ACCENT }} className="font-semibold ml-1.5">
        {t('village.info.directions')}
      </Text>
    </Pressable>
  </View>
) : null}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm check` (repo root)
Expected: PASS.

- [ ] **Step 5: Manual verification** (per the `verify` / `drive-android-avd` skills)

Set a known coordinate on a community via the editor, reopen the info modal, confirm the map renders and "Cómo llegar" opens Google Maps to directions. On web (`pnpm deploy:hosting:dev` or local web), confirm the same `<Image>` renders.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/feature/VillageInfoModal.tsx
git commit -m "feat(mobile): show pueblo map + Cómo llegar in info modal"
```

---

## Deployment & post-merge (manual, outside the task loop)

- Create the `GOOGLE_MAPS_API_KEY` secret: `firebase functions:secrets:set GOOGLE_MAPS_API_KEY` (dev project), pasting a Google Maps Platform key restricted to **Static Maps API** + **Geocoding API**.
- Deploy the two functions (per `firestore-deploy`): `pnpm deploy:functions:dev` (or the repo's dev functions deploy script) — first deploy of `staticMap` must allow unauthenticated invocations (Firebase CLI sets the `allUsers` invoker for HTTP functions).
- Rebuild the dev client (per `expo-native-rebuild`) so `expo-location` is linked.
- After merge + verification, retire this plan: distill any durable rationale into `docs/decisions/` and `git rm` this file (per `managing-plans-lifecycle`).
