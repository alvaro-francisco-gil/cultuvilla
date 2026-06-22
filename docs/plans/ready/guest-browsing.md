# Guest browsing

**Goal:** Let unregistered visitors browse Explora and any shared detail link, gate only the Pueblo/Perfil tabs and write-actions behind a register prompt, and return the visitor to their original intent after they register.

## Context

Today the app forces login at the root: [app/index.tsx](../../../apps/mobile/app/index.tsx) redirects unauthenticated users to `/(auth)/login`, and [app/(tabs)/_layout.tsx](../../../apps/mobile/app/(tabs)/_layout.tsx) redirects again. There is no guest browsing, yet most data is already public-readable and most detail screens (`/event/[eventId]`, etc.) already render without an auth guard — only their *actions* check for a user.

Many people will receive a link to a specific event. We want them to see the event immediately, only be asked to register when they try to *act* (register for the event, join an org) or open a personal tab, and — if they came in cold via a deep link — land on Explora when they press back.

Key finding from reading [firestore.rules](../../../firestore.rules): the data layer is **already** almost entirely `allow read: if true` — `events`, `news` (approved), `municipalities` (+ `barrios`/`places`/`members`/`inviteTokens`), `organizations` (+ `members`), `users`, `occupations`. The **only** read-gated collection in scope is `persons` (`allow read: if isAuthenticated()`, firestore.rules:638). So this is overwhelmingly a client-side routing/gating job with a one-line rules change.

## Design / approach

