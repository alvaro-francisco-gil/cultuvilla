# Dedicated villagers ("Personas") screen

## Goal

Give a village its own villagers roster screen, reached by tapping the *personas*
stat on the village home, and remove that roster from the edit-village stepper.

## Context

Today the villager roster lives only inside the admin-only edit-village stepper
([community.tsx](../../../apps/mobile/app/village/[villageId]/community.tsx)) as its
last step ("Miembros"), rendered by
[MembersList](../../../apps/mobile/components/feature/MembersList.tsx). That means:

- The roster is invisible to non-admin members, even though it's community-facing info.
- The only entry point is buried behind "Editar pueblo" → step 2.
- The stepper carries two steps only to host it.

The village home already shows a *personas* stat (`peopleCount`) in `StatsRow`, but
the stat is not tappable. Making it the entry point to a dedicated roster screen is
more discoverable and lets the roster stand on its own.

## Design / approach

### 1. New route — `apps/mobile/app/village/[villageId]/members.tsx`

Path `members` for consistency with the `MembersList` component and the existing
`village.membersList.*` i18n namespace. User-facing title is *Personas*
(`village.villagers.title`).

- **Members-only.** Resolve `canManage`/`uid` via `useEntityCapabilities(villageId)`
  and membership via `isVillageMember(villageId, uid)`
  (`@cultuvilla/shared/services/villageMemberService`).
- Loading → spinner.
- Not a member (direct deep-link bypass) → `<Redirect href="/village/[villageId]">`,
  mirroring how `community.tsx` redirects non-admins.
- Body renders `<MembersList villageId canManage={canManage} currentUserId={uid} />`
  **unchanged**. Non-admin members see the full table (name · role · censo ✓/✗ ·
  date) without the row tap; admins keep promote/demote.

`MembersList` already supports exactly this via its `canManage` prop, so no change to
that component is needed.

### 2. Entry point — tappable *personas* stat, members only

- `StatsRow` ([StatsRow.tsx](../../../apps/mobile/components/feature/StatsRow.tsx)):
  add optional `onPress?: () => void` to `StatItem`. When present, wrap that column's
  content in a `Pressable`; otherwise render exactly as today. Keeps the component
  generic — the profile screen's usage (no `onPress`) is unaffected.
- In [VillageHomeBody](../../../apps/mobile/components/feature/VillageHomeBody.tsx),
  the personas stat gets
  `onPress: isMember ? () => router.push('/village/${village.id}/members') : undefined`.
  `isMember` is already available from `useVillageHome` data. The organizaciones and
  lugares stats stay non-tappable (out of scope).

### 3. Collapse the edit-village stepper — `community.tsx`

- Remove the *Miembros* step and the `Stepper` + `MembersList` imports.
- Render `CommunitySettingsEditor` directly under the `ScreenHeader`, inside the
  existing `KeyboardAvoidingView`, with a single *Listo* button that calls
  `router.back()` (parity with the old stepper's completion). Every field in
  `CommunitySettingsEditor` already auto-saves (escudo on pick, location/zoom on
  change, description on blur), so nothing is lost by dropping the stepper.
- Update `CommunitySettingsEditor`'s doc comment — it no longer "embeds in the
  community Stepper's Detalles step".
- The screen stays admin-only (`canManage` redirect unchanged).

### 4. i18n & cleanup

- Add `village.villagers.title` ("Personas") to `packages/i18n/messages/es.json`.
- Delete `village.edit.tabMembers` / `village.edit.tabDetails` if they become unused
  after the stepper collapses (Delete > deprecate). Verify with a grep before
  deleting.

## Tests

- **StatsRow** ([__tests__/StatsRow.test.tsx]): pressing a stat with `onPress` fires
  the handler; a stat without `onPress` renders non-pressable.
- **members.tsx**: renders `MembersList` for a member; redirects a non-member.
- **MembersList**: existing tests unchanged (behavior identical).

## Out of scope

- Changing what promote/demote does (routes through the same audited
  `setVillageMemberRole` callable).
- Making the organizaciones / lugares stats tappable.
- Any per-role privacy filtering of the roster — decided: members see the full table
  (name · role · censo · date); only the row-tap action is admin-gated.
- Opening the roster to non-member visitors — decided: members-only.

## Open questions

None — resolved during brainstorming.
