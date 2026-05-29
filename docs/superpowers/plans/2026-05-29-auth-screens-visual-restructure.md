# Auth screens visual restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `apps/mobile/app/(auth)/login.tsx` and `signup.tsx` to match ordago's login layout (logo → title → fields → forgot link → primary CTA → "O" divider → branded Google button → cross-link), using cultuvilla's TypeScript design primitives. Extract the shared pieces into `apps/mobile/components/auth/`.

**Architecture:** Five small, composable components in a new `components/auth/` folder. Both route files compose them; auth behavior in `lib/auth/AuthContext.tsx` is untouched. New asset `assets/google-g.png`. Two new Spanish i18n keys.

**Tech Stack:** React Native (Expo 54), TypeScript, NativeWind 4, jest + @testing-library/react-native, expo-router, existing `@cultuvilla/i18n` + `@cultuvilla/shared/design-system` packages.

**Reference spec:** `docs/superpowers/specs/2026-05-29-auth-screens-visual-restructure-design.md`

**Source app for inspiration:** `~/githubs/ordago-apps/apps/ordago-app/screens/auth/LoginScreen.js` (visual structure only — not the JS code, not the nickname modal, not Apple).

---

## File map

**Create:**
- `apps/mobile/assets/google-g.jpg` (copied from `~/githubs/ordago-apps/packages/shared/assets/google-g.jpg`)
- `apps/mobile/components/auth/AuthCard.tsx`
- `apps/mobile/components/auth/AuthHeader.tsx`
- `apps/mobile/components/auth/OrDivider.tsx`
- `apps/mobile/components/auth/GoogleButton.tsx`
- `apps/mobile/components/auth/ForgotPasswordLink.tsx`
- `apps/mobile/components/auth/index.ts`
- `apps/mobile/components/auth/__tests__/AuthHeader.test.tsx`
- `apps/mobile/components/auth/__tests__/OrDivider.test.tsx`
- `apps/mobile/components/auth/__tests__/GoogleButton.test.tsx`
- `apps/mobile/components/auth/__tests__/ForgotPasswordLink.test.tsx`

**Modify:**
- `packages/i18n/messages/es.json` — add `auth.divider.or` and `auth.googleConnecting`
- `apps/mobile/app/(auth)/login.tsx` — rewrite to compose from `components/auth/`
- `apps/mobile/app/(auth)/signup.tsx` — rewrite to compose from `components/auth/`

**Untouched:**
- `apps/mobile/lib/auth/AuthContext.tsx`
- `apps/mobile/lib/auth/useAuth.ts`
- `apps/mobile/app/(auth)/_layout.tsx`
- All `userService`, models, services, rules, cloud functions

---

## Test commands cheat-sheet

- Run all mobile tests: `pnpm --filter cultuvilla-mobile test`
- Run one test file: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/OrDivider.test.tsx`
- Typecheck: `pnpm --filter cultuvilla-mobile typecheck`
- Full check (root): `pnpm check`

---

## Task 1: Add new i18n keys

**Files:**
- Modify: `packages/i18n/messages/es.json`

- [ ] **Step 1: Add the two new keys to the `auth` namespace**

Open `packages/i18n/messages/es.json`. Locate the `"auth": { … }` block. Insert these two key/value pairs **before** the existing `"login"` nested block (alphabetical-ish position, after `"error"`/`"forgotPassword*"` keys, before `"login"`):

```json
    "divider": {
      "or": "O"
    },
    "googleConnecting": "Conectando con Google…",
```

After the edit, the relevant portion of `auth` should look like:

```json
  "auth": {
    "signIn": "Iniciar sesión",
    "signUp": "Registrarse",
    "signOut": "Cerrar sesión",
    "signInWithGoogle": "Continuar con Google",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "displayName": "Nombre",
    "birthday": "Fecha de nacimiento",
    "passwordHint": "Mínimo 6 caracteres.",
    "forgotPassword": "¿Olvidaste tu contraseña?",
    "forgotPasswordSent": "Te enviamos un correo para restablecerla.",
    "forgotPasswordNeedsEmail": "Introduce tu correo arriba primero.",
    "divider": {
      "or": "O"
    },
    "googleConnecting": "Conectando con Google…",
    "login": { … },
    "signup": { … },
    "error": { … }
  },