### 1. Routing — let guests in
- [app/index.tsx](../../../apps/mobile/app/index.tsx): remove the `!user → /(auth)/login` branch; always `<Redirect href="/(tabs)" />`.
- [app/(tabs)/_layout.tsx:24](../../../apps/mobile/app/(tabs)/_layout.tsx#L24): remove `if (!user) return <Redirect href="/login" />`. Keep the `if (loading) return null` guard. Guests now land on **Explora** (`(tabs)/index`).
- `AuthGate` / `resolveAuthRoute` ([lib/auth/authRoute.ts](../../../apps/mobile/lib/auth/authRoute.ts)) already return `null` for guests (no user ⇒ no redirect), so no change to the gate's existing branches — only the new intent-resume step in §6.

### 2. Tab gates (Pueblo + Perfil)
Intercept the tab press for guests instead of letting them navigate:

```tsx
<Tabs.Screen
  name="village"
  listeners={{
    tabPress: (e) => {
      if (!user) { e.preventDefault(); gate.requireAuth('/(tabs)/village'); }
    },
  }}
/>
```

Same for `profile` with intent `'/(tabs)/profile'`. The guest stays on Explora and the register sheet slides up. (Tab screens themselves keep rendering normally for authed users; the press interceptor is the only gate, so no inline guest state is needed inside `village.tsx`/`profile.tsx`.)

### 3. Action gates — the register sheet
A shared `<RegisterSheet>` overlay plus a `useRegisterGate()` hook exposing `requireAuth(intentHref): boolean`.

- `requireAuth(intentHref)`: if `user` exists, return `true` (caller proceeds). If guest, show the sheet (carrying `intentHref`) and return `false` (caller aborts the action).
- Sheet copy depends lightly on context (e.g. "Regístrate para unirte a este evento" / "…para ver tu pueblo"); a single optional `reason` string passed to `requireAuth` is enough — no need for a message registry.
- Sheet has **Registrarse** (commits the intent, see §6, then `router.push('/(auth)/login')`) and a dismiss affordance that keeps the guest browsing where they are.
- **Web build:** model on the existing `FilterSheet` bottom-sheet (`apps/mobile/components/feature/FilterSheet.tsx`) — RN `Modal` + `Animated`, which is known-good on the Firebase Hosting web export. Honor the `mobile-web-compat` rules: the Modal's fill child uses `StyleSheet.absoluteFillObject` (not `flex-1`), every `Animated.*` style goes on `style` not `className` (NativeWind drops `className` on animated components), and use `useNativeDriver: false` for the slide if a transform doesn't animate on web.

Action sites to route through `requireAuth`:
- Register-for-event button on [app/event/[eventId].tsx](../../../apps/mobile/app/event/[eventId].tsx) (today gated by `if (person && !registered)` — make the button visible to guests and gate on press, intent = current event route).
- Join-org on [app/o/[orgId].tsx](../../../apps/mobile/app/o/[orgId].tsx) `onJoin()` (replaces today's hard `router.push('/(auth)/login')`, intent = current org route).
- (News detail has no comment/react UI on the screen today — nothing to gate there yet. When that UI lands, route it through `requireAuth` too.)

### 4. Back-from-detail → Explora
Generalize the back button in [components/feature/FloatingBackButton.tsx](../../../apps/mobile/components/feature/FloatingBackButton.tsx):

```tsx
const onBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
```

A deep-linked first-contact visit (no history) lands on Explora; normal in-app navigation still pops naturally. This is the default `onBack`; callers passing a custom `onBack` are unaffected.

### 5. Rules change (minimal)
- `persons` (firestore.rules:638): `allow read: if isAuthenticated()` → `allow read: if true`, so `/person/[id]` renders for guests. Person docs are a genealogical registry (name, surnames, biography, birthday, photoURL) and `users` is already world-readable, so this is consistent with the existing posture.
- News **comments/reactions** stay gated (village-member read). Guests on a news detail see the post (the screen has no comment/react UI yet); when that UI is added it routes through `requireAuth`.
- ⚠️ `firestore.rules` already has uncommitted working-tree changes — rebase this one-liner onto whatever lands there; do not clobber.
- Deploy via the `firestore-deploy` skill (dev), with a rules unit test asserting unauthenticated `get` on `persons/{id}` is allowed.

### 6. Return to intent after register
- `requireAuth(intentHref)` **persists** `pendingIntent = intentHref` only on the **Registrarse tap** (not on sheet-open — dismissing leaves no stale intent).
- Persist via the **same cross-session storage already used for the email-link "pending email"** in [lib/auth/AuthContext.tsx](../../../apps/mobile/lib/auth/AuthContext.tsx). This matters: the email-link flow can resume in a different tab/session (continue URL `/finish`), where in-memory React state would not survive. Reuse that storage wrapper rather than inventing a new one.
- After auth **and** onboarding fully settle (`user && profileChecked && hasPersonId`), a resume step in `AuthGate` consumes `pendingIntent`: `router.replace(intentHref)` then clear. This runs ahead of / supersedes the default `/(tabs)` landing produced by `resolveAuthRoute` for the auth/onboarding groups.
- **Scope of "intent":** route-level only — navigate back to the *originating screen* (where the now-authed action button works), e.g. `/event/[id]` or the `village` tab. It does **not** auto-replay the action itself (auto-firing event registration through capacity/waitlist logic is fragile and is explicitly out of scope).
- `pendingIntent` is single-use: cleared on consume and on sign-out.

## Components / units

- `useRegisterGate()` hook + `RegisterGateProvider` (or fold into existing auth provider tree) — owns sheet visibility, the `reason` string, and `pendingIntent` persistence. One clear job: "decide whether an action may proceed, otherwise prompt to register."
- `<RegisterSheet>` — presentational bottom sheet modeled on `FilterSheet`; props: `visible`, `reason`, `onRegister`, `onDismiss`.
- Intent persistence helper — thin wrapper over the existing pending-email storage; `setPendingIntent`, `consumePendingIntent`, `clearPendingIntent`.
- `resolveAuthRoute` stays pure; the intent-resume lives in the `AuthGate` effect that already calls it, checked before applying the `/(tabs)` result.

## Testing

- `resolveAuthRoute` is already unit-tested; add a unit test for the intent-resume decision (pure helper that, given `{user, profileChecked, hasPersonId, pendingIntent}`, returns the intent href or falls through) so the precedence over `/(tabs)` is covered without mounting the navigator.
- Rules unit test (`@firebase/rules-unit-testing`, under `packages/shared/test/e2e/`): unauthenticated `get` on `persons/{id}` is allowed; comments/reactions reads still denied to non-members.
- Manual web-build check of the register sheet (the `Modal`/web reason for the overlay approach) and the back-from-deep-link → Explora behavior.

## Out of scope

- Auto-replaying the gated action after register (route-return only; see §6).
- Anonymous Firebase Auth / account-linking (decided against — public reads chosen; `user === null` means guest).
- Broadening news comments/reactions to public read.
- The pre-existing fact that `users` docs (incl. `email`/`telephone`) are world-readable — not introduced here, not addressed here.

---

# Guest browsing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let unregistered visitors browse Explora and any shared detail link; gate the Pueblo/Perfil tabs and the event-register / org-join actions behind a register sheet; return them to the originating screen after they register.

**Architecture:** Almost entirely client-side. A `RegisterGateProvider` (mounted above the navigator) owns a `requireAuth(intentHref, reason?)` gate and renders a single `<RegisterSheet>`. Routing stops forcing login at the root so guests land on Explora. A persisted `pendingIntent` (AsyncStorage, mirroring the existing pending-email mechanism) is resumed by `AuthGate` once the user finishes auth+onboarding. One Firestore rule (`persons` read) opens to public.

**Tech Stack:** Expo Router v56, React Native + RN-Web, NativeWind, Firebase Auth/Firestore, vitest, `@firebase/rules-unit-testing`.

## Global Constraints

- Expo SDK 56 — read https://docs.expo.dev/versions/v56.0.0/ before writing native/router code (per `apps/mobile/AGENTS.md`).
- Web-build safety (`mobile-web-compat`): inline every `Animated.*` style on `style` (never `className`); a `<Modal>` fill child uses `StyleSheet.absoluteFillObject`, not `flex-1`; any web-only style override must be `Platform.OS`-gated via `lib/platform.ts` helpers.
- All user-facing strings go through `useT()` + `packages/i18n/messages/es.json` (per `i18n-add-string`). No hardcoded Spanish in app screens.
- Firestore rules deploy to **dev only**, via the `firestore-deploy` skill. The `firestore.rules` working tree may carry unrelated in-flight changes on `main` — this branch forked from the latest commit; re-read the committed `persons` block before editing.
- TDD where a harness exists: pure helpers → vitest in `apps/mobile`; rules → `@firebase/rules-unit-testing` in `packages/shared`. UI/routing have no component-test harness in this repo — verify on the dev server (`pnpm app:web`) plus one native target.

## File Structure

- **Create** `apps/mobile/lib/auth/pendingIntent.ts` — AsyncStorage get/set/clear for the `pendingIntent` href (mirrors the pending-email helpers in `AuthContext.tsx`).
- **Create** `apps/mobile/lib/auth/RegisterGateContext.tsx` — `RegisterGateProvider` + `useRegisterGate()`; owns sheet state + `requireAuth` + `pendingIntent`; renders `<RegisterSheet>`.
- **Create** `apps/mobile/components/feature/RegisterSheet.tsx` — bottom sheet modeled on `FilterSheet.tsx` (RN `Modal` + `Animated`).
- **Modify** `apps/mobile/lib/auth/authRoute.ts` — add pure `resolveIntentResume(...)`.
- **Modify** `apps/mobile/lib/auth/__tests__/authRoute.test.ts` — tests for `resolveIntentResume`.
- **Modify** `apps/mobile/lib/auth/AuthContext.tsx` — `signOut()` clears `pendingIntent`.
- **Modify** `apps/mobile/app/_layout.tsx` — mount `RegisterGateProvider`; `AuthGate` resumes intent.
- **Modify** `apps/mobile/app/index.tsx` — always redirect to `/(tabs)`.
- **Modify** `apps/mobile/app/(tabs)/_layout.tsx` — drop the `!user` redirect; gate `village`/`profile` tab presses.
- **Modify** `apps/mobile/app/event/[eventId].tsx` — guest register CTA → `requireAuth`.
- **Modify** `apps/mobile/app/o/[orgId].tsx` — `onJoin` guest branch → `requireAuth`.
- **Modify** `apps/mobile/components/feature/FloatingBackButton.tsx` — `canGoBack()` fallback to `/(tabs)`.
- **Modify** `firestore.rules` — `persons` read → `if true`.
- **Modify** `packages/shared/test/e2e/personRules.test.ts` — unauthenticated read succeeds.
- **Modify** `packages/i18n/messages/es.json` — `guest.*` strings.

---

### Task 1: `resolveIntentResume` pure helper

**Files:**
- Modify: `apps/mobile/lib/auth/authRoute.ts`
- Test: `apps/mobile/lib/auth/__tests__/authRoute.test.ts`

**Interfaces:**
- Produces: `resolveIntentResume(input: IntentResumeInput): string | null` where `IntentResumeInput = { user: boolean; profileChecked: boolean; hasPersonId: boolean; pendingIntent: string | null }`. Returns the intent href when the user is fully authed+onboarded and an intent is pending, else `null`.

- [ ] **Step 1: Write the failing tests** — append to `__tests__/authRoute.test.ts`:

```ts
import { resolveAuthRoute, resolveIntentResume } from '../authRoute';

describe('resolveIntentResume', () => {
  const base = { user: true, profileChecked: true, hasPersonId: true, pendingIntent: '/event/e1' };

  it('returns the pending intent once the user is authed and onboarded', () => {
    expect(resolveIntentResume(base)).toBe('/event/e1');
  });

  it('returns null while onboarding is incomplete', () => {
    expect(resolveIntentResume({ ...base, hasPersonId: false })).toBeNull();
  });

  it('returns null before the profile fetch settles', () => {
    expect(resolveIntentResume({ ...base, profileChecked: false })).toBeNull();
  });

  it('returns null for a guest', () => {
    expect(resolveIntentResume({ ...base, user: false })).toBeNull();
  });

  it('returns null when there is no pending intent', () => {
    expect(resolveIntentResume({ ...base, pendingIntent: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify it fails** — `cd apps/mobile && pnpm test authRoute` → FAIL (`resolveIntentResume is not a function`).

- [ ] **Step 3: Implement** — append to `authRoute.ts`:

```ts
export interface IntentResumeInput {
  user: boolean;
  profileChecked: boolean;
  hasPersonId: boolean;
  pendingIntent: string | null;
}

/**
 * After a guest registers from a gated action, they resume their original
 * intent (the screen/tab they were trying to reach) instead of the default
 * /(tabs) landing — but only once auth AND onboarding have fully settled.
 * Kept pure so the precedence over resolveAuthRoute is unit-testable.
 */
export function resolveIntentResume({
  user,
  profileChecked,
  hasPersonId,
  pendingIntent,
}: IntentResumeInput): string | null {
  if (user && profileChecked && hasPersonId && pendingIntent) return pendingIntent;
  return null;
}
```

- [ ] **Step 4: Run, verify pass** — `cd apps/mobile && pnpm test authRoute` → PASS.

- [ ] **Step 5: Commit** — `git add apps/mobile/lib/auth/authRoute.ts apps/mobile/lib/auth/__tests__/authRoute.test.ts && git commit -m "feat(mobile): resolveIntentResume helper for post-register intent resume"`

---

### Task 2: `pendingIntent` storage + clear on sign-out

**Files:**
- Create: `apps/mobile/lib/auth/pendingIntent.ts`
- Modify: `apps/mobile/lib/auth/AuthContext.tsx` (signOut, ~lines 217–230)

**Interfaces:**
- Produces: `setPendingIntent(href: string): Promise<void>`, `readPendingIntent(): Promise<string | null>`, `clearPendingIntent(): Promise<void>`.

- [ ] **Step 1: Create the module** — `apps/mobile/lib/auth/pendingIntent.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mirrors PENDING_EMAIL_KEY in AuthContext.tsx — same cross-session storage,
// so an intent set before an email-link flow survives a tab/session change.
const PENDING_INTENT_KEY = 'cultuvilla.pendingIntent';

export async function setPendingIntent(href: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INTENT_KEY, href);
}

export async function readPendingIntent(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_INTENT_KEY);
}

