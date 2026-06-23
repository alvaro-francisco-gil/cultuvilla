# Villages carry only an escudo (coverImages removed)

**Status:** Active
**Date:** 2026-06-23
**Branch:** `worktree-village-tab-cleanup-escudo` (merged to main)

## Context

Villages used to carry a free-form `community.coverImages` gallery (admin-uploaded, Pinterest-style) shown inside a village info modal, plus a Wikidata/admin escudo. The gallery had no clear purpose, was admin-only, and was woven through OG share previews, the event-card cover denorm, the organizer-request/start/update write paths, several forms, and seed scripts. The info modal also duplicated an "Editar" entry point.

## Decision

A village's only image is its **escudo** — Wikidata-sourced (`escudoUrl`) by default, overridable by an admin upload (`escudoManualUrl`, which wins everywhere). `coverImages` was removed entirely from the model, functions, mobile, seeds, and docs.

- The village info modal is gone. The village tab's second button is now **Editar pueblo** for admins (routes to community settings) and **Compartir pueblo** for everyone else; **Invitar vecino** stays for all.
- Two consumers that read `coverImages[0]` now fall back to the escudo (`escudoManualUrl ?? escudoUrl`): the OG share-preview image (`functions/src/og/fetchers.ts`) and the event-card cover denorm (`functions/src/village/syncVillageDenormalization.ts` → `EventData.municipalityCoverImage`). The denorm retriggers on escudo-field changes.
- The village description is still editable (it feeds OG previews) but is no longer rendered on the village tab.

## Rejected alternatives

- **Keep `coverImages`, hide only the gallery UI** — leaves dead data paths and a half-removed concept; rejected in favor of total removal.
- **Restrict custom escudo upload to villages with no Wikidata escudo** — rejected; admins may always override.
- **Drop `municipalityCoverImage` denorm entirely** (event cards show only the calendar icon) — rejected in favor of the escudo fallback, keeping the field and the smallest change.

## What this binds

- No new village image field may reintroduce a per-village gallery. A future community-photo feature is a separate concept (see `docs/plans/ideas/village-user-photos.md`), not a revival of `coverImages`.
- The escudo is the single source for any "village image" fallback (cards, share previews).
- Supersedes the `coverImages` portions of `docs/decisions/organizer-request-village-creation.md` (organizer requests no longer carry cover images).

## Backward compatibility

Reads go through `makeConverter` → `schema.parse()`; Zod strips unknown keys, so legacy docs still carrying `coverImages` read back fine. A one-off dev backfill (`scripts/backfill/delete-cover-images.mjs`) deleted the dangling keys from `villa-events` (5 municipalities + 1 organizerRequest); it is idempotent and safe to re-run for beta/prod when those deploy.

## Revisit when

A community-driven village-photo feature is designed — at that point decide whether it supplies card/preview fallbacks or stays purely decorative.
