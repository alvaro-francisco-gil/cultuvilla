# Optimistic content + soft-hide moderation

User-generated *content* is created visible and moderated a posteriori, instead of
sitting in a `pending → approved` queue. Removal is a reversible **soft-hide**,
surfaced to users as "Eliminar". Occupations lost their proposal queue in the same
change.

## Problem

Almost every user-creatable entity carried the same `pending | approved | rejected`
review field (the `reviewDecisionFields` mixin), but that field only actually gated
*display* for two of them. For barrios/places it did nothing (`allow read: if true`,
no status filter); for orgs/posters visibility depended on whether the *caller*
remembered to pass `'approved'`. So `status` meant "hidden until approved" for news,
nothing for barrios/places, and "hidden if the caller filtered" for orgs/posters —
a per-call-site leak, not a design.

Separately, occupations ran a full `occupationProposals/` → app-admin-review →
live-collection pipeline for what is effectively a free-text tag on a person.

## Decision

**Optimistic posture for pure content: news, festival posters, barrios, places.**
All four are created `status: 'active'` and visible immediately. A shared
`VisibilityStatus = 'active' | 'hidden'` model (`visibilityFields`) replaces the
review mixin on these four. The `status == 'active'` read filter lives in the
**service layer**, so no call site can surface hidden content.

**Removal = reversible soft-hide, framed as delete.** Hiding sets the
function-owned `status`/`hiddenBy`/`hiddenAt`/`hiddenReason` via the audited
`setContentVisibility` callable, which appends to an append-only `moderationEvents/`
log (top-level, `municipalityId`-scoped, admin-readable — a sibling of
`membershipEvents/`). Chosen over hard delete because barrios/places are referenced
by person docs (residence barrio, burial place) and news owns comments/reactions —
a hard delete would dangle those references through the strict Zod converters and
crash the reading screen. `status`/`hidden*` are function-owned; Firestore rules
forbid clients from writing them.

**The moderation action lives in each entity's edit stepper, labeled "Eliminar".**
For the admin-managed entities (barrio, place, festival-poster) the edit screen is
already admin-gated, so its "Eliminar" button soft-hides (`moderationService.hideContent`).
Users see deletion; the doc is preserved + audited. This matches the event
soft-cancel precedent (`status → cancelled` under a "delete" label). **News keeps a
genuine author hard-delete** (the cascading `deleteNewsPost` callable) because news
edit is author-gated, not admin-gated, and authors legitimately delete their own
posts; admin news moderation rides the existing `newsReports` / `resolveNewsReport`
flow.

**Occupations: catalog + collected free strings, no proposals.** A hardcoded
`OCCUPATION_CATALOG` (keys in shared, labels in i18n) plus a free-text fallback;
`recordOccupation` upserts `occupations/{slug}` (`count`-tallied) for autocomplete.
`person.occupationIds` + `pendingOccupations` collapse into a single
`occupations: string[]`.

## Rejected alternatives

- **Hard delete for content.** Rejected: dangling refs crash strict-converter reads;
  no audit trail; irreversible. Soft-hide is invisible to end users anyway (hidden
  docs drop out of every feed).
- **A dedicated moderation list / "Contenido" manager tab.** `develop` had already
  reduced the proposable managers to create-only; re-introducing a moderation list
  was rejected in favor of the per-entity edit-stepper action.
- **A news-detail hide button for admins.** Built on the original branch, then
  dropped: it duplicated the reports flow and broke the "removal lives in the edit
  stepper" rule. Revisit if proactive (non-report-driven) admin hiding of news
  becomes a real need — it would need a surface other than the author-gated edit
  screen.

## What this binds

- The four content collections (`news`, `festivalPosters`, `barrios`, `places`) use
  `visibilityFields`, are created `active`, and filter `status == 'active'` in the
  service. New public queries on them must include that filter.
- `status`/`hiddenBy`/`hiddenAt`/`hiddenReason` are function-owned on those four;
  only `setContentVisibility` writes them. `ModeratedCollection` is the allow-list.
- **Organizations and organizer requests keep their approval gate** — approval there
  *grants admin authority* (seeds the founder as admin), so it's a real safeguard,
  not accidental soft-gating. They are explicitly out of scope. Events remain
  lifecycle-only (`published`/`cancelled`/`completed`), never a review gate.

## Revisit when

- A content entity needs genuinely permanent deletion (legal/RGPD erasure) — that is
  a separate callable, not this soft-hide.
- Proactive admin moderation of news (beyond the reports flow) is required.
- A per-village occupation catalog is wanted (today the catalog is global).
