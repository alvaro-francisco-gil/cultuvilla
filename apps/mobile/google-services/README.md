# Android native Firebase config (push only)

`expo-notifications` mints the Android FCM token from the native
`google-services.json`. Drop each environment's file here:

```
google-services/dev/google-services.json    ← villa-events,    package com.cultuvilla.app.dev
google-services/beta/google-services.json   ← cultuvilla-beta, package com.cultuvilla.app.beta
google-services/prod/google-services.json   ← cultuvilla-prod, package com.cultuvilla.app
```

Download from Firebase console → Project settings → Your apps → the Android app
with that package name (add it if missing). The file carries no secret — the API
key inside is restricted by package + SHA — so it is committed, like the
`.well-known` signing identities.

`app.config.ts` only wires `android.googleServicesFile` when the file exists, so
a checkout without it still builds; that build simply never registers for push.

iOS has no counterpart on purpose: its tokens are raw APNs tokens sent to APNs
directly. See [docs/plans/ongoing/device-notifications.md](../../../docs/plans/ongoing/device-notifications.md).
