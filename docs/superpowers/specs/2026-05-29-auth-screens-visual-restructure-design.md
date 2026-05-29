# Auth screens visual restructure — design spec

**Status:** Draft

**Topic:** Restructure the mobile login & signup screens to match the visual layout & UX of ordago's `LoginScreen.js`, while keeping cultuvilla's TypeScript + design-primitives + i18n stack. Not a 1:1 port — we adopt the shape (logo, divider, branded OAuth button, right-aligned forgot link, centered card), not the JS-megafile structure or the heavy nickname-modal/Apple flows.

**Source app for inspiration:** `~/githubs/ordago-apps` (`apps/ordago-app/screens/auth/LoginScreen.js`, `apps/ordago-app/screens/auth/RegisterScreen.js`).

## Goals

1. Replace the current minimal stack-of-inputs layout in `apps/mobile/app/(auth)/login.tsx` and `signup.tsx` with the ordago-style centered auth card: logo → title → fields → forgot link → primary CTA → "O" divider → branded Google button → cross-link to the other screen.
2. Extract the shared pieces into a `apps/mobile/components/auth/` folder so login and signup compose from the same primitives instead of duplicating layout.
3. Keep both screens slim (~60 lines): state + handlers + composition. The auth behavior in `lib/auth/AuthContext.tsx` does not change.

## Non-goals

- **No Apple Sign-In.** Out of scope for this pass.
- **No nickname/username modal for first-time OAuth users.** Ordago has this; cultuvilla currently doesn't and we're not adding it here.
- **No changes to `AuthContext.tsx`, `useAuth.ts`, `userService`, or any user model.** This is a UI restructure only.
- **No changes to `(auth)/_layout.tsx`** beyond what's already there (header hidden).
- No new auth providers, no rate-limiting UI, no captcha. Behavior is identical to today.

## File structure

New folder:

```
apps/mobile/components/auth/
  AuthCard.tsx           # ScrollView + KeyboardAvoidingView + centered max-width VStack
  AuthHeader.tsx         # logo image + centered title
  OrDivider.tsx          # ──── O ────
  GoogleButton.tsx       # white button w/ G icon, "Continuar con Google"
  ForgotPasswordLink.tsx # right-aligned link
  index.ts               # barrel re-exports
  __tests__/
    AuthHeader.test.tsx
    OrDivider.test.tsx
    GoogleButton.test.tsx
    ForgotPasswordLink.test.tsx
```

Both routes shrink and compose from this set:

- `apps/mobile/app/(auth)/login.tsx` — local state, handlers (`onSubmit`, `onGoogle`, `onForgot`), composition.
- `apps/mobile/app/(auth)/signup.tsx` — same shape, no forgot link, no auto-submit-on-Enter difference from login.

## Visual layout (target — same shape for both screens)

```
┌─────────────────────────┐
│        [icon.png]       │   AuthHeader: 96×96 rounded
│                         │
│      Iniciar sesión     │   AuthHeader: centered h2 title
│                         │
│  ┌───────────────────┐  │
│  │ email             │  │   Input (max-width 360, centered column)
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ contraseña     👁 │  │   PasswordInput (eye toggle already built-in)
│  └───────────────────┘  │
│         ¿Olvidaste tu…? │   ForgotPasswordLink (right-aligned, login only)
│                         │
│  ┌───────────────────┐  │
│  │  Entrar           │  │   Button variant="primary" fullWidth
│  └───────────────────┘  │
│                         │
│  ──────── O ────────    │   OrDivider
│                         │
│  ┌───────────────────┐  │
│  │ [G] Continuar con │  │   GoogleButton (white, subtle shadow, G icon)
│  │     Google        │  │
│  └───────────────────┘  │
│                         │
│   ¿No tienes cuenta? →  │   Link to other screen (Text tone="muted")
└─────────────────────────┘
```

Differences from today's screens that this captures:

- Logo at top (currently absent).
- Centered max-width column instead of edge-to-edge form.
- Eye toggle visible (already supported by `PasswordInput`, just used).
- Right-aligned, low-emphasis "forgot password" link instead of a stacked one (login only).
- Branded white Google button with G icon instead of generic `variant="secondary"` Button.
- Visual "O" divider between primary and OAuth paths.

## Component contracts

### `AuthCard`

```tsx
type AuthCardProps = { children: ReactNode };
```

Wraps children in: `<Screen scroll>` (the primitive already provides `SafeAreaView` + `ScrollView`) → `KeyboardAvoidingView` (iOS `padding` behavior, no-op on Android/web) → centered `VStack gap={4}` with `maxWidth: 360`, vertically centered when content fits. On RN-Web that renders as a centered narrow column (the visual we want); on native it's a standard padded form. **Do not** introduce a second `ScrollView` — `Screen`'s built-in one is what we use.

### `AuthHeader`

```tsx
type AuthHeaderProps = { title: string };
```

