# Native E2E (Maestro) — groundwork

A single **anonymous** smoke flow ([flows/deep-link-event.yaml](flows/deep-link-event.yaml))
that runs the real dev-client on an Android AVD against the Firebase emulator and
deep-links into the seeded event. It is the native mirror of the web
[deep-link-event.spec.ts](../flows/deep-link-event.spec.ts): the seeded fixtures
and the assertion targets are shared substrate — only the **driver** (Maestro vs
Playwright) differs.

This is **Stage-4 groundwork**, deliberately scoped down:

- **Not in CI.** No AVD runs in GitHub Actions today; this is manual/opt-in. Run
  it locally when you touch native init, deep-link routing, or the
  emulator-connect seam.
- **Anonymous only.** It needs no login, so it doesn't touch the native
  fixture-login mechanism (a deep-link login intent or a testID dev button) —
  that's designed later, when interactive native flows are written. See
  [docs/plans/ongoing/e2e-flows-and-native-groundwork.md](../../../../docs/plans/ongoing/e2e-flows-and-native-groundwork.md).

## Why `10.0.2.2` and not `127.0.0.1`

On an Android emulator, `127.0.0.1` is the *device*, not your machine. The AVD
reaches the host loopback (where the Firebase emulators listen) at the special
alias `10.0.2.2`. The emulator-connect seam
([apps/mobile/lib/firebaseInit.ts](../../lib/firebaseInit.ts)) reads
`EXPO_PUBLIC_EMULATOR_HOST` (baked in at build time) and defaults to `127.0.0.1`
for the web build — so the native build must set it to `10.0.2.2`.

The fixture-login loopback assertion in `AuthContext` is intentionally **left
alone**: `10.0.2.2` is not loopback, so the test-login seam still refuses to fire
on native. Fine here — this flow is anonymous.

## Prerequisites

- [Maestro](https://maestro.mobile.dev) CLI installed (`curl -Ls "https://get.maestro.mobile.dev" | bash`).
- An Android AVD reachable from your shell — see the `drive-android-avd` skill for
  the WSL2/Windows adb split.
- The Firebase emulators running and seeded (below).

## Run loop

```bash
# 1. Boot the emulators (auth/firestore/functions/storage) and seed the E2E set.
#    (Separate terminal — these stay alive.)
pnpm test:emulators           # or your usual emulator boot
pnpm seed:e2e                 # deterministic E2E fixtures → emulator

# 2. Build + install a dev-client that talks to the emulator via the AVD host
#    alias. USE_FIREBASE_EMULATOR=1 enables the connect seam; the host override
#    points it at 10.0.2.2. (First run needs a dev-client build; see the
#    expo-native-rebuild skill.)
cd apps/mobile
USE_FIREBASE_EMULATOR=1 EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2 \
  npx expo run:android

# 3. Drive the smoke flow.
pnpm app:e2e:native
```

`pnpm app:e2e:native` just runs `maestro test` over this directory's flows.

## Adding flows

Keep the shared-substrate discipline: assert on backend effects where you can
(the same Firestore state the web `emulatorState` readers check), and mirror an
existing web flow rather than inventing a divergent native-only journey. Any id
or title referenced in YAML must stay in sync with
`scripts/data/seed-fixtures/e2e/fixtures.mjs` by hand.