```

(Use the existing `Edit` tool — locate by inserting after `"forgotPasswordNeedsEmail": "Introduce tu correo arriba primero.",`. Don't reformat unrelated keys.)

- [ ] **Step 2: Verify the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/i18n/messages/es.json','utf8')); console.log('ok')"`
Expected: prints `ok`

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/messages/es.json
git commit -m "i18n(auth): add divider.or and googleConnecting (es)"
```

---

## Task 2: Add Google G brand asset

**Files:**
- Create: `apps/mobile/assets/google-g.jpg`

- [ ] **Step 1: Copy the asset from the ordago-apps reference repo**

Run: `cp ~/githubs/ordago-apps/packages/shared/assets/google-g.jpg apps/mobile/assets/google-g.jpg`

- [ ] **Step 2: Verify the file exists and is non-empty**

Run: `ls -la apps/mobile/assets/google-g.jpg`
Expected: a file ~1-10 KB. (If for any reason the source path doesn't exist, abort this task and ask the user for a Google "G" PNG.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/assets/google-g.jpg
git commit -m "feat(mobile): add google-g.jpg brand asset for auth screens"
```

---

## Task 3: `AuthHeader` component (logo + title)

**Files:**
- Create: `apps/mobile/components/auth/AuthHeader.tsx`
- Create: `apps/mobile/components/auth/__tests__/AuthHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/auth/__tests__/AuthHeader.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { AuthHeader } from '../AuthHeader';

describe('<AuthHeader>', () => {
  it('renders the title', () => {
    const { getByText } = render(<AuthHeader title="Iniciar sesión" />);
    expect(getByText('Iniciar sesión')).toBeTruthy();
  });

  it('renders the app logo image with an accessibility label', () => {
    const { getByLabelText } = render(<AuthHeader title="x" />);
    expect(getByLabelText('Cultuvilla')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/AuthHeader.test.tsx`
Expected: FAIL — cannot find module `../AuthHeader`.

- [ ] **Step 3: Implement `AuthHeader`**

Create `apps/mobile/components/auth/AuthHeader.tsx`:

```tsx
import { Image, View } from 'react-native';
import { Text } from '../primitives/Text';

const APP_LOGO = require('../../assets/icon.png');

export type AuthHeaderProps = { title: string };

export function AuthHeader({ title }: AuthHeaderProps) {
  return (
    <View className="items-center mb-4">
      <Image
        source={APP_LOGO}
        accessibilityLabel="Cultuvilla"
        style={{ width: 96, height: 96, borderRadius: 20, resizeMode: 'contain' }}
      />
      <Text variant="h2" className="text-center mt-4">
        {title}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/AuthHeader.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/auth/AuthHeader.tsx apps/mobile/components/auth/__tests__/AuthHeader.test.tsx
git commit -m "feat(mobile/auth): AuthHeader (logo + centered title)"
```

---

## Task 4: `OrDivider` component

**Files:**
- Create: `apps/mobile/components/auth/OrDivider.tsx`
- Create: `apps/mobile/components/auth/__tests__/OrDivider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/auth/__tests__/OrDivider.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { I18nProvider } from '../../../lib/i18n';
import { OrDivider } from '../OrDivider';

describe('<OrDivider>', () => {
  it('renders the localized "O" label by default', () => {
    const { getByText } = render(
      <I18nProvider>
        <OrDivider />
      </I18nProvider>,
    );
    expect(getByText('O')).toBeTruthy();
  });

  it('renders a custom label when given', () => {
    const { getByText } = render(
      <I18nProvider>
        <OrDivider label="OR" />
      </I18nProvider>,
    );
    expect(getByText('OR')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/OrDivider.test.tsx`
