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
- **Web build:** implement as a positioned overlay (absolute container + backdrop), NOT React Native `Modal` — `Modal` behaves differently on the Firebase Hosting web export (see the `mobile-web-compat` skill). Animate with `Animated` on `style`, never `className` (NativeWind drops `className` on `Animated.View`).

Action sites to route through `requireAuth`:
- Register-for-event button on [app/event/[eventId].tsx](../../../apps/mobile/app/event/[eventId].tsx) (today gated by `if (person && !registered)` — make the button visible to guests and gate on press, intent = current event route).
- Join-org on [app/o/[orgId].tsx](../../../apps/mobile/app/o/[orgId].tsx) `onJoin()` (replaces today's hard `router.push('/(auth)/login')`, intent = current org route).
- News comment / react actions on the news detail screen (intent = current news route).
- Any other content-creation entry points reachable from public detail screens.

### 4. Back-from-detail → Explora
Generalize the back button in [components/feature/FloatingBackButton.tsx](../../../apps/mobile/components/feature/FloatingBackButton.tsx):

```tsx
const onBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
```

A deep-linked first-contact visit (no history) lands on Explora; normal in-app navigation still pops naturally. This is the default `onBack`; callers passing a custom `onBack` are unaffected.

### 5. Rules change (minimal)
- `persons` (firestore.rules:638): `allow read: if isAuthenticated()` → `allow read: if true`, so `/person/[id]` renders for guests. Person docs are a genealogical registry (name, surnames, biography, birthday, photoURL) and `users` is already world-readable, so this is consistent with the existing posture.
- News **comments/reactions** stay gated (village-member read). Guests on a news detail see the post plus the denormalized `reactionCounts`/`commentCount`; the comment thread and reacting route through `requireAuth`.
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
- `<RegisterSheet>` — presentational overlay; props: `visible`, `reason`, `onRegister`, `onDismiss`. Web-safe (no RN `Modal`).
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
