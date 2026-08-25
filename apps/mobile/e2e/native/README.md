# Native E2E (Maestro on Android)

The native half of the E2E substrate described in
[docs/decisions/e2e-testing-substrate.md](../../../../docs/decisions/e2e-testing-substrate.md).
Same seeded fixtures, same "assert on Firestore emulator state, not on the view
hierarchy" discipline as the web (Playwright) suite — **only the driver differs**.

## Why it exists next to the web suite

The web suite runs the same React tree through react-native-web, so it proves the
product logic. It cannot prove the *platform*. Everything in this list is shipped
to users and invisible to Playwright:

- native app boot and the Expo Router **deep-link intent** path,
- **AsyncStorage** auth persistence (web uses IndexedDB),
- the native Firebase SDK,
- RN `Modal`, bottom sheets, `FlatList` pickers and the **soft keyboard**,
- **`Alert.alert`** — react-native-web ships it as a *no-op*, so the web driver
  has never once executed a confirmation dialog (see the `mobile-web-compat`
  skill). `22-unregister-from-event` is the first test that does.

## In CI

[.github/workflows/android-e2e.yml](../../../../.github/workflows/android-e2e.yml)
runs the whole suite on an AVD, gated to the **beta/main release paths** exactly
like `web-e2e` — a Gradle build plus an emulator boot is far too slow for
day-to-day `develop` PRs, and `beta` is the release candidate, the last point
where a native-only regression can be caught before it becomes a store binary.
`workflow_dispatch` is enabled so a native regression can be chased from any
branch without waiting for a promotion PR.

## The flows

| Flow | What only this can prove |
|---|---|
| `00-anonymous-deep-link` | The substrate boots: APK + emulator-connect + seed + deep-link routing, before any interaction. |
| `10-login-and-profile` | The native fixture-login seam, then auth → `users/{uid}` → `persons/{id}` → rendered. |
| `20-register-to-event` | Sign-up through the attendee sheet; registration doc **and** the trigger-maintained `confirmedCount`. |
| `21-register-family-member` | The multi-persona model — signing up a dependent. |
| `22-unregister-from-event` | A real native `Alert.alert` confirmation. |
| `30-village-join` | A rules-gated direct client write, and the UI flip that follows it. |
| `40-entity-comments` | RN `TextInput` + soft keyboard + send round trip. |
| `50-onboarding-complete-profile` | The three-step person form with native `Modal`/`FlatList` pickers and step gating. |

Filename order is load-bearing: `22` unregisters what `20` registered. Every flow
still starts from `clearState: true`, so one failure never cascades into a bogus
second one. [../../../../packages/shared/test/ci/androidE2e.test.ts](../../../../packages/shared/test/ci/androidE2e.test.ts)
fails the build if a flow is added without a numeric prefix.

## Backend assertions from Maestro

`scripts/docField.js` and `scripts/queryCollection.js` read the Firestore
emulator's REST API and poll until the expected state appears — the native mirror
of [../lib/emulatorState.ts](../lib/emulatorState.ts), including the
`Authorization: Bearer owner` rules-bypass (without it, a read of a rule-protected
collection returns empty and the assertion fails against a backend that is
actually correct).

They run on the **host**, not on the device, so they use `127.0.0.1` even though
the app inside the AVD reaches the same emulator at `10.0.2.2`.

## The login seam

Maestro drives the UI and cannot call into the app's JS context, so the web
suite's `window.__cultuvillaE2E` is unreachable. Credentials arrive over the
app's own URL scheme instead:

```
cultuvilla://?e2eLogin=<email>%7C<password>
```

**One** parameter, pipe-separated, because `adb shell am start -d` eats an
unescaped `&` — a two-parameter link would arrive with the password missing.
It is handled by the same armed predicate and the same
`signInWithEmailAndPassword` primitive as the web seam, in
[../../lib/auth/AuthContext.tsx](../../lib/auth/AuthContext.tsx). The query lands
on the index route, which ignores unknown params, so no new screen or route
exists for it.

## Why `10.0.2.2` and not `127.0.0.1`

