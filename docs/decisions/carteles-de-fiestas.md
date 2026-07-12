# Carteles de fiestas — festival-poster archive

## Context

Villages wanted a year-by-year visual archive of their fiesta posters (carteles) on the village screen. A cartel is the poster artwork plus light metadata; the **year** is the primary label. Shipped in PR #69.

## Decision

A first-class **top-level `festivalPosters/` collection** scoped by `municipalityId` (architecture invariant #3), read through `festivalPosterService`, surfaced as a horizontal scroll on the village screen with a portrait card + full-screen viewer, and created/moderated through a per-type `FestivalPostersManager`.

Load-bearing choices:

- **Rules-only admin approval (the *place* variant), not a Cloud Function callable.** A poster approve only flips `status` (+ `reviewedBy`/`reviewedAt`); there is no cross-user side effect (no founding-admin seed, no denormalization fan-out) that would need a transaction in a callable. So `firestore.rules` alone gates it: a member create is pinned to `status=='pending'` + `proposedBy==uid`; a village/app admin's `allow update` is unconstrained on `status`; a proposer may only edit their own doc while it stays `pending` (cannot self-approve).
- **Two composite indexes are both required.** `[municipalityId, status, year desc]` serves the approved-only village-home read; `[municipalityId, year desc]` serves the admin moderation read (`getFestivalPosters(mid)` with no status filter). The moderation index was missed initially — the manage tab query has an equality on `municipalityId` and an `orderBy` on `year`, and the status-carrying index is not a usable prefix for it, so it throws `FAILED_PRECONDITION` on real Firestore. Emulator and jest mocks do not enforce composite indexes, so this class of bug only surfaces against production Firestore.
- **Progressive date precision in one range.** `datePrecision: 'year' | 'month' | 'day'` + optional `startsAt`/`endsAt` (year → no dates, month → first-of-month, day → start/end). The v1 proposal form restricts a day range to a single month (month chips + day steppers) to avoid a native date-picker dependency, which misbehaves on the web build. The model, formatter, and card render all three precisions regardless of how a doc was created.
- **Full-screen viewer is an absolute-positioned overlay, not RN `Modal`.** RN `Modal` behaves badly on the Firebase-hosting web build; the viewer is a plain absolute `View` with a safe-area-padded close button.
- **Image is a download URL (place/org style), storage path auth-gated only.** The fixed portrait card uses `cover`, so aspect ratio isn't needed (no storagePath+dims). The storage rule for `festivalPosters/{municipalityId}/{posterId}/…` gates on auth + size + content-type, matching every existing image path — Firestore-side membership is enforced by the doc-create rule.
- **Multiple images live in an ordered `images: string[]` array on the doc (max 5), not a subcollection** (PR #104). `images[0]` is the cover (card + detail hero); the rest render as a vertical stack below the dates on the detail screen (not a horizontal carousel — the deliberately chosen UX). Array-on-doc keeps the detail read to a single document and makes ordering trivial; a subcollection only earns its cost with per-image metadata (captions/credits) we don't have. Each image uploads to a **unique per-image storage path** (`…/{posterId}/{imageId}`) instead of the old fixed `…/poster` path that overwrote; the existing `{fileName}` wildcard rule already covers it. The scalar `imageURL` was **removed** (no dual-read shim); existing docs were migrated via `scripts/backfill-festivalPoster-images.mjs` (dev at ship time; beta/prod must run it at promotion time or the strict converter throws).

## Rejected alternatives

- **Cloud Function callable for approval** — unnecessary; no side effect requires a server transaction. Would add a deploy surface and latency for a plain status flip.
- **Nested subcollection under `municipalities/{id}/`** (like places/barrios) — violates invariant #3 for a genuinely village-scoped domain entity and complicates cross-village queries.
- **Cartel as an event container or rich-content post** — out of scope; a cartel is a poster image + metadata, a visual archive, not a programme.

## What this binds

- Any new query shape on `festivalPosters` must ship its composite index in the same change (both existing indexes must remain).
- Approval stays rules-only unless a future side effect (notifications, denormalization) forces a callable.
- New mobile overlays on surfaces that also run on web must avoid RN `Modal`.

## Revisit when

- Fiestas legitimately span multiple disjoint blocks or need time-of-day → the single-range model and the single-month form restriction need revising.
- Approval grows a side effect → move the transition into an audited callable (mirror `moderateNewsPost`).
- The non-member "Proponer" affordance (currently shown to everyone and silently denied by rules, matching sibling Barrios/Places sections) is addressed → gate the add card on membership across all propose surfaces at once.
- Posters need more than 5 images, per-image captions/credits, or reordering → revisit the array-on-doc model (a `gallery` subcollection), and consider a fullscreen/zoom lightbox (both were deliberately out of scope in PR #104).
