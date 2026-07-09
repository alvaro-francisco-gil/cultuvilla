# Carteles de fiestas

## Goal

Add a per-village visual archive of fiesta posters ("carteles de fiestas"), one card per year, surfaced as a new horizontal scroll on the village screen.

## Context

Spanish villages print an annual poster (cartel) for their fiestas patronales. Residents want to browse these year by year — the poster artwork itself is the artifact of interest, with the **year** as the primary, prominent label and the fiesta dates as secondary context. There is no equivalent surface today; the village screen has scrolls for people, barrios, places, orgs/peñas, and news, but nothing for this cultural archive.

Scope decision: a cartel is **a poster image + metadata only** (a visual archive), *not* a container that links to events and *not* a rich-content post. Tapping a card opens the poster full-screen.

## Design / approach

### Data model

New first-class **top-level collection `festivalPosters/`**, scoped by `municipalityId` (architecture invariant #3), read through a new `festivalPosterService`. Model `FestivalPosterDataModel.ts` under `packages/shared/src/models/festivalPoster/`, mirroring the Zod shape of `NewsPostDataModel.ts`:

```
municipalityId: string
createdBy: string
year: number                              // required — the big, visible label
title: string | null                      // optional patronal name ("San Roque", "El Cristo")
image: { storagePath, width, height }      // required — the poster itself (reuse NewsPostImage shape)
datePrecision: 'year' | 'month' | 'day'
startsAt: Date | null                      // null when precision === 'year'
endsAt: Date | null                        // null for single-day or year-only
status: 'pending' | 'approved' | 'rejected' // ReviewStatusSchema (same as news)
rejectionReason: string | null
submittedAt: Date
publishedAt: Date | null
updatedAt: Date
```

**Progressive date precision.** `year` is always present and is the anchor. The optional range carries a `datePrecision` flag telling the UI how to format via the shared `formatDate` (never raw `Intl`):

- `year` → "2025" (no `startsAt`/`endsAt`)
- `month` → "Agosto 2025"
- `day` → "14–18 ago 2025"

A single range covers all three cases: year-only (dates null), single month (precision `month`), day range (precision `day`). Multiple disjoint blocks and time-of-day are explicitly **out of scope**.

### Presentation (village screen)

A new **"Carteles de fiestas"** section on the shared village tab, using the existing `Section` + horizontal `ScrollView` pattern in `apps/mobile/components/feature/VillageSections.tsx`.

Existing cards are square (`175×175`), image-forward with a bottom scrim. A printed cartel is **portrait** (~A3), so add a **poster-shaped card variant** — taller (~`140×198`, √2 ratio) — reusing the same scrim treatment:

- Full-bleed poster image, `resizeMode="cover"`.
- Bottom scrim: **year** large + bold; `title` beneath when present; a third muted line for the formatted date range.
- Ordered by `year` descending.
- Trailing `AddCard` for the propose/add affordance ("Proponer" for villagers, "Añadir" for organizers), consistent with the other scrolls.
- Tap → **full-screen poster viewer** (raw image). Pinch/zoom is a later nicety, out of scope for v1.

### Moderation, service & uploads

**Propose → approve flow**, reusing the existing proposable machinery (the `proposable/` components and `ReviewableDataModel` status that news/places use):

- Villagers submit via `festivalPosterService.propose(...)` → doc with `status: 'pending'`.
- Village admins approve/reject through the same manager surface (`VillageContentManager.tsx`). Approval flips `status` to `approved` and stamps `publishedAt`.
- **Guardrail:** `status` must not be client-writable to `approved` by a non-admin. Follow whatever the sibling proposables already do — `firestore.rules` admin-only status transition, or an approval callable if that's the established pattern. Confirm the exact mechanism against existing code during planning (`guardrail-enforcement` skill), don't invent a new one.
- **Image upload:** `pickImageAsBlob` → `imageService`; never import `firebase/storage` in mobile screens.

### Collection checklist

Driven by the `add-firestore-collection` skill so it lands complete in one commit:

- Model (`FestivalPosterDataModel.ts`) + builder + service + index re-export
- `_services-map.md` entry
- `firestore.rules` block
- Composite index `municipalityId + year desc` in `firestore.indexes.json`
- vitest for the model builder
- rules test
- i18n strings in `packages/i18n/messages/es.json`
- No dev backfill needed (brand-new collection, no existing docs)

## Open questions

- **Exact approval mechanism** — rules-only status transition vs. an approval callable. Resolve by reading how news/places proposables gate `status` today, then match. (Deferred to planning, not a blocker on the design.)
- **Full-screen viewer** — reuse an existing image viewer component if one exists in the app, otherwise a minimal modal. Decide during planning.
