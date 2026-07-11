# QR + `/descarga` endpoint — design

**Status:** idea → ready-to-plan
**Date:** 2026-07-11

## Problem

We want a physical QR code (posters, flyers, business cards) that people scan to
reach Cultuvilla. Today the product is **web-only**; the native apps arrive in
~a month. The QR is printed once and must **never change** — it has to work now
(web) and later (app) with the same encoded bytes. It should also carry the
Cultuvilla logo in its center for brand recognition.

## Core principle — why the QR survives the app launch

The QR encodes a plain `https://cultuvilla.es/descarga` URL, **not** a
`cultuvilla://` custom scheme. Today that URL resolves as a real **web route**.
This is the same rule AGENTS.md already mandates: *every deep link must resolve
as a real web route under `apps/mobile/app/**`.* The bytes on the poster never
change; only the server-side behavior of the endpoint evolves.

## Deliverables

Three pieces, all in **one PR** on branch `feat/qr-descarga`.

### 1. The endpoint — `apps/mobile/app/descarga.tsx`

A smart landing page, built complete but with its app-download half gated behind
a single config flag so no dead UI ships while there is no app.

- **Config module** — `apps/mobile/lib/appStores.ts`:
  ```ts
  export const APP_AVAILABLE = false; // flip to true the day the app ships
  export const APP_STORES = {
    ios: '',      // fill App Store URL at release
    android: '',  // fill Play Store URL at release
  };
  export const APP_SCHEME = 'cultuvilla'; // matches app.config.ts `scheme`
  ```

- **Behavior:**
  - **Native (`Platform.OS !== 'web'`):** the user is already in the app —
    `<Redirect href="/(tabs)" />`. (The route compiles into the native bundle;
    it must degrade gracefully.)
  - **Web, `APP_AVAILABLE === false` (now):** a branded landing — Cultuvilla
    logo + name + short tagline + a primary **"Abrir en la web"** button →
    `/(tabs)`, and a muted "App para móvil próximamente" line. No empty store
    buttons.
  - **Web, `APP_AVAILABLE === true` (after the app ships):** detect platform;
    on iOS/Android attempt `APP_SCHEME://` to open an installed app, then show
    the matching store button(s); always keep a secondary **"seguir en la web"**
    link. Desktop web shows both store badges + web CTA.

- **Not a Universal/App Link.** A download page is *for people without the app*,
  so we deliberately do **not** add `/descarga` to the `.well-known`
  `apple-app-site-association` / `assetlinks.json` `paths`. Those files are left
  untouched. App-open is attempted client-side via the custom scheme instead.

- **i18n:** all strings via `useT()` / `packages/i18n/messages/es.json` under a
  new `descarga.*` namespace (`descarga.tagline`, `descarga.openWeb`,
  `descarga.comingSoon`, `descarga.getOnAppStore`, `descarga.getOnPlayStore`,
  `descarga.continueOnWeb`).

### 2. The generator — `scripts/generate-qr.mjs`

- Deps: new devDep **`qrcode`** (matrix + SVG) + existing **`sharp`** (PNG
  compositing). Logo source: `apps/mobile/assets/logo.png`.
- **Error-correction level `H` (30%)** — required so the centered logo (~18% of
  the module area) does not break scannability. Logo sits on a white rounded
  pad.
- Host-agnostic CLI, default target `https://cultuvilla.es/descarga`:
  ```
  node scripts/generate-qr.mjs [--url <url>] [--out <dir>] [--size <px>]
  ```
- Emits, committed under `apps/mobile/assets/qr/`:
  - `cultuvilla-descarga.png` — 2048px, print-ready.
  - `cultuvilla-descarga.svg` — vector, logo embedded as base64 `<image>`.
- Wired as `pnpm qr:generate` in root `package.json`.

### 3. Test — `scripts/__tests__/generate-qr.test.mjs` (or vitest in shared)

Runs the generator into a temp dir and asserts:
- both `.png` and `.svg` are produced and non-empty;
- decoding the generated QR round-trips the exact input URL;
- the QR was built at error-correction level `H`.

## Out of scope / user action items

- **Attaching `cultuvilla.es` to Firebase Hosting prod** (DNS + custom domain)
  and deploying prod — the QR is only *live* once this is done. Not part of this
  PR.
- Filling `APP_STORES` URLs and flipping `APP_AVAILABLE` — done at native
  release, a one-line follow-up.

## Testing plan

- `pnpm qr:generate` produces both assets locally; scan the PNG with a phone to
  confirm it resolves.
- `pnpm app:typecheck` + `pnpm app:test` green.
- Manual: load `/descarga` in the web build → lands on branded page → "Abrir en
  la web" enters the feed.
