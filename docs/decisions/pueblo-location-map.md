# Pueblo location map: a server-proxied static image, not an interactive map SDK

## Context

A village ("pueblo") stores its location as `coordinates: LatLng | null` on the
municipality doc. In practice the field is almost always null — the INE
municipality import seeds it as `null`, and coordinates are only ever introduced
by an organizer. We wanted to show *where* a pueblo is and offer directions,
plus give organizers a usable way to set the location (typing decimal lat/lng was
a non-starter).

Two constraints dominated the design:
- `apps/mobile/` ships **both** as a native dev-client and as a web build on
  Firebase Hosting. `react-native-maps` does not run on RN-Web.
- The repo enforces server-side guardrails; a billable Google key must never
  reach a client bundle.

## Decision

- **The map is a static image, not an interactive map component.** A plain
  `<Image>` of a Google Static Maps PNG renders identically on native and web
  with no native module — sidestepping the `react-native-maps`/RN-Web
  incompatibility. It renders as a rectangle in the village screen
  (`VillageHomeBody`), with a "Cómo llegar" affordance that opens Google Maps
  directions via `Linking.openURL`.
- **The Google key stays server-side, reached through two gen-2 Cloud Functions**
  (`functions/src/maps/`): `staticMap` (onRequest, `europe-west1`) proxies the
  Static Maps PNG with a long `Cache-Control`; `geocodeSearch` (onCall,
  `us-central1`) returns geocoded places for the picker. Both read the key via
  `defineSecret('GOOGLE_MAPS_API_KEY')`. The shared `mapsService` exposes a
  `staticMapUrl()` builder (points at the deployed `staticMap` URL) and a
  `geocodeSearch()` callable wrapper. No key ever ships to a client.
- **Coordinates are organizer-entered via a picker, not backfilled.** The
  `LocationPicker` (search via `geocodeSearch` + GPS via `expo-location` +
  static preview) replaces the raw lat/lng inputs in the community settings
  editor. The map simply does not render until coordinates exist.

## Rejected alternatives

- **Interactive `react-native-maps` + a web fallback.** Two code paths, a native
  rebuild, and a dependency — for a "where is it" use case the static image plus
  the directions button covers. Rejected for complexity.
- **WebView-embedded map.** Heavier, janky in a modal, another dependency.
- **Client-side / referrer-restricted Google key.** Simpler but the key is
  visible (image URLs on web, app bundle on native) and native referrer
  restriction is weak. Rejected in favor of the server proxy.
- **Backfilling coordinates for all ~6,000 municipalities** (e.g. geocoding the
  INE rows). Out of scope; the map stays absent until an organizer sets the
  location.

## What this binds

- The Maps key restriction is **API-target only** (Maps Static + Geocoding),
  because the key is used server-to-server by Cloud Functions with dynamic
  egress IPs — app/referrer restrictions don't apply. See the Secret Manager
  section of the `gcloud-cultuvilla` skill.
- `staticMap` is an **unauthenticated, billable public endpoint** (it must load
  as an `<Image>`). Blast radius is capped by `maxInstances` and the API
  restriction; abuse/quota is a standing operational concern.
- `mapsService.staticMapUrl` hardcodes the `europe-west1` region — it must match
  the deployed `staticMap` region.

## Revisit when

- A pueblo needs an interactive/zoomable map, or pin-on-map coordinate entry —
  then reconsider a native map SDK with a web fallback.
- Maps API spend/quota becomes material — add a budget alert / quota cap, or move
  `staticMap` behind auth or a cache/CDN layer.
- Coordinates need to exist for most pueblos without organizer action — then do
  the geocoding backfill that was deferred here.
