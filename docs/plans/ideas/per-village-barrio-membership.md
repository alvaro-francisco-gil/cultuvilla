# Per-village barrio & multi-village membership

## Goal

Let a user belong to multiple villages and set a distinct barrio in each — chosen
at join time and editable later — so the profile/residence model reflects reality
instead of collapsing everyone to a single village + barrio.

## Context

The bug that started this: editing your own profile, the barrio picker can't be
set. Two gates cause it in [`BarrioPicker`](../../../apps/mobile/components/primitives/BarrioPicker.tsx):

1. It's **disabled** when no residence village is selected (`!municipalityId`).
2. Even when enabled, it lists only `status === 'approved'` barrios — a village
   with no approved barrios offers only "Todo el pueblo".

But the deeper issue is the data shape the UI assumes. The data layer already
supports multi-village:

| Concept | Where | Shape | Multi-village? |
|---|---|---|---|
| Community membership | `villageMembers` (`/municipalities/{id}/members/{userId}`) | `{userId, role, …}` | ✅ already a list |
| Active village | `user.activeMunicipalityId` | single id | by design (current context) |
| Residence + barrio | `person.municipalityLinks` | `Array<{municipalityId, barrioId}>` | ✅ **already an array** |

`municipalityLinks` is already `[{municipalityId, barrioId}, …]`. The UI is what
collapsed it: [`PersonForm`](../../../apps/mobile/components/feature/PersonForm.tsx)
edits a single village + barrio, and
[`person/[personId].tsx`](../../../apps/mobile/app/person/[personId].tsx) reads/writes
only `municipalityLinks[0]`.

Key constraint discovered during design: `persons` can exist **without** an
account (`userId` nullable) — deceased relatives, historical figures, family
members added by others. The barrio residents list
([`barrio/[barrioId].tsx`](../../../apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx))
queries the `persons` collection via `getPersonsByBarrio` (`array-contains` on
`municipalityLinks`), so `municipalityLinks` must stay as the universal read/query
surface for **all** persons, account or not. Barrio therefore cannot live *only*
on the membership doc.

## Design / approach

### Decisions taken (during brainstorming)

- **Barrio is coupled to membership** for account-holders: one (optional) barrio
  per village you're a member of. `villageMembers` is the source of truth for
  *which* villages.
- **Source of truth = the membership doc.** Add `barrioId` there. `null` = "Todo
  el pueblo".
- **`municipalityLinks` stays** as the universal read/query surface and the home
  for non-account persons. For account-holders it becomes a *projection* of
  membership, kept in sync by a trigger (the repo's denormalized-read-model
  pattern).
- **Both editing surfaces** are covered: own-profile (membership-driven) and the
  generic person editor (non-account, direct `municipalityLinks`).
- **Barrio is also chosen at join time**, in the join modal.
- **On leave** (membership deleted): the matching `municipalityLinks` entry is
  **removed** — they stop appearing as a resident.
- **Invalid barrio** (stale/un-approved/foreign/tampered): the sync trigger
  **normalizes to `null`** rather than erroring, so joins/saves never fail on a
  race. The picker prevents it on the honest path; the trigger is the
  server-side backstop (never trust the client).

### 1. Data model

```
/municipalities/{municipalityId}/members/{userId}
  …existing (userId, role, joinedAt, profileAnswers, …)…
  barrioId: string | null     ← NEW (null = "Todo el pueblo")
```

`person.municipalityLinks: Array<{municipalityId, barrioId}>` — unchanged shape.
`user.activeMunicipalityId` — unchanged (orthogonal "current context" switch).

### 2. Sync trigger (functions)

Firestore trigger on write to `/municipalities/{muni}/members/{userId}`:

- Resolve the user's `personId` (from the user doc).
- **Validate** `member.barrioId`: must be an approved barrio of `muni`; otherwise
  coerce to `null`.
- **Upsert** `{municipalityId: muni, barrioId}` into that person's
  `municipalityLinks` (replace the entry matching `muni`).
- On membership **delete**: remove the `municipalityLinks` entry for `muni`.

Mirrors `functions/src/syncVillageDenormalization.ts` and
[denormalized-read-models](../../architecture/denormalized-read-models.md).
Applies to account-holders only (those with a membership + linked person).

### 3. Shared `JoinVillageModal` component

New RN `Modal`, used by **both** join surfaces, replacing the `Alert.alert` /
`window.confirm` join path (which is a no-op / picker-incapable on web):

- [`VillageDiscovery`](../../../apps/mobile/components/feature/VillageDiscovery.tsx)
  (already a `Modal` — swap its inline confirm body for this component).
- [`VillageHomeBody`](../../../apps/mobile/components/feature/VillageHomeBody.tsx)
  (currently `Alert.alert` + `window.confirm` — replace with the modal).

Modal contents: escudo + village name, confirm copy, and a barrio picker shown
**only if the village has ≥1 approved barrio** (hidden, not disabled, otherwise —
never blocks joining). Reuses the `BarrioPicker` primitive. On confirm →
`addVillageMember(municipalityId, uid, role, barrioId)`.

### 4. `addVillageMember` gains `barrioId`

```
addVillageMember(municipalityId, userId, role = 'user', barrioId = null)
```

Writes the new field. Update `villageMemberService` + the
`buildVillageMemberData` builder + the converters.

### 5. Profile edit — membership-driven Residence step (own profile)

`PersonForm`'s Residence step becomes mode-aware. For the logged-in user's **own**
persona (`person.userId === user.uid`):

- Render **one row per membership** (villages you belong to), each with a barrio
  picker. No add/remove (join/leave happens via discover).
- Saving writes each changed `member.barrioId`; the trigger propagates to the
  person. The single village/barrio fields are removed from this surface.

This directly resolves the original bug.

### 6. Generic person editor — multi-residence list (non-account persons)

For persons **without** an account, the Residence step is an editable list:
add/remove any village, barrio per entry, written **directly** to
`municipalityLinks` (no membership, no trigger). Today's single-row behaviour
generalised to N rows.

Mode selection in `PersonForm`: own persona → membership-driven (§5); otherwise →
multi-residence list (§6).

### 7. Backfill + guardrails

- **Backfill:** for each existing member, set `member.barrioId` from the user's
  current `municipalityLinks` entry for that village (else `null`). One-off
  admin script ([firebase-admin-dev](../../../.claude/skills/firebase-admin-dev)).
  Run per env (dev → beta → prod).
- **Guardrail:** `member.barrioId` must reference an approved barrio of the same
  municipality. Primary enforcement is the sync trigger (normalize-to-null);
  `firestore.rules` may additionally shape-check the field. Per
  [guardrail-enforcement](../../../.claude/skills/guardrail-enforcement).

## Open questions

- **Profile edit ↔ membership write path:** the Residence step writes to the
  `members` subcollection, a different collection from the rest of the person
  form. Confirm during planning whether own-profile barrio edits should save
  inline with the stepper submit, or be a separate immediate write per row
  (the latter matches the join modal and avoids a partial-save mismatch between
  person fields and membership fields).
- **Rules for member self-write of `barrioId`:** confirm a member can update
  their own membership doc's `barrioId` (today `addVillageMember` is a client
  write); verify against current `firestore.rules` member-write rules.
- **`buildResidenceLinks` callers:** `complete-profile.tsx` onboarding still
  builds a single residence link and sets `activeMunicipalityId`. Decide whether
  onboarding writes `member.barrioId` (and lets the trigger build the link) or
  keeps writing the link directly for the very first village. Likely the former,
  for consistency.