export async function clearPendingIntent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INTENT_KEY);
}
```

- [ ] **Step 2: Clear on sign-out** — in `AuthContext.tsx`, import at top:

```ts
import { clearPendingIntent } from './pendingIntent';
```

and add to `signOut`, before `await fbSignOut(getAuth());`:

```ts
    await clearPendingIntent();
```

- [ ] **Step 3: Type-check** — `cd apps/mobile && pnpm exec tsc --noEmit` (or `pnpm check` at repo root) → no new errors.

- [ ] **Step 4: Commit** — `git add apps/mobile/lib/auth/pendingIntent.ts apps/mobile/lib/auth/AuthContext.tsx && git commit -m "feat(mobile): pendingIntent storage; cleared on sign-out"`

---

### Task 3: `RegisterSheet` + `RegisterGateProvider` + `useRegisterGate`

**Files:**
- Create: `apps/mobile/components/feature/RegisterSheet.tsx`
- Create: `apps/mobile/lib/auth/RegisterGateContext.tsx`
- Modify: `packages/i18n/messages/es.json`

**Interfaces:**
- Consumes: `setPendingIntent`, `readPendingIntent`, `clearPendingIntent` (Task 2); `useAuth()` (`user`).
- Produces: `useRegisterGate(): { requireAuth: (intentHref: string, reason?: string) => boolean; pendingIntent: string | null; clearPending: () => void }`. `requireAuth` returns `true` (proceed) when authed; otherwise shows the sheet carrying `intentHref`/`reason` and returns `false`.

- [ ] **Step 1: Add i18n strings** — add a `"guest"` namespace to `packages/i18n/messages/es.json` (alphabetically near other top-level keys), plus the event CTA:

```json
"guest": {
  "title": "Únete a Cultuvilla",
  "village": "Regístrate para ver tu pueblo.",
  "profile": "Regístrate para crear tu perfil.",
  "event": "Regístrate para apuntarte a este evento.",
  "org": "Regístrate para unirte a esta organización.",
  "eventCta": "Apuntarme",
  "register": "Registrarse",
  "dismiss": "Ahora no"
}
```

- [ ] **Step 2: Create `RegisterSheet.tsx`** (modeled on `FilterSheet.tsx`; inline styles on `Animated.*`, `absoluteFill` backdrop):

```tsx
import { useEffect, useRef } from 'react';
import { Modal, View, Animated, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { Button } from '../primitives/Button';
import { VStack } from '../primitives/VStack';
import { useT } from '../../lib/i18n';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type RegisterSheetProps = {
  visible: boolean;
  reason?: string;
  onRegister: () => void;
  onDismiss: () => void;
};

export function RegisterSheet({ visible, reason, onRegister, onDismiss }: RegisterSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  // useNativeDriver:false — RN-Web has shipped translateY springs that don't
  // move on web with the native driver (mobile-web-compat).
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: false }),
      ]).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }]}>
        <Pressable onPress={onDismiss} accessibilityLabel={t('guest.dismiss')} style={StyleSheet.absoluteFill}>
          <View />
        </Pressable>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: insets.bottom + 16,
            backgroundColor: '#ffffff', // colors.ts: light.bg.base (white)
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            style={{
              width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2,
              alignSelf: 'center', marginTop: 12, marginBottom: 8,
            }}
          />
          <VStack gap={3} className="px-5 pt-2">
            <Text variant="h3">{t('guest.title')}</Text>
            {reason ? <Text tone="muted">{reason}</Text> : null}
            <Button variant="primary" fullWidth onPress={onRegister}>
              {t('guest.register')}
            </Button>
            <Pressable onPress={onDismiss} accessibilityLabel={t('guest.dismiss')} className="items-center py-2">
              <Text tone="muted">{t('guest.dismiss')}</Text>
            </Pressable>
          </VStack>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
