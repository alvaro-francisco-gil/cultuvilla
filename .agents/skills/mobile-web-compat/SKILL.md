---
name: mobile-web-compat
description: Use whenever writing or modifying components under `apps/mobile/` that touch `Animated.*`, `Alert.alert`, `Modal`, `expo-router` `Tabs`, or other RN APIs known to behave differently on the Firebase Hosting web build at https://villa-events.web.app. Encodes the gotchas that have already bitten the dev project so they don't bite again.
---

# Mobile / web compatibility

`apps/mobile/` ships to native (iOS/Android via Expo) **and** to the web via `expo export --platform web` + Firebase Hosting (https://villa-events.web.app). The Expo / React Native Web / NativeWind stack has several pitfalls where code looks correct, runs fine on native, but silently breaks on web. Every item below already broke in production at least once — fix proactively, not after the user opens DevTools.

## The bigger rule: web-only fixes MUST be `Platform.OS`-gated

The single class of regression that has burned us most: applying a web fix to **every** platform. `tabBarStyle: { height: 64 }` (commit 69dded8) restored the labels on web but hid the bottom tab bar on Android and would have crowded the iPhone home indicator. React Navigation, expo-router, Modal, and other libraries pick platform-aware defaults that correctly account for safe-area insets and platform metrics — overriding them globally is almost always wrong.

**Rule:** any style override / option you introduce specifically to fix a web rendering issue must live behind `Platform.OS === 'web'`. Do **not** apply it to native unless you've explicitly verified it doesn't regress there.

Use the helpers in `apps/mobile/lib/platform.ts` instead of inline `Platform.OS` checks:

```tsx
import { webSpread } from '../../lib/platform';

const webTabBarOverrides = webSpread({
  tabBarStyle: { height: 64 },
  tabBarLabelStyle: { fontSize: 11, marginTop: 0, paddingTop: 0 },
});

<Tabs screenOptions={{ ...sharedOptions, ...webTabBarOverrides }} />
```

Available helpers:
- `webOnly(value)` — returns `value` on web, `undefined` on native (use for a single field)
- `webSpread(obj)` — returns `obj` on web, `{}` on native (use inside object spreads)
- `nativeOnly(value)` — inverse of `webOnly`
- `isWeb` — re-exported `Platform.OS === 'web'` constant

Reference fix: `apps/mobile/app/(tabs)/_layout.tsx` (commit 6168e7d, undoing the over-applied 69dded8).

**Verification rule:** before claiming a web fix is "done", boot the app on at least one native target and confirm the change doesn't regress there. `pnpm app:start` then press the QR for native AFTER pressing `w` for web. If the change was wrapped in `Platform.OS === 'web'` from the start, the native check is just confirming "this branch wasn't taken" — fast and cheap.

**Automated enforcement:** `pnpm app:check-web-compat` (also runs in `mobile-ci.yml`) greps the source for known anti-patterns and fails if they appear without a `Platform.OS` guard or an explicit `// mobile-web-compat: native-only` allowlist comment on the line above. Catches `Alert.alert` without a guard, `className` on `Animated.*`, and `tabBarStyle` in a `screenOptions` block with no Platform branching anywhere in the file. New violations fail CI; pre-existing native-only call sites carry the allowlist comment instead.

## NativeWind drops `className` on `Animated.*`

NativeWind 4 does **not** transform `className` on `Animated.View`, `Animated.Text`, or anything from `Animated.createAnimatedComponent(...)`. The class string is silently stripped on the web target. Native works; web ends up with neither `position: absolute` nor the `bg-*` color, even though the CSS rules exist in the bundle.

**Rule:** never put NativeWind classes on an `Animated.*` component. Inline every style on the `style` prop instead. For colors, reach for the raw hex from `packages/shared/src/design-system/tokens/colors.ts` and leave a comment so the source of truth is still discoverable.

```tsx
// BROKEN — className is dropped on web, indicator renders without
// position: absolute and joins the flex row.
<Animated.View className="absolute bg-surface rounded-md" style={{ ... }} />

// CORRECT — every style on `style`.
<Animated.View
  style={{
    position: 'absolute',
    backgroundColor: '#f9f0e8', // colors.ts: light.bg.surface (cream)
    borderRadius: 8,            // radii.md
    ...
  }}
/>
```

Reference fix: `apps/mobile/components/feature/SegmentedToggle.tsx` and `apps/mobile/components/feature/UserMenuModal.tsx` (commit f3e2420). See [[nativewind-drops-classname-on-animated-view]] for the war story.

## `Alert.alert` is an empty function on web

`react-native-web@0.21` ships `Alert` as literally `class Alert { static alert() {} }`. Calls compile and run without error, but no dialog appears. Single-button "info" alerts go silent; multi-button confirmations never resolve.

**Rule:** every `Alert.alert` call that the web build will execute must branch on `Platform.OS === 'web'` and use `window.confirm` / `window.alert`. Admin-only surfaces that the web build doesn't reach get a pass for now, but a shared `showConfirm` / `showAlert` helper is the right durable fix once more than one or two need converting (~10 native-only call sites remain — see [[alert-on-web-is-noop]]).

```tsx
import { Alert, Platform } from 'react-native';

function confirmAndAct(title: string, body: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
      onYes();
    }
    return;
  }
  Alert.alert(title, body, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'OK', onPress: onYes },
  ]);
}
```

Reference fix: `apps/mobile/components/feature/VillageDiscovery.tsx` (commit 318a0b4).

## `Modal` does not flex-fill its children on web

On RN-Web 0.21, `<Modal>` doesn't always give its first child a full-viewport flex container, so `className="flex-1"` collapses to zero height and any backdrop dependent on it disappears.

**Rule:** the immediate child of a `<Modal>` that needs to fill the viewport must use `StyleSheet.absoluteFillObject` (or explicit `position: absolute; top: 0; left: 0; right: 0; bottom: 0`), not `flex-1`.

```tsx
<Modal visible={visible} transparent onRequestClose={...}>
  <Animated.View
    style={[
      StyleSheet.absoluteFillObject,
      { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim },
    ]}
  >
    {/* sheet here */}
  </Animated.View>
</Modal>
```

Reference fix: `apps/mobile/components/feature/UserMenuModal.tsx` backdrop (commit 31cec02).

## `useNativeDriver: true` on `translateX` interpolations

RN-Web 0.21 mostly supports `useNativeDriver: true` for opacity / transform animations, but `Animated.spring` driving an interpolated `translateX` on a `width`-dependent element has shipped at least once with the animation silently not running on web (indicator stayed pinned to its initial position).

**Rule:** if an `Animated.spring` / `Animated.timing` interpolation feels visually correct on native but doesn't move on web, switch the driver to `useNativeDriver: false` before chasing layout/styling theories. JS-driver perf is fine for short UI springs.

Reference fix: `apps/mobile/components/feature/SegmentedToggle.tsx` (commit 31cec02).

## A horizontal `ScrollView`/`FlatList` can't be scrolled by mouse on web

A `horizontal` RN-Web `ScrollView`/`FlatList` renders as an `overflow-x` scroller, but a **mouse** has no way to move it: a vertical wheel doesn't scroll it horizontally, there is no drag-to-scroll, and `showsHorizontalScrollIndicator={false}` hides the scrollbar (the last mouse affordance). On a phone it works because touch-drag moves the overflow container; on a PC the row is stuck. This bit every card row on the Pueblo tab and the Perfil screen — content overflowing, unreachable.

**Rule:** wrap any `horizontal` row the web build renders in `HorizontalScrollRow` (`apps/mobile/components/feature/HorizontalScrollRow.tsx`), spreading the provided ref onto the list. On **non-touch desktop screens only** it overlays prev/next arrow buttons that page the row; the row moves solely via those arrows there. Fully inert on native and on touch screens, so phone behaviour (touch-drag) is unchanged.

```tsx
import { HorizontalScrollRow } from '../HorizontalScrollRow';

<HorizontalScrollRow>
  {(scrollRef) => (
    <FlatList ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} … />
  )}
</HorizontalScrollRow>
```

It resolves the DOM node via the list's `getScrollableNode()` (both `ScrollView` and `FlatList` expose it on web), pages by animating `scrollLeft` with a `requestAnimationFrame` tween on click, and gates the arrows behind `matchMedia('(hover: hover) and (pointer: fine)')`. The pure edge/page math lives in `apps/mobile/lib/horizontalScroll.ts` (unit-tested).

**Three gotchas baked into this component, learned the hard way:**
- **`element.scrollTo({behavior:'smooth'})` is broken on a virtualized `FlatList` node.** The native smooth animation is fought by `removeClippedSubviews`/VirtualizedList and *collapses the position back toward 0* mid-animation — so clicking "next" appeared to do nothing, then jumped, and a second click snapped back to the start. A **direct `node.scrollLeft = x` assignment is respected and holds**, so page via a small rAF tween that sets `scrollLeft` each frame (see `animateScrollLeft`), never `scrollTo`. Confirmed by logging `scrollLeft` before/after in the running web app.
- **Never unmount a control mid-interaction.** The arrows first *unmounted* when their direction wasn't scrollable; a still-settling scroll flips that flag between mouse-down and mouse-up, and a control removed mid-press fires **no `click`** — so arrow clicks dropped intermittently (the left one more, since it sits near its toggle boundary). Fix: keep both arrows mounted always and toggle `opacity` + `pointerEvents` instead. An invisible `pointerEvents:'none'` control also lets clicks fall through to the card underneath.
- An earlier version translated the vertical mouse wheel into horizontal scroll; it worked but read as an unwanted "free-scroll" once the arrows existed. Desktop rows are **arrows-only** now.

Reference: `apps/mobile/components/feature/VillageSections.tsx` + the four `apps/mobile/components/feature/profile/*Scroll.tsx` rows.

## `expo-router` `Tabs` default metrics clip labels on web

The default `bottom-tabs` height + label/icon spacing fits iOS / Android line-height but clips labels under RN-Web's text metrics. Default tab-bar height is shorter than expected and the label appears covered by padding.

**Rule:** set `tabBarStyle: { height: 64 }` and `tabBarLabelPosition: 'below-icon'` explicitly — but **only on web**. The native defaults correctly handle safe-area insets; applying these to every platform hides the Android tab bar and crowds the iPhone home indicator.

```tsx
import { Platform } from 'react-native';

const webTabBarOverrides = Platform.OS === 'web'
  ? {
      tabBarShowLabel: true,
      tabBarLabelPosition: 'below-icon' as const,
      tabBarStyle: { height: 64 },
      tabBarLabelStyle: { fontSize: 11, marginTop: 0, paddingTop: 0 },
    }
  : {};

<Tabs
  screenOptions={{
    headerShown: false,
    ...webTabBarOverrides,
  }}
>
```

Reference fix: `apps/mobile/app/(tabs)/_layout.tsx` (commit 6168e7d). The original web fix in 69dded8 was the bug — over-applying the override to every platform — until 6168e7d gated it.

## A `.web.tsx` override only shadows a default with the SAME extension

A native-only module (no web build) that runs `TurboModuleRegistry.getEnforcing(...)` at import time crashes the **entire** web app before it mounts — `Uncaught TypeError: Cannot read properties of undefined (reading 'getEnforcing')`, blank page, nothing renders. The standard RN fix is a platform split: a default file (native, imports the native module) beside a `.web.tsx` override (web, uses a browser equivalent), with callers importing extensionless `./foo`.

The trap is in **which extension the default file uses.** Metro's resolver (`metro-resolver/src/resolve.js`, `resolveSourceFile`) iterates `sourceExts` in order — `['ts','tsx','js','jsx',…]` — and for each ext tries `foo.<platform>.<ext>` then falls back to the **bare `foo.<ext>` in the same iteration**, returning the first hit. So a `.web.tsx` override is only reached if resolution gets to the `tsx` iteration. If the default file is `foo.ts`, the earlier `ts` iteration finds `foo.ts` first (there is no `foo.web.ts`) and resolution stops — **`foo.web.tsx` is never tried**, and the native default leaks into web.

**Rule:** a platform override and its default must share the same base extension. Since a web override that renders JSX must be `.tsx`, the default file must **also** be `.tsx` — not `.ts`:

```
lib/imageCrop.tsx        ← default (native): react-native-image-crop-picker
lib/imageCrop.web.tsx    ← web override: react-easy-crop     ✅ both .tsx
```

```
lib/imageCrop.ts         ← default (native)
lib/imageCrop.web.tsx    ← web override — DEAD, .ts is found first  ❌
```

This is guarded by `pnpm app:check-web-compat`, which flags any `X.web.<ext>` whose default sibling has a different extension.

**This does not fail on the dev server the way it fails in production.** `expo start` bundles routes lazily, so a native module only pulled in by a not-yet-visited route stays out of the initial bundle — the dev site loads, then crashes when you navigate to the screen that touches it. `expo export --platform web` (the deployed static build) bundles eagerly, so the same code crashes on first paint. **A green dev server is not evidence the web export is healthy** — verify against the export (or the CI web smoke test).

Reference fix: renamed `lib/imageCrop.ts` → `lib/imageCrop.tsx` so `imageCrop.web.tsx` (react-easy-crop) shadows it on web instead of the native `react-native-image-crop-picker` leaking in. To confirm a native module isn't in the web export, grep the built bundle for its `getEnforcing("Rn…")` marker:

```bash
pnpm app:web:build && grep -oc 'RNCImageCropPicker' apps/mobile/dist/_expo/static/js/web/entry-*.js  # want 0
```

## `Alert.alert` and Animated `className` are the two heavyweights

If you take only one thing from this skill: when touching `Animated.*` or `Alert.*` in `apps/mobile/`, the web build will lie to you. Native renders cleanly, classes appear in the deployed CSS, but the actual DOM has neither the class nor the alert. Inline-style every `Animated.*`; `Platform.OS === 'web'`-branch every `Alert.alert`.

## Verifying a fix

When in doubt, run the dev server (`pnpm app:web`) and open DevTools rather than redeploying. The dev server hot-reloads in seconds; a redeploy is a build + 5 MB upload. Use the local dev server for visual iteration; deploy only when you're convinced it's right.

## Related skills and memories

- [[firebase-hosting-setup]] — the broader hosting / CI / deploy setup
- [[nativewind-drops-classname-on-animated-view]] — the war story behind the className rule
- [[alert-on-web-is-noop]] — the Alert war story
- [[expo-native-rebuild]] — for native-side changes that need a fresh build