Expected: FAIL — cannot find module `../OrDivider`.

- [ ] **Step 3: Implement `OrDivider`**

Create `apps/mobile/components/auth/OrDivider.tsx`:

```tsx
import { View } from 'react-native';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

export type OrDividerProps = { label?: string };

export function OrDivider({ label }: OrDividerProps) {
  const { t } = useT();
  const text = label ?? t('auth.divider.or');
  return (
    <View
      className="flex-row items-center justify-center my-2"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="flex-1 h-px bg-subtle mx-2" />
      <Text tone="muted">{text}</Text>
      <View className="flex-1 h-px bg-subtle mx-2" />
    </View>
  );
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/OrDivider.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/auth/OrDivider.tsx apps/mobile/components/auth/__tests__/OrDivider.test.tsx
git commit -m "feat(mobile/auth): OrDivider"
```

---

## Task 5: `GoogleButton` component

**Files:**
- Create: `apps/mobile/components/auth/GoogleButton.tsx`
- Create: `apps/mobile/components/auth/__tests__/GoogleButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/auth/__tests__/GoogleButton.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '../../../lib/i18n';
import { GoogleButton } from '../GoogleButton';

describe('<GoogleButton>', () => {
  it('renders the default label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <I18nProvider>
        <GoogleButton onPress={onPress} testID="g" />
      </I18nProvider>,
    );
    expect(getByText('Continuar con Google')).toBeTruthy();
    fireEvent.press(getByText('Continuar con Google'));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows the loading label and does not call onPress while loading', () => {
    const onPress = jest.fn();
    const { getByText, queryByText } = render(
      <I18nProvider>
        <GoogleButton onPress={onPress} loading testID="g" />
      </I18nProvider>,
    );
    expect(getByText('Conectando con Google…')).toBeTruthy();
    expect(queryByText('Continuar con Google')).toBeNull();
    fireEvent.press(getByText('Conectando con Google…'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/GoogleButton.test.tsx`
Expected: FAIL — cannot find module `../GoogleButton`.

- [ ] **Step 3: Implement `GoogleButton`**

Create `apps/mobile/components/auth/GoogleButton.tsx`:

```tsx
import { Image, View } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

const GOOGLE_G = require('../../assets/google-g.jpg');

export type GoogleButtonProps = {
  onPress: () => void;
  loading?: boolean;
  testID?: string;
};

export function GoogleButton({ onPress, loading = false, testID }: GoogleButtonProps) {
  const { t } = useT();
  const label = loading ? t('auth.googleConnecting') : t('auth.signInWithGoogle');
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t('auth.signInWithGoogle')}
      testID={testID}
      className="bg-surface border border-subtle rounded-md h-14 px-4 justify-center"
    >
      <View className="flex-row items-center justify-center">
        <Image
          source={GOOGLE_G}
          style={{ width: 22, height: 22, marginRight: 12, resizeMode: 'contain' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text>{label}</Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/GoogleButton.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/auth/GoogleButton.tsx apps/mobile/components/auth/__tests__/GoogleButton.test.tsx
git commit -m "feat(mobile/auth): GoogleButton (branded white button)"
```

---

## Task 6: `ForgotPasswordLink` component

**Files:**
- Create: `apps/mobile/components/auth/ForgotPasswordLink.tsx`
- Create: `apps/mobile/components/auth/__tests__/ForgotPasswordLink.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/components/auth/__tests__/ForgotPasswordLink.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '../../../lib/i18n';
import { ForgotPasswordLink } from '../ForgotPasswordLink';

describe('<ForgotPasswordLink>', () => {
  it('renders the localized label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <I18nProvider>
        <ForgotPasswordLink onPress={onPress} />
      </I18nProvider>,
    );
    const link = getByText('¿Olvidaste tu contraseña?');
    expect(link).toBeTruthy();
    fireEvent.press(link);
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test (expect failure)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/ForgotPasswordLink.test.tsx`
Expected: FAIL — cannot find module `../ForgotPasswordLink`.

