# Villagers ("Personas") get their own screen, out of the edit-village stepper

## Context

The villager roster used to live only inside the admin-only edit-village stepper,
as its last step ("Miembros"), rendered by `MembersList`. That made the roster
invisible to non-admin members and buried behind "Editar pueblo" → step 2, even
though it's community-facing information, not an admin setting.

## Decision

The roster is a dedicated screen (`village/[villageId]/members.tsx`), reached by
tapping the *personas* stat on the village home (`StatsRow` gained a generic
`onPress` prop for this). The edit-village stepper collapsed to a single screen —
`CommunitySettingsEditor` directly under the header — since every field in it
already auto-saves and the stepper only existed to host two steps.

- **Members-only, not public.** Non-members deep-linking in are redirected back
  to the village, mirroring how the admin editor redirects non-admins.
- **Full table for every member, not just admins.** Name · role · censo ✓/✗ ·
  date are visible to any member; only the row-tap promote/demote action stays
  admin-gated (`canManage`). No per-role privacy filtering of the roster data
  itself.
- Promote/demote still routes through the same audited `setVillageMemberRole`
  callable — this change only moved *where* the roster is viewed, not how role
  changes are authorized.

## Rejected alternatives

- **Opening the roster to non-member visitors** — rejected; membership data
  stays members-only.
- **Filtering roster fields by role** (e.g. hiding censo status from non-admins)
  — rejected; the full table is member-facing, not admin-facing.

## What this binds

- A new "who's in this village" surface should extend `members.tsx` /
  `MembersList`, not reintroduce a roster view inside an admin settings screen.
- `StatsRow`'s `onPress` is now a generic affordance — reuse it rather than
  building a parallel pressable-stat pattern for the other stats.

## Revisit when

The organizaciones / lugares stats need the same tap-to-detail treatment, or the
roster needs a public (non-member) preview.
