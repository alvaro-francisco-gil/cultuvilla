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