```

(If `Button`/`VStack` import paths differ, match the imports used in `app/o/[orgId].tsx`, which uses both.)

- [ ] **Step 3: Create `RegisterGateContext.tsx`:**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { useAuth } from './useAuth';
import { readPendingIntent, setPendingIntent, clearPendingIntent } from './pendingIntent';
import { RegisterSheet } from '../../components/feature/RegisterSheet';

interface RegisterGateValue {
  requireAuth: (intentHref: string, reason?: string) => boolean;
  pendingIntent: string | null;
  clearPending: () => void;
}

const Ctx = createContext<RegisterGateValue | null>(null);

export function RegisterGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [intent, setIntent] = useState<string | null>(null);
  const [pendingIntent, setPending] = useState<string | null>(null);

  useEffect(() => {
    void readPendingIntent().then(setPending);
  }, []);

  const requireAuth = useCallback(
    (intentHref: string, r?: string) => {
      if (user) return true;
      setIntent(intentHref);
      setReason(r);
      setVisible(true);
      return false;
    },
    [user],
  );

  const onRegister = useCallback(() => {
    // Persist only on commit, so dismissing leaves no stale intent.
    if (intent) {
      void setPendingIntent(intent);
      setPending(intent);
    }
    setVisible(false);
    router.push('/(auth)/login');
  }, [intent]);

  const clearPending = useCallback(() => {
    setPending(null);
    void clearPendingIntent();
  }, []);

  const value = useMemo<RegisterGateValue>(
    () => ({ requireAuth, pendingIntent, clearPending }),
    [requireAuth, pendingIntent, clearPending],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <RegisterSheet visible={visible} reason={reason} onRegister={onRegister} onDismiss={() => setVisible(false)} />
    </Ctx.Provider>
  );
}

export function useRegisterGate(): RegisterGateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRegisterGate must be used within RegisterGateProvider');
  return v;
}
```

