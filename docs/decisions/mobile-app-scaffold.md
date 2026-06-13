# Mobile app is a peer to web over the shared layer, not a port

## Context

Cultuvilla needed a native iOS + Android app. Rather than fork the web code or
duplicate models, services, and design tokens, the decision was to make
`apps/mobile/` a sibling of `apps/web/` that consumes the same
`@cultuvilla/shared` (models, services, tokens, formatters) and
`@cultuvilla/i18n` catalog. The first release covers read-mostly flows: feed,
event detail, auth, villages, censo, register-to-event.

## Decision

- **Expo managed workflow + Expo Router** (file-based routes), so the team
  reuses the Next.js app-router mental model and gets EAS Build / OTA without a
  local native toolchain. (Designed against SDK 53; the app shipped on SDK 54 /
  RN 0.81 as the baseline moved.)
- **NativeWind v4 over Tailwind v3** — explicitly *not* NativeWind v5, which was
  pre-release. Both apps consume the same TS token objects from
  `@cultuvilla/shared/design-system`; only the Tailwind config file format
  differs. Convergence on `@theme` CSS is deferred to when NativeWind v5 ships GA.
- **Firebase init reuses the shared `initFirebase()`** — the only mobile-specific
  piece is `customizeAuth` registering `getReactNativePersistence(AsyncStorage)`.
  No second Firebase setup path.
- **Mobile primitives mirror the web primitives' prop API** so feature components
  written against the contract are portable across both apps.
- **Env via `expo-constants`**: `APP_ENV` (dev/beta/prod) is set per EAS build
  profile and read at runtime, then fed to the shared `getFirebaseConfig(env)`.
  No `NEXT_PUBLIC_*` vars exist on mobile. See
  [dev-beta-prod-environments](dev-beta-prod-environments.md).
- **Metro is configured for the pnpm monorepo**: watch the workspace, resolve
  from both app and root `node_modules`, and `disableHierarchicalLookup`
  (pnpm's flat layout breaks the default).

## Rejected alternatives

- **NativeWind v5** — pre-release; pinned to v4/Tailwind-v3 until web also moves
  to Tailwind v4 / `@theme`.
- **next-intl on mobile** — web-only; the hoisted catalog is loaded through a
  thin custom adapter instead of duplicating strings.
- **Porting web screens directly** — rejected in favour of a shared layer both
  apps consume.

## What this binds

- New shared logic (services, models, tokens) lives in `@cultuvilla/shared` and
  is consumed by both apps — do not add mobile-only business logic.
- Mobile primitives must keep prop parity with their web twins; diverging breaks
  the portability promise.
- Firebase access on mobile goes through `lib/firebaseInit.ts` →
  `initFirebase(getFirebaseConfig(env), { customizeAuth })`, never a bespoke init.
- Every new i18n string must work for both apps via the shared catalog.

## Revisit when

- NativeWind v5 ships GA and web migrates to Tailwind v4 — converge both apps on
  `@theme`.
- A feature needs native modules outside Expo's managed surface (would force a
  prebuild / dev-client decision).
