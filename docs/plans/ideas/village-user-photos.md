# Village user photos

**Goal:** Let any village member publish a photo of the village, shown in a dedicated photo scroll on the village tab — separate from the escudo.

## Context

When the `coverImages` gallery was removed (see `docs/decisions/village-escudo-only-images.md`), the village's only image became its escudo. That removal was deliberate: the old `coverImages` was an admin-only, free-form gallery that didn't have a clear purpose. This idea replaces it with a clearer, community-driven concept.

The intent: villages feel alive when residents contribute. A photo stream — "this is our plaza in fiestas", "first snow this year" — is a low-effort way for any member to add to the village page, distinct from the official escudo.

## Design / approach (sketch — undecided)

- **Who can publish:** any village **member** (not just admins). Anonymous / non-members cannot.
- **Where it shows:** a separate horizontally- or vertically-scrolling photo section on the village tab, below the existing content. Not mixed with the escudo.
- **Data shape (candidate):** a `villagePhotos` subcollection under `/municipalities/{id}/` — one doc per photo with `imageURL`, `authorId`, `createdAt`, and likely a `status` (proposed/approved) mirroring the existing barrios/places proposal pattern, so admins can moderate. (Reusing the `ProposalStatus` pattern already in `MunicipalityDataModel.ts` keeps moderation consistent.)
- **Storage:** photos in Cloud Storage under `villages/{id}/photos/...`, public download URLs stored on the doc — same shape as today's image fields.
- **Moderation:** likely propose-pending (any member proposes, admin approves) to prevent abuse, consistent with barrios/places. Could start admin-only-approval and relax later.

## Open questions

- Moderation model: auto-publish vs propose-pending? (Lean propose-pending, reusing `ProposalStatus`.)
- Per-user / per-village photo caps to bound storage cost.
- Whether photos can be reused as event-card or OG fallback images, or stay purely decorative on the village tab.
- Captions? EXIF stripping / privacy? Reporting/removal flow.
- Native image picker + upload UX (reuse the escudo upload path in `CommunitySettingsEditor`?).

This is a future idea — not scheduled. It documents the eventual home for the "village pictures" concept that `coverImages` used to half-fill.