Renders the bundled `apps/mobile/assets/icon.png` at 96×96, rounded radius 20, centered. Below: `Text variant="h2"` with `textAlign: 'center'`.

### `OrDivider`

```tsx
type OrDividerProps = { label?: string }; // defaults to t('auth.divider.or')
```

Two thin horizontal lines flanking a centered label. Uses Tailwind tokens already present in the project (border + muted text).

### `GoogleButton`

```tsx
type GoogleButtonProps = { onPress: () => void; loading?: boolean; testID?: string };
```

White background, subtle shadow, full-width within the auth card. Renders the existing Google "G" mark from `apps/mobile/assets/` (or a new asset committed alongside this work — see Open question below) on the left, label centered. Label: `t('auth.signInWithGoogle')` normally, `t('auth.googleConnecting')` while `loading`. Disabled while loading.

### `ForgotPasswordLink`

```tsx
type ForgotPasswordLinkProps = { onPress: () => void };
```

Right-aligned `Pressable` wrapping `Text tone="muted"` with `t('auth.forgotPassword')`. Used on login only; signup composes without it.

### `apps/mobile/components/auth/index.ts`

Barrel: re-exports the five components above. Both route files import via `from '../../components/auth'`.

## Asset

The Google "G" mark. Ordago uses `packages/shared/assets/google-g.jpg`. Cultuvilla has no equivalent today.

**Decision:** Add `apps/mobile/assets/google-g.png` (PNG, transparent background) alongside this work. Source: official Google brand guidelines G mark. Bundled with the mobile app, not in `packages/shared` (web is gone — `apps/mobile/` is the only consumer).

## i18n

Existing keys reused as-is (no edits to existing text):

- `auth.login.title`, `auth.signup.title`
- `auth.login.submit`, `auth.signup.submit`
- `auth.login.toSignup`, `auth.signup.toLogin`
- `auth.email`, `auth.password`, `auth.passwordHint`
- `auth.forgotPassword`, `auth.forgotPasswordSent`, `auth.forgotPasswordNeedsEmail`
- `auth.signInWithGoogle` (already "Continuar con Google")
- `auth.error.unknown`

New keys (added under `auth` namespace, both `es` and `en`, via the `i18n-add-string` skill):

- `auth.divider.or` — es: `"O"`, en: `"OR"`
- `auth.googleConnecting` — es: `"Conectando con Google…"`, en: `"Connecting to Google…"`

## AuthContext / behavior

**Unchanged.** `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signOut` keep the same signatures and behavior. The new screens call the same hook methods.

## Testing

**Component tests** (vitest + React Native Testing Library, under `apps/mobile/components/auth/__tests__/`):

- `AuthHeader.test.tsx` — renders an `Image` and the provided title.
- `OrDivider.test.tsx` — renders the label from i18n; renders two divider lines.
- `GoogleButton.test.tsx` — fires `onPress`; renders normal vs loading label; disabled while loading.
- `ForgotPasswordLink.test.tsx` — fires `onPress`; uses `t('auth.forgotPassword')`.

**Route tests** (update existing under `apps/mobile/app/(auth)/__tests__/` if present, else add):

- `login.test.tsx` — assert presence of logo (`AuthHeader`), email input, password input with toggle, `testID="login-forgot"`, primary submit, `OrDivider`, `testID="login-google-button"`, link to signup.
- `signup.test.tsx` — same minus forgot link, plus password hint, link to login.

Behavioral tests for `AuthContext` and `useAuth` are unchanged and should not need re-runs unless they happen to render the auth screens — in which case they're snapshot-only updates, no logic change.

## Accessibility

- Logo `Image` gets an `accessibilityLabel` of the app name (e.g. "Cultuvilla").
- `OrDivider` is `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` — purely decorative; screen readers don't need to read "O".
- `ForgotPasswordLink` has `accessibilityRole="button"` (already used in today's screen).
- `GoogleButton` has `accessibilityRole="button"` and `accessibilityLabel={t('auth.signInWithGoogle')}`.

## Mobile-web considerations

Per `mobile-web-compat` skill notes: the new components avoid `Animated.*` (no animations introduced), `Modal` (not used), and `Alert.alert` (we already render error/info as text). `KeyboardAvoidingView` is wrapped so that on web it acts as a no-op `View` — but the `Platform.OS === 'web'` short-circuit is already a project convention; we follow it inside `AuthCard`.

## Migration / rollout

Single PR / single commit on `main` (project convention — direct push to main is allowed). No feature flag. The screens swap atomically; there is no partially-styled intermediate state because the old screen is replaced wholesale by the new composition.

## Open questions

- **Google G asset license:** confirm we have rights to ship Google's G mark in our binary. Cultuvilla is a free community app; usage falls under Google's "Sign in with Google" branding guidelines, which is allowed. No legal blocker expected, but flag for visibility.
