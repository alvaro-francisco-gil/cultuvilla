# Content moderation unification + occupations without proposals

**Goal:** Collapse the accidental, per-entity moderation inconsistency into one
optimistic + soft-hide model for user-generated *content*, and remove the
occupation proposal flow in favour of a hardcoded catalog with a free-string
fallback.

## Context

Today almost every user-creatable entity carries the same
`pending | approved | rejected` review field (the shared `reviewDecisionFields`
mixin from `ReviewableDataModel`), but that field only actually gates *display*
for two of them:

| Entity | Gated before display? | How |
|---|---|---|
| News posts | **yes** | feed queries force `status == 'approved'` in `newsService` |
| Occupations | **yes** | separate `occupationProposals/` collection, public reads only live `occupations/` |
| Barrios | no | `allow read: if true`, no status filter; comment: "lands as `pending` and is visible to all" |
| Places | no | same as barrios |
| Organizations | soft-gated | rules open; visibility depends on whether the *caller* passes `'approved'` |
| Festival posters | soft-gated | same as organizations |
| Events | no | `status` is a lifecycle enum (`published`/`cancelled`/`completed`), not a review gate |

The result is a `status` field that means "hidden until approved" for news,
nothing for barrios/places, and "hidden if the caller remembered to filter" for
orgs/posters. That per-call-site soft-gating is a latent leak, not a design.

Separately, occupations use a full proposal → app-admin-review → live-collection
pipeline for what is effectively a free-text tag on a person. That ceremony is
disproportionate to the value.

## Decisions (settled during brainstorming)

- **Posture: optimistic everywhere.** Content appears the moment it is created;
  a village admin removes/hides bad content a posteriori. Enforced in the
  service layer, never per-call-site.
- **Removal = soft-hide,** not hard delete. Reversible, keeps an audit trail,
  avoids dangling references from notifications / denormalized read models.
- **Scope = pure content only:** news posts, festival posters, barrios, places.
- **Out of scope (keep their approval gate):** organizations and organizer
  requests — approval there *grants admin authority* (seeds the founder as
  admin; ayuntamiento = town hall), so the gate is a real safeguard, not
  accidental soft-gating. Events remain unmoderated (lifecycle only).
- **Hide is an audited callable,** not a rules-gated client write. Moderation is
  an accountability-sensitive authority action; we want a tamper-proof record of
  who hid whose content and why, and `status` should be function-owned so it
  can't be forged. This matches the repo's existing pattern
  (`changeVillageMemberRole` / `approveOrganization` → `membershipEvents`).

## Design

### A. Unified visibility model (news, festival posters, barrios, places)

Replace `reviewDecisionFields` / `ReviewStatus` on these four entities with a
shared **visibility** field set (new, in `packages/shared/src/models/core/`):

```
VisibilityStatus = 'active' | 'hidden'
visibilityFields = { status: VisibilityStatus, hiddenBy: string | null,
                     hiddenAt: Date | null, hiddenReason: string | null }
```

- All four are **created `active`** and visible immediately.
- **Read filter lives in the service:** every public/feed query filters
  `status == 'active'`. No call site can surface hidden content. This closes the
  current soft-gating on orgs/posters (posters are in scope; orgs keep approval
  and are handled separately — see Out of scope).
- **`status` is function-owned.** `firestore.rules` forbid clients from writing
  `status` / `hiddenBy` / `hiddenAt` / `hiddenReason` on these collections.

Removed as part of this:
- News: `moderateNewsPost` approval callable, the trusted-author auto-approve
  bypass, `rejectionReason`. `submittedAt` → `createdAt`; `publishedAt` set at
  creation.
- Barrios/places: `approveBarrio` / `approvePlace`; `propose*` service names
  become `create*`. The `ProposalStatus` type usage on these two is dropped.
- Festival posters: the `approve`-poster path; the village-home call stops
  passing `'approved'` (the service filters `active` itself).