- [ ] **Step 3: Implement `ForgotPasswordLink`**

Create `apps/mobile/components/auth/ForgotPasswordLink.tsx`:

```tsx
import { View } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';

export type ForgotPasswordLinkProps = { onPress: () => void };

export function ForgotPasswordLink({ onPress }: ForgotPasswordLinkProps) {
  const { t } = useT();
  return (
    <View className="items-end">
      <Pressable onPress={onPress} accessibilityRole="button">
        <Text tone="muted" variant="bodySm">
          {t('auth.forgotPassword')}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm --filter cultuvilla-mobile test -- components/auth/__tests__/ForgotPasswordLink.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/auth/ForgotPasswordLink.tsx apps/mobile/components/auth/__tests__/ForgotPasswordLink.test.tsx
git commit -m "feat(mobile/auth): ForgotPasswordLink (right-aligned, low-emphasis)"
```

---

## Task 7: `AuthCard` component (layout wrapper)

**Files:**
- Create: `apps/mobile/components/auth/AuthCard.tsx`

No test for this one — it's a pure layout wrapper with no behavior, and the route-level visual gets exercised by manual verification (Task 11) and the existing `AuthContext` integration tests that already pass through it.

- [ ] **Step 1: Implement `AuthCard`**

Create `apps/mobile/components/auth/AuthCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Screen } from '../primitives/Screen';
import { VStack } from '../primitives/VStack';

export type AuthCardProps = { children: ReactNode };

export function AuthCard({ children }: AuthCardProps) {
  return (
    <Screen scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center">
          <VStack gap={4} className="w-full" align="stretch">
            <View style={{ maxWidth: 360, width: '100%', alignSelf: 'center' }}>
              {children}
            </View>
          </VStack>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/auth/AuthCard.tsx
git commit -m "feat(mobile/auth): AuthCard (scrollable, kbd-aware, centered narrow column)"
```

---

## Task 8: Barrel file `components/auth/index.ts`

**Files:**
- Create: `apps/mobile/components/auth/index.ts`

- [ ] **Step 1: Write the barrel**

Create `apps/mobile/components/auth/index.ts`:

```ts
export { AuthCard } from './AuthCard';
export { AuthHeader } from './AuthHeader';
export { OrDivider } from './OrDivider';
export { GoogleButton } from './GoogleButton';
export { ForgotPasswordLink } from './ForgotPasswordLink';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/auth/index.ts
git commit -m "feat(mobile/auth): barrel index"
```

---