On an Android emulator `127.0.0.1` is the *device*. The AVD reaches the host
loopback — where the Firebase emulators listen — at the alias `10.0.2.2`.
`scripts/build-android-e2e-apk.mjs` bakes it in via `EXPO_PUBLIC_EMULATOR_HOST`.

That alias is also the **only** widening of the fixture-login's host allowlist
(see `isE2EEmulatorHost` in [../../lib/auth/e2eLoginLink.ts](../../lib/auth/e2eLoginLink.ts)):
it is non-routable and AVD-only, so a physical device or a real network has
nothing there.

## Running it locally

```bash
# 1. Build the standalone, emulator-armed APK (~4 min warm, x86_64 only).
pnpm app:android:e2e-apk

# 2. Boot an AVD, then run the whole thing: Firebase emulators + seed + suite.
E2E_ANDROID_APK=apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
  pnpm test:e2e:android
```

One flow at a time, against whatever build is already installed:

```bash
node scripts/run-android-e2e.mjs --flow 20-register-to-event.yaml
```

### Under WSL2

The AVD runs on the **Windows** host (see the `drive-android-avd` skill), which
costs two extra steps:

1. **adb.** The Windows adb server must be reachable from WSL. Start it with
   `adb.exe -a -P 5037 nodaemon server` (binds `0.0.0.0`) and forward WSL's
   `127.0.0.1:5037` to the Windows host IP, so Maestro's default lookup finds it.
2. **Emulator bind host.** `10.0.2.2` resolves to the *Windows* loopback, where a
   WSL process bound to `127.0.0.1` is invisible. Pass `EMULATOR_BIND_HOST=0.0.0.0`
   so the Firebase emulators bind to all interfaces:

   ```bash
   EMULATOR_BIND_HOST=0.0.0.0 E2E_ANDROID_APK=… pnpm test:e2e:android
   ```

Neither applies on a Linux runner, where the AVD and the emulators share one
loopback — which is why CI leaves both unset and exposes nothing.

## Maestro traps this suite already paid for

Every one of these cost real debugging time. They are encoded in the flows with
comments; this is the index.

| Trap | What it looks like | What to do |
|---|---|---|
| `hideKeyboard` is a **BACK press** | A later step fails with "element not found" while the app sits on the launcher — `inputText` on an AVD with a hardware keyboard never raises a soft keyboard, so the BACK walks out of the screen. | Don't use it. |
| `retry:` still fails the flow | Every command reads COMPLETED and the flow is reported FAILED anyway (Maestro 2.4 records the failed attempt inside the block). | Use `runFlow: when:` — a skipped conditional records nothing. |
| `scrollUntilVisible` on an unscrollable screen | Burns its timeout and fails, naming a field that was visible all along. | Wrap it in `runFlow: when: notVisible:`, or drop it. |
| A centre-tap lands on the wrong child | Tapping a consent row opens the legal screen instead of ticking the box; tapping an icon-sized adornment reports COMPLETED while the handler never fires. | Target the inner element (`accept-terms-box`), or trigger the same handler another way (`pressKey: Enter` on an input with `onSubmitEditing`). |
| The bare `cultuvilla://` | The app never starts. expo-dev-client is a plain dependency, so its launcher activity exists even in the release APK and claims the schemeless link. | Always name a route. |
| An intent to a cold-starting app | Silently dropped — the JS listener has not mounted yet. | Launch first, wait for the tab bar, then send the link. |
| Text selectors match the WHOLE string | `Apuntado` misses "Apuntado (1)"; `Perfil` matches both the tab and the screen header. | Use a regex (`Apuntad.*`) or a `testID`. |

## Adding a flow

Mirror an existing web flow rather than inventing a divergent native-only
journey, give the file the next numeric prefix, and make the **strong** assertion
against Firestore state via `runScript`. Any id or title referenced in YAML must
stay in sync with `scripts/data/seed-fixtures/e2e/fixtures.mjs` by hand — Maestro
YAML cannot import JS, exactly as [../lib/fixtures.ts](../lib/fixtures.ts) already
does for the web side.