- [ ] **Step 4: Type-check** — `cd apps/mobile && pnpm exec tsc --noEmit` → no new errors. (Provider not mounted yet; that's Task 4.)

- [ ] **Step 5: Commit** — `git add apps/mobile/components/feature/RegisterSheet.tsx apps/mobile/lib/auth/RegisterGateContext.tsx packages/i18n/messages/es.json && git commit -m "feat(mobile): RegisterSheet + RegisterGate context"`

---

### Task 4: Mount the provider, open the root to guests, resume intent

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `RegisterGateProvider`, `useRegisterGate` (Task 3); `resolveIntentResume` (Task 1).

- [ ] **Step 1: `index.tsx` — always land on tabs:**

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)" />;
}
```

- [ ] **Step 2: `_layout.tsx` — mount provider + resume intent.** Add imports:

```tsx
import { Redirect, Stack, useSegments, router } from 'expo-router';
import { useEffect } from 'react';
import { RegisterGateProvider, useRegisterGate } from '../lib/auth/RegisterGateContext';
import { resolveAuthRoute, resolveIntentResume } from '../lib/auth/authRoute';
```

Wrap `<AuthGate />` in the provider:

```tsx
          <AuthProvider>
            <RegisterGateProvider>
              <AuthGate />
            </RegisterGateProvider>
          </AuthProvider>
