# Print-forever QR + `/descarga` smart landing

## Context

Wanted a QR code that can be printed once and never reprinted, even once the
native apps ship to the stores (currently web-only — see AGENTS.md
"Web-first"). It needed a stable target and a landing page that can evolve
without invalidating printed copies.

## Decision

- **The QR encodes a plain `https://cultuvilla.es/descarga` URL** — a real
  Expo Router web route today, interceptable by a native app later via
  standard `https://` deep-linking. The printed bytes never change; behavior
  changes only server/app-side.
- **`/descarga` is deliberately *not* a Universal/App Link** — no
  `apps/mobile/public/.well-known/**` entries reference it. Pre-release there
  is no app to open, so it doesn't touch the deep-link association config.
- **Pre-release behavior: straight redirect, not a landing page.** With
  `APP_AVAILABLE = false` (`apps/mobile/lib/appStores.ts`), hitting `/descarga`
  on web just forwards into the feed (`Redirect href="/(tabs)"`) — this is a
  deliberate simplification over the original plan's "always show a branded
  landing page" design, since there is genuinely nothing to land on. On native,
  it also redirects (the user is already in the app).
- **The store-picker landing page is fully coded but dormant**, gated behind
  the single `APP_AVAILABLE` flag in `appStores.ts`. Flip it (and fill in
  `APP_STORES.ios` / `.android`) the day the native apps are actually
  published — no other code changes needed.
- **QR asset generation is a standalone script** (`scripts/generate-qr.mjs`),
  not part of the app build: PNG + SVG, error-correction level **H** (required,
  non-negotiable — the center-composited Cultuvilla logo eats into the modules
  and needs the 30% redundancy budget), logo squared/trimmed for even fit.

## What this binds

- Don't add Universal Link entries for `/descarga` until the native apps are
  actually store-published (see AGENTS.md versioning/releases section for the
  release gate).
- When flipping `APP_AVAILABLE`, re-verify the store landing UI in
  `apps/mobile/app/descarga.tsx` still matches the current store URLs before
  relying on the printed QR.
