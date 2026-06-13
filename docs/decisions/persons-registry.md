# Persons as a top-level canonical registry

## Context

The original model stored proxy profiles as `users/{userId}/personas` — nested,
account-owned, and unable to represent people who don't (or won't) have an
account: deceased ancestors for the family tree, elderly relatives signed up by
someone else, or one person who belongs to more than one village. Registrations
referenced a nullable `personaId`.

## Decision

- A **top-level `persons/{personId}`** collection is the canonical people
  registry. A person may be linked to a Firebase Auth user *or* stand alone
  (family-tree members, non-account attendees). `UserData` gains a `personId`.
- **Registrations always require a `personId`** — the nullable `personaId` is
  gone. Every registration points at a real person record.
- Added supporting reference domains: **`municipalities`** (predefined Spanish
  ayuntamientos, with `barrios` / `cemeteries` subcollections) and
  **`occupations`** (superadmin-managed multi-select list with a user
  `occupationProposals` flow).
- `PersonaDataModel` / `personaService` were deleted, not deprecated.

## Rejected alternatives

- **Keeping personas nested under users.** Couldn't model standalone or
  cross-village people, and made the family-tree direction (top-level `/people`)
  impossible without a later migration. Top-level now avoids that.

## What this binds

- Person identity is shared: the same `personId` is reused across villages and by
  the family tree rather than duplicated.
- New registration code must supply a `personId`; there is no nullable fallback.
- This is consistent with [open-feed-architecture](open-feed-architecture.md) —
  entities people interact with globally live at the top level.

## Revisit when

- The family tree ships and needs richer person↔person relationship modelling
  on top of this registry (see `docs/plans/ideas/family-tree.md`).