```

In `AuthGate`, add intent resume (after the existing `loading` guard, before `resolveAuthRoute`):

```tsx
  const { pendingIntent, clearPending } = useRegisterGate();
  const intentTarget = resolveIntentResume({
    user: !!user,
    profileChecked,
    hasPersonId: !!profile?.personId,
    pendingIntent,
  });

  useEffect(() => {
    if (intentTarget) {
      clearPending();
      router.replace(intentTarget);
    }
  }, [intentTarget, clearPending]);

  // While resuming, suppress the default /(tabs) redirect so the replace wins.
  if (intentTarget) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }
```

- [ ] **Step 3: `(tabs)/_layout.tsx` — open to guests + gate tab presses.** Remove `if (!user) return <Redirect href="/login" />;` (keep `if (loading) return null;`). Drop the now-unused `Redirect` import. Add `import { useRegisterGate } from '../../lib/auth/RegisterGateContext';` and inside the component `const gate = useRegisterGate();`. Add `listeners` to the `village` and `profile` screens:

```tsx
      <Tabs.Screen
        name="village"
        options={{ title: t('tabs.village'), tabBarIcon: /* unchanged */ }}
        listeners={{
          tabPress: (e) => {
            if (!user) { e.preventDefault(); gate.requireAuth('/(tabs)/village', t('guest.village')); }
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: /* unchanged */ }}
        listeners={{
          tabPress: (e) => {
            if (!user) { e.preventDefault(); gate.requireAuth('/(tabs)/profile', t('guest.profile')); }
          },
        }}
      />
```

- [ ] **Step 4: Type-check** — `cd apps/mobile && pnpm exec tsc --noEmit` → no new errors.

- [ ] **Step 5: Manual verify (dev server)** — `pnpm app:web`, then signed-out:
  - Land on Explora (no bounce to /login). ✓
  - Tap Pueblo / Perfil → stay on Explora, sheet slides up. ✓
  - Dismiss sheet → still on Explora, no later redirect. ✓
  Press `w` then a native target to confirm no native regression (sheet + tab nav).

- [ ] **Step 6: Commit** — `git add apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx apps/mobile/app/(tabs)/_layout.tsx && git commit -m "feat(mobile): guests land on Explora; gate Pueblo/Perfil tabs; resume intent after register"`

---

### Task 5: Gate the event-register and org-join actions

**Files:**
- Modify: `apps/mobile/app/event/[eventId].tsx` (registration UI block, ~lines 105–128)
- Modify: `apps/mobile/app/o/[orgId].tsx` (`onJoin`, ~lines 55–67)

**Interfaces:**
- Consumes: `useRegisterGate` (Task 3); `guest.event` / `guest.eventCta` / `guest.org` strings (Task 3).

- [ ] **Step 1: Event screen — add a guest CTA.** Add `import { useRegisterGate } from '../../lib/auth/RegisterGateContext';` and `import { Button } from '../../components/primitives/Button';` (if not already imported), and inside the component `const gate = useRegisterGate();`. In the registration UI block, add a guest branch alongside the existing authed `RegisterButton`:

```tsx
        {!user && (
          <Button
            variant="primary"
            fullWidth
            onPress={() => gate.requireAuth(`/event/${event.id}`, t('guest.event'))}
          >
            {t('guest.eventCta')}
          </Button>
        )}
        {person && !registered && event.telephoneRequired && (
          /* unchanged Input */
        )}
        {person && !registered && (
          /* unchanged RegisterButton */
        )}
```

(The existing `{!person && user && (...needsPerson)}` line stays — it covers the authed-but-no-persona case.)

- [ ] **Step 2: Org screen — gate `onJoin`.** Add `import { useRegisterGate } from '../../lib/auth/RegisterGateContext';`, `const gate = useRegisterGate();`, and replace the guest branch:

```tsx
  const onJoin = useCallback(async () => {
    if (!user) {
      gate.requireAuth(`/o/${orgId}`, t('guest.org'));
      return;
    }
    if (!orgId) return;
    setJoining(true);
    try {
      await addOrgMember(orgId as string, user.uid);
      await refresh();
    } finally {
      setJoining(false);
    }
  }, [user, orgId, refresh, gate, t]);
```

- [ ] **Step 3: Type-check** — `cd apps/mobile && pnpm exec tsc --noEmit` → no new errors.

- [ ] **Step 4: Manual verify (dev server)** — signed-out, open an event link → see the event + "Apuntarme" → tap → sheet (event reason). Open an org → tap join → sheet (org reason). Tap Registrarse → routed to login; complete sign-in + onboarding → land back on the **same event/org**.

- [ ] **Step 5: Commit** — `git add apps/mobile/app/event/[eventId].tsx apps/mobile/app/o/[orgId].tsx && git commit -m "feat(mobile): gate event-register and org-join behind register sheet for guests"`

---

### Task 6: Back-from-detail falls back to Explora

**Files:**
- Modify: `apps/mobile/components/feature/FloatingBackButton.tsx`

- [ ] **Step 1: Update the default handler:**

```tsx
const handleBack =
  onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')));
```

- [ ] **Step 2: Type-check** — `cd apps/mobile && pnpm exec tsc --noEmit` → no new errors.

- [ ] **Step 3: Manual verify** — open an event via a fresh deep link (no in-app history) → press the floating back chevron → land on Explora. Then navigate Explora → event → back → returns to Explora normally (history path unchanged).

- [ ] **Step 4: Commit** — `git add apps/mobile/components/feature/FloatingBackButton.tsx && git commit -m "feat(mobile): back from a deep-linked detail screen lands on Explora"`

---

### Task 7: Open `persons` read to guests + rules test + deploy

**Files:**
- Modify: `firestore.rules` (persons block, ~line 638)
- Modify: `packages/shared/test/e2e/personRules.test.ts`

- [ ] **Step 1: Write the failing rules test** — add to `personRules.test.ts` (ensure `getDoc` is imported from `firebase/firestore`):

```ts
  describe('read', () => {
    it('an unauthenticated user can read a person', async () => {
      await seedPerson();
      const guestDb = env.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(guestDb, `persons/${PERSON_ID}`)));
    });
  });
