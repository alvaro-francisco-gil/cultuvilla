# cultuvilla mobile

Expo SDK 54 React Native app. See [docs/superpowers/specs/2026-05-19-mobile-app-scaffold-design.md](../../docs/superpowers/specs/2026-05-19-mobile-app-scaffold-design.md) for design.

## Local dev

```bash
pnpm --filter cultuvilla-mobile exec expo start
```

## Builds (EAS)

| Profile        | APP_ENV | Distribution | Use |
|---------------|---------|--------------|-----|
| `development` | dev     | internal     | Dev client on simulators / devices |
| `preview-dev` | dev     | internal     | Shareable dev build |
| `preview-beta`| beta    | internal     | Internal beta testing |
| `production`  | prod    | store        | App Store / Play Store |

Trigger: `eas build --profile <name> --platform <ios|android>`
