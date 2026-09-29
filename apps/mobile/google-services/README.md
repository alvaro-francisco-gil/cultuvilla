# Android native Firebase config (push only)

`expo-notifications` mints the Android FCM token from the native
`google-services.json`. One file per environment:

| Env | File | Firebase project | Package |
|---|---|---|---|
| dev | `dev/google-services.json` ✅ | `villa-events` | `com.cultuvilla.app.dev` |
| beta | `beta/google-services.json` ✅ | `cultuvilla-beta` | `com.cultuvilla.app.beta` |
| prod | `prod/google-services.json` ✅ | `cultuvilla-prod` | `com.cultuvilla.app` |

Prod and the "Cultuvilla Beta" app both ship through Play (see
[beta-is-its-own-play-app.md](../../../docs/decisions/beta-is-its-own-play-app.md)),
so both files are required; dev is sideload-only.

To refresh one (the Android app must already exist in that Firebase project):

```bash
firebase apps:list ANDROID --project <project> --account cultuvilla.app@gmail.com
firebase apps:sdkconfig ANDROID <appId> --project <project> --account cultuvilla.app@gmail.com \
  --out apps/mobile/google-services/<env>/google-services.json
```

The files carry no secret — the API key inside ships in every APK and is
restricted by package + signing SHA — so they are committed, like the
`.well-known` signing identities. `app.config.ts` only wires
`android.googleServicesFile` when the file exists, so a checkout without one
still builds; that build simply never registers for push.
[googleServices.test.ts](../../../packages/shared/test/ci/googleServices.test.ts)
fails CI if a file is ever swapped for another env's.

iOS has no counterpart on purpose: its tokens are raw APNs tokens sent to APNs
directly. See [docs/plans/ongoing/device-notifications.md](../../../docs/plans/ongoing/device-notifications.md).
