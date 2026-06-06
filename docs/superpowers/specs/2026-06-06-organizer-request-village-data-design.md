# Organizer-request-driven village creation

**Status:** Draft (spec)
**Date:** 2026-06-06
**Branch:** `worktree-organizer-request-village-data`

## Problem

Today a village ("pueblo") can be activated two ways:

1. **Manual** — a superadmin opens `/admin/activate-village`, searches a seeded
   municipality, types a description, and activates it, appointing *themselves*
   as the village admin.
2. **By request** — a user submits an organizer request (carrying only a
   `motivation` string); a superadmin approves it, which activates the village
   with an **empty** description and the requester as admin.

We want to remove manual activation entirely. A village should be created **only**
through the organizer-request flow, and the request itself should carry all the
village data needed, so that approval creates a fully-populated village in one
step. The superadmin's only action is approve/reject.

## Goals

- The request-organizer form collects the village data up front: **description**
  (required), **cover images** (optional), plus the existing **motivation**
  (kept as a decision aid, *not* copied into the village).
- Approving a request creates the village in one transaction, populated from the
  request's data, with the requester as `admin`.
- No manual activation surface. The `/admin/activate-village` screen and the
  client `activateCommunity` helper are removed.
- **No orphaned cover images** under any path (see "Image lifecycle").

## Non-goals

- **Coordinates** are *not* collected in the form. Municipalities are seeded with
  `coordinates: null`; they will be populated later by a batch script, mirroring
  the existing escudo pipeline (`fetch-escudos.mjs` → `upload-escudos.mjs`). Out
  of scope here.
- No change to the duplicate-pending-request guard, the rules (writes already
  locked to the admin SDK), or the notification messages.

## Design

### 1. Data model — `OrganizerRequestData` carries village data

File: `packages/shared/src/models/municipality/OrganizerRequestDataModel.ts`

Add two fields to `OrganizerRequestDataSchema`:

```ts
description: z.string(),
coverImages: z.array(z.string()),   // Storage object paths, not download URLs
```

- Keep `motivation` (`z.string().nullable()`).
- `coverImages` stores **Storage object paths** (e.g.
  `villages/{municipalityId}/images/{id}`), not download URLs, so the reject
  handler can delete the blobs server-side via the admin SDK. Objects are
  public-read, so the UI resolves paths to display URLs on read.

Update `OrganizerRequestDataInput` (`description: string`, `coverImages?: string[]`)
and `buildOrganizerRequestData` (defaults: `coverImages: input.coverImages ?? []`).

### 2. Request creation (the user)

**Cloud Function** `functions/src/village/requestOrganizeVillage.ts`
- Accept `description` and `coverImages` in the payload.
- Validate `description` is present/non-empty → `invalid-argument` otherwise.
- Persist both on the created `OrganizerRequest` document.
- Existing checks (auth, municipality exists + not active, no duplicate pending)
  unchanged.

**Client service** `packages/shared/src/services/organizerRequestService.ts`
- Extend `RequestOrgPayload` with `description: string` and `coverImages?: string[]`.

**UI** `apps/mobile/app/discover/request-organizer/[municipalityId].tsx`
- Add a **description** input (required; submit disabled until non-empty).
- Add a **cover-image picker** (multi-image) using the existing `imageService`.
  Images are **uploaded on submit**, not on pick — pick locally, then on submit
  upload to `villages/{municipalityId}/images/{id}` and collect the Storage
  paths, then call the callable. This bounds any orphan to a real, submitted
  request.
- Keep the **motivation** input.

`imageService` currently uploads to a user-scoped prefix; village cover uploads
go to `villages/{municipalityId}/images/{id}`, which the existing Storage rule
(`villages/{villageId}/images/{imageId}` — any authed user may write) already
permits. Add a focused `imageService` entry point for this path if one does not
already fit, keeping `imageService` the single client Storage writer.

### 3. Approval / rejection (the superadmin)

**Cloud Function** `functions/src/village/respondToOrganizerRequest.ts`
- **Approve:** build the `community` object from the request's `description` and
  `coverImages` (instead of empty values); `adminUserId = requesterUid`. The
  member doc (role `admin`) creation is unchanged.
- **Reject:** before/with marking the request `rejected`, delete the request's
  `coverImages` blobs from Storage via `firebase-admin/storage`. The request doc
  is kept as a `rejected` audit record (needed for the notification, the user's
  request history, and to allow a fresh request later).

**Admin requests UI** `apps/mobile/app/admin/organizer-requests.tsx`
- Show the request's **description**, **motivation**, and **cover-image
  thumbnails** so the superadmin sees what they're approving. Approve/reject
  only — no data entry.

### 4. Remove the manual path

- Delete `apps/mobile/app/admin/activate-village.tsx`.
- Remove the `activate-village` card and its `href` from
  `apps/mobile/app/admin/index.tsx`.
- Remove the now-unused client `activateCommunity` from
  `packages/shared/src/services/municipalityService.ts`. Keep `updateCommunity`
  and `deactivateCommunity`. (`ActivateCommunityInput` / `buildVillageCommunity`
  in the model: remove only if unused after this change; verify with grep.)
- Verify `searchMunicipalities` has other consumers before keeping; it is used
  by the activate screen — keep only if used elsewhere, otherwise remove.
- i18n (`packages/i18n/messages/es.json`): remove `admin.activate.*` and
  `admin.hub.activateVillage`/`activateVillageHint`; add request-form keys
  (description label/placeholder, cover-images label/add button) under the
  existing `requests.organizer` namespace.

### Image lifecycle (no orphans)

| Outcome | Cover-image blobs |
|---|---|
| User picks images but never submits | Never uploaded (upload happens on submit) |
| Request submitted, **rejected** | Deleted by `respondToOrganizerRequest` reject path |
| Request submitted, **approved** | Promoted to `community.coverImages`, retained |

### 5. Tests

- **Model** (`packages/shared/test/models/.../OrganizerRequestDataModel.test.ts`):
  new fields parse; `buildOrganizerRequestData` defaults `coverImages` to `[]`
  and keeps `description`.
- **Handler `requestOrganizeVillage`**: stores `description`/`coverImages`;
  rejects missing/empty `description` with `invalid-argument`.
- **Handler `respondToOrganizerRequest`**: approve builds `community` from the
  request's `description`/`coverImages`; reject deletes the cover-image blobs and
  leaves the municipality untouched.
- **Rules**: unchanged (writes already locked to admin SDK) — existing e2e tests
  should still pass.
- **Dev seed** `scripts/seed-village-requests.mjs`: update seeded requests to
  include `description` (and `coverImages: []`) so they match the new shape.

## Open trade-offs (accepted)

- Cover-image deletion on reject is best-effort: if a blob delete fails, log and
  continue resolving the request (do not block rejection on Storage cleanup).
- A user editing a pending request is out of scope; they cancel and re-submit.
