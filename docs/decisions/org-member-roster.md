# Organization member roster: display gate, not a rules boundary

## Context

Organizations track members at `organizations/{orgId}/members/{uid}` (only
`userId`, `role`, `joinedAt` — no denormalized name/photo), and the org detail
screen showed only a member count. We wanted a roster (avatar + name rows, like
`EventAttendees`), plus a way for a group to hide it.

## Decision

- **`membersPublic: boolean`** on the organization (default `true`).
  `canViewOrgRoster({ membersPublic, isMember }) = membersPublic || isMember` —
  admins are members, so they always see their own roster.
- **Enforced as a UI display gate only — not in `firestore.rules`, and no
  rules change to the `members` subcollection.** This was deliberate: member
  identities are already publicly readable elsewhere (names via world-readable
  `users/{uid}`, photos via world-readable `persons/{personId}`), so a
  rules-level boundary on `members` would be a false sense of security while
  requiring new machinery (a denormalized `memberCount` + trigger to replace
  the now-unreadable aggregate count). The toggle only controls whether the
  *roster UI* renders, not whether the underlying identity data is reachable.
- Per-member name + photo resolved on read via `getPersonByUserId(uid)`, falling
  back to `getUserProfile(uid).displayName` + initials — same one-hop pattern
  `EventAttendees` uses for event registrations.

## What this binds

- Don't add rules enforcement for `membersPublic` later without also solving
  the "identities are public anyway" problem it was declared not worth solving
  for — revisit only if identity data itself becomes non-public.