## Task 9: Rewrite `login.tsx`

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/mobile/app/(auth)/login.tsx` with:

```tsx
import { useState } from 'react';
import { Link, router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getAuth } from '@cultuvilla/shared/firebase';
import { Button, Input, PasswordInput, Text, VStack } from '../../components/primitives';
import {
  AuthCard,
  AuthHeader,
  ForgotPasswordLink,
  GoogleButton,
  OrDivider,
} from '../../components/auth';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function LoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function onForgot() {
    setError(null);
    setInfo(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('auth.forgotPasswordNeedsEmail'));
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), trimmed);
      setInfo(t('auth.forgotPasswordSent'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    }
  }

  return (
    <AuthCard>
      <AuthHeader title={t('auth.login.title')} />
      <VStack gap={3}>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          testID="login-password"
        />
        <ForgotPasswordLink onPress={onForgot} />
        {error != null && <Text tone="danger">{error}</Text>}
        {info != null && <Text tone="muted">{info}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth testID="login-submit">
          {t('auth.login.submit')}
        </Button>
        <OrDivider />
        <GoogleButton onPress={onGoogle} loading={googleLoading} testID="login-google-button" />
        <Link href="/signup">
          <Text tone="muted" className="text-center">
            {t('auth.login.toSignup')}
          </Text>
        </Link>
      </VStack>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/login.tsx
git commit -m "feat(mobile): restyle login screen (ordago-inspired layout)"
```

---

## Task 10: Rewrite `signup.tsx`

**Files:**
- Modify: `apps/mobile/app/(auth)/signup.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/mobile/app/(auth)/signup.tsx` with:

```tsx
import { useState } from 'react';
import { Link, router } from 'expo-router';
import { Button, Input, PasswordInput, Text, VStack } from '../../components/primitives';
import {
  AuthCard,
  AuthHeader,
  GoogleButton,
  OrDivider,
} from '../../components/auth';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';

export default function SignupScreen() {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error.unknown'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthCard>
      <AuthHeader title={t('auth.signup.title')} />
      <VStack gap={3}>
        <Input
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <PasswordInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          testID="signup-password"
        />
        <Text tone="muted" variant="bodySm">
          {t('auth.passwordHint')}
        </Text>
        {error != null && <Text tone="danger">{error}</Text>}
        <Button onPress={onSubmit} loading={loading} fullWidth testID="signup-submit">
          {t('auth.signup.submit')}
        </Button>
        <OrDivider />
        <GoogleButton onPress={onGoogle} loading={googleLoading} testID="signup-google-button" />
        <Link href="/login">
          <Text tone="muted" className="text-center">
            {t('auth.signup.toLogin')}
          </Text>
        </Link>
      </VStack>
    </AuthCard>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter cultuvilla-mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/signup.tsx
git commit -m "feat(mobile): restyle signup screen to match new login layout"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run the entire mobile test suite**

Run: `pnpm --filter cultuvilla-mobile test`
Expected: all tests pass. Existing `AuthContext.test.tsx` and `useIsAppAdmin.test.tsx` should continue to pass — we did not touch their code. The five new component tests should all pass.

- [ ] **Step 2: Run root-level check**

Run: `pnpm check`
Expected: clean exit. (This runs typechecks and lints across the workspace.)

- [ ] **Step 3: Visual smoke (skip if no AVD/web available)**

If able: `pnpm --filter cultuvilla-mobile web` and open the printed URL — verify the login & signup screens render with logo, eye toggle, right-aligned forgot-password (login only), "O" divider, Google G button. If no environment available, state explicitly in the final report that visual verification was not performed.

- [ ] **Step 4: Mark spec done**

Edit the spec header at `docs/superpowers/specs/2026-05-29-auth-screens-visual-restructure-design.md` to change `**Status:** Draft` to `**Status:** Done — implemented in <commit-sha-of-final-task>`. Find the final commit sha with `git log -1 --format=%H`. Commit the status update:

```bash
git add docs/superpowers/specs/2026-05-29-auth-screens-visual-restructure-design.md
git commit -m "docs(specs): mark auth screens visual restructure done"
```

---

## Notes for the executing agent

- **Don't run `expo prebuild`** or any native rebuild — this change is JS-only.
- **Don't add `en` strings.** Cultuvilla bundles Spanish only (see `packages/i18n/index.ts` — `SUPPORTED_LOCALES = ['es']`). The original spec mentioned `en`; that's incorrect and superseded by this plan.
- **Don't touch `AuthContext.tsx`.** If a test failure suggests an AuthContext bug, stop and report — that's a different change.
- **NativeWind class `bg-subtle` / `border-subtle` / `text-muted`** are the design tokens already used by `Input`, `Button`, etc. Don't introduce new colors.
- **The `Text` primitive's `variant`** is a `TypographyVariant` from `@cultuvilla/shared/design-system`. Valid values include `body`, `bodySm`, `h2`, `caption`. We use `h2` for the screen title and `bodySm` for low-emphasis text.
- **`I18nProvider` in tests:** the i18n module reads device locale via `expo-localization`. In the jest-expo preset, this works without extra setup — `I18nProvider` falls back to `es` if device locale is undefined, which is what we want.
- **All commits stay on the worktree branch.** No merging to main from inside the plan — that's a separate decision after the user verifies.