### B. `setContentVisibility` audited callable + `moderationEvents/` log

One callable handles hide/unhide for all four collections:

```
setContentVisibility({ collection, docId, hidden, reason? })
```

- Verifies the caller is a village admin of the doc's `municipalityId`
  (or app admin) — server-authoritative.
- In one transaction: flips `status` (+ `hiddenBy`/`hiddenAt`/`hiddenReason`),
  and appends to `moderationEvents/` (append-only, top-level, scoped by
  `municipalityId`, readable by village/app admins) — a sibling of
  `membershipEvents/`.
- `collection` is validated against an allow-list of the four in-scope
  collections; anything else is rejected.

### C. Occupations: hardcoded catalog + collected free strings

- **Catalog:** a global constant of occupation keys with i18n labels, in
  `@cultuvilla/shared` (keys) + `@cultuvilla/i18n` (labels). Source of truth for
  the suggested list.
- **Person field:** replace `occupationIds: string[]` **and**
  `pendingOccupations: string[]` with a single `occupations: string[]`. Each
  entry is either a catalog key or a raw free string typed by the user. Render
  as `catalogLabel(value) ?? value`.
- **Collected free strings:** a lightweight global `occupations/` collection,
  upserted per free string via `recordOccupation(name)` →
  `occupations/{slug}` `{ name, count: increment(1), updatedAt }`. `slug` is a
  normalized (lowercased, trimmed, accent-folded) key for dedup. No status, no
  approval. Admins "promote" a popular free string by adding it to the catalog
  (a code change) and optionally pruning the collection.
- **Deleted:** the `occupationProposals/` collection and its model;
  `proposeOccupation`, `getPendingProposals`, `reviewProposal`; the app-admin
  occupation-review UI. The `occupations/` collection is repurposed from
  "approved occupations" to "collected free strings" (no `createdAt`/`createdBy`
  ceremony beyond what's useful for curation).

### D. Migration (dev backfill — autonomous, `villa-events` only)

- **Persons:** build `occupations[]` from the old fields — resolve each
  `occupationId` to its occupation-doc `name` (map to a catalog key if it
  matches, else keep the name as a free string), append `pendingOccupations`
  verbatim, then remove `occupationIds` + `pendingOccupations`.
- **`occupations/`:** rebuild in the collected-free-strings shape (or wipe and
  let `recordOccupation` refill).
- **`occupationProposals/`:** delete.
- **News / posters / barrios / places:** re-point `status` — existing
  `approved` and `pending` both become `active` (optimistic: previously-pending
  content becomes visible); `rejected` news becomes `hidden` with
  `hiddenReason` carried over from `rejectionReason` if present.
- Idempotent `scripts/backfill-*.mjs` per the `firebase-admin-dev` conventions;
  verify with `pnpm check:dev-conformance` before and after.

### E. Testing

- **vitest (`packages/shared/test/`):** catalog lookup / label resolution;
  `recordOccupation` slug normalization + dedup; the new visibility model
  builders; person `occupations[]` builder.
- **e2e rules (`packages/shared/test/e2e/`):** clients cannot write
  `status`/`hidden*` on the four collections; village admin (and app admin) can
  invoke the hide path, non-admins cannot; service queries exclude `hidden`
  docs.
- **functions:** `setContentVisibility` authority checks + `moderationEvents`
  append, under the emulator harness.
- Update the already-touched news storage-rules tests as needed.

## Open questions

- **`moderationEvents` vs. reuse `membershipEvents`.** Leaning new collection —
  membership events are about roles, moderation is about content; mixing them
  muddies both logs. Confirm before implementation.
- **Multi-village orgs / global occupations catalog ownership.** The catalog is
  global; if a village wants village-specific occupations later, that's a future
  extension, not this plan.
- **Author notification on hide.** Nice-to-have (the callable is the natural
  place for it) but not required for v1 — defer unless wanted now.
