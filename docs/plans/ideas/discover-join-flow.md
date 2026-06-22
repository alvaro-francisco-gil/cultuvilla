# Discover-screen join flow + conditional "Cambiar de pueblo"

**Goal:** Let users join an active village directly from the Buscar pueblo (discover) list via a per-card action, and hide "Cambiar de pueblo" for users who belong to only one village.

## Context

Today "Unirse a otro pueblo" (profile) and "Cambiar de pueblo" / "Buscar pueblo" (user menu) all funnel to either `/me/villages` (the switcher) or `/discover`. Two problems:

1. **"Cambiar de pueblo" is shown unconditionally**, even for users in a single village, where there is nothing to switch between.
2. **Joining a village requires drilling into its home page.** The discover card only navigates; the join confirm lives on `/village/[villageId]`. The card also carries an "Activo" text label that adds little.

This plan adds an inline join affordance to the discover card and makes the switcher menu item conditional.

## Design / approach

### 1. "Cambiar de pueblo" conditional on >1 village

In `apps/mobile/components/feature/UserMenuModal.tsx`:

- The modal already fetches the person on `visible`. Alongside it, fetch `getUserMemberships(user.uid)` and store `villageCount` in state (reset when not visible).
- Build the `swap-horizontal-outline` "Cambiar de pueblo" (`menu.switchVillage`) item only when `villageCount > 1`.
- "Buscar pueblo" (`menu.findVillage`) stays always-visible — single-village users reach other villages through it.

No change to `/me/villages` itself.

### 2. Discover card redesign

In `apps/mobile/components/feature/VillageDiscovery.tsx`:

- On mount (when a user is logged in), fetch the user's memberships into a `Set<string>` of `municipalityId` (`joinedIds`). Reuse `getUserMemberships`. Tolerate logged-out / fetch failure by treating the set as empty.
- **Active village card** (`m.communityActive`):
  - Remove the "Activo" / accent text label on the right.
  - Card body remains pressable → `router.push('/village/[villageId]')` for that village (unchanged target).
  - Add an **eye icon** button (`eye-outline`) → same navigation as the card body (view that village's home).
  - Add a **person-plus** button (`person-add-outline`) on the right → opens the join-confirm modal for that village.
  - If `joinedIds.has(m.id)`, replace the person-plus with a muted **checkmark** icon (`checkmark-circle`, non-interactive) — the user is already a member.
- **Inactive municipio card** (`!m.communityActive`): unchanged. No eye/join buttons; whole card routes to `/discover/start/[municipalityId]`. Keep the existing "Sin comunidad" (`discover.inactive`) muted label — it is that card's only affordance hint.

The accent border on active cards (`border-accent`) stays.

### 3. Join-confirm modal

A small confirmation modal rendered by `VillageDiscovery` (single instance, driven by `pendingJoin: Muni | null` state):

- Use React Native `Modal` (`transparent`, centered dialog) — **not** `Alert.alert`, which is a no-op on RN-Web 0.21 and per the user's request for a modal.
- Content: village name + body copy, a cancel button and a confirm button.
- Reuse existing i18n: `village.joinConfirm.title`, `village.joinConfirm.body`, `village.joinConfirm.confirm`, `village.joinConfirm.cancel`.
- On confirm: call `addVillageMember(m.id, user.uid)`; on success, close the modal, add `m.id` to `joinedIds`, and `router.push('/village/[villageId]')` for the joined village. Show a busy state on the confirm button while in flight.
- If not logged in when person-plus is pressed: route to `/(auth)/login` (mirror `VillageHomeBody.onJoin`).

### New i18n keys (packages/i18n)

Add under the `discover` namespace (es + any other locale files):

- `discover.viewVillage` — accessibility label for the eye button (e.g. "Ver pueblo").
- `discover.joinVillage` — accessibility label for the person-plus button (e.g. "Unirse a este pueblo").
- `discover.alreadyMember` — accessibility label for the member checkmark (e.g. "Ya eres miembro").

Reuse `village.joinConfirm.*` for the modal text. Follow the `i18n-add-string` skill when adding.

### Web compatibility

- New buttons are plain `Pressable` (no `Animated.View` + `className` pitfall).
- The join confirm uses `Modal` + a confirm `Pressable`, avoiding `Alert.alert` (no-op on web). Follow `mobile-web-compat`.

## Out of scope

- Changing `/me/villages` or the profile `VillagesScroll` "Unirse a otro pueblo" target (still `/discover`).
- "Request to join" / approval workflow — join is immediate self-join via `addVillageMember`, matching the existing village-home behavior.
- Setting the joined village as the active municipality (the existing `AuthContext` auto-sync already promotes a first/only membership to active; multi-village users keep their current active village).