```

- [ ] **Step 2: Run, verify it fails** — `cd packages/shared && pnpm test personRules` (emulator harness) → FAIL (read denied for guest under the current `isAuthenticated()` rule).

- [ ] **Step 3: Open the rule** — in `firestore.rules`, in the `match /persons/{personId}` block:

```
      // Public read: person profiles are shareable links viewable by guests
      // (parity with events/orgs/users, all already world-readable). Writes
      // stay authed + ownership-gated below.
      allow read: if true;
```

- [ ] **Step 4: Run, verify pass** — `cd packages/shared && pnpm test personRules` → PASS (read test green; existing create/update tests still pass).

- [ ] **Step 5: Commit** — `git add firestore.rules packages/shared/test/e2e/personRules.test.ts && git commit -m "feat(rules): persons readable by guests; rules test for public read"`

- [ ] **Step 6: Deploy rules to dev** — via the `firestore-deploy` skill (dev project only). Confirm the deploy targets dev and that the committed `persons` block is the one deployed (re-check for unrelated in-flight rules changes first).

---

## Self-review notes

- **Spec coverage:** §1 routing → Task 4; §2 tab gates → Task 4; §3 action gates + sheet → Tasks 3, 5; §4 back behavior → Task 6; §5 rules → Task 7; §6 intent resume → Tasks 1, 2, 3, 4. All covered.
- **Type consistency:** `requireAuth(intentHref, reason?) => boolean`, `pendingIntent: string | null`, `clearPending()`, `resolveIntentResume(IntentResumeInput) => string | null` used identically across Tasks 1–5.
- **No component-test fabrication:** UI/routing tasks use dev-server + native manual verification, matching this repo's actual harness (only pure helpers and rules have automated tests).
