---
Status: Draft
Created: 2026-05-29
Author: Alvaro + Claude
---

# Custom seed fixtures with named datasets

## Problem

`scripts/seed-dev-fixtures.mjs` today hardcodes 2 villages (Aranjuez, Chinchón),
3 generic orgs each, and 3 generic events per org. There is no way to:

1. Load a different curated dataset (e.g. real local villages we want to demo).
2. Attach real images to villages / events / user profiles.
3. Seed multiple distinct users (e.g. an app admin separate from a test user).

We want a small framework where the same script can run any of several named
datasets, each with its own data + image folder, dropping the resulting docs +
Storage files into dev Firestore (`villa-events`).

## Goals

- Multiple curated datasets selectable via env var (`DATASET=real_user_data_1`).
- Each dataset can ship its own images (local files) that get uploaded to
  Cloud Storage and wired into the relevant doc fields.
- Datasets can declare multiple users, including one or more app-wide admins
  (`admins/{uid}` doc) and regular users.
- Profile photos for those users land in the right Storage path + Auth `photoURL`.
- Idempotent on re-run, tag-based wipe still works per-dataset.
- Dev-only guard (`villa-events`) preserved.

## Non-goals

- Production seeding. CI / prod data flows are out of scope.
- Image processing (resize, crop, format conversion). Drop the file, it's
  uploaded as-is. Storage rule already caps at 5 MB.
- Cross-dataset data (one run = one dataset).

## Architecture

```
scripts/
  seed-dev-fixtures.mjs              ← refactored: dataset loader + image uploader
  data/
    seed-fixtures/
      random_data_1/                 ← migrated from current hardcoded data
        fixtures.mjs
        images/                      ← (empty for this dataset)
      real_user_data_1/
        fixtures.mjs                 ← user's curated villages
        images/                      ← user drops local images here
          cultuvilla-logo.png
          aranjuez-plaza.jpg
          …
```

### Selection

```bash
DATASET=real_user_data_1 pnpm seed:dev
DATASET=real_user_data_1 pnpm seed:dev:wipe
```

`DATASET` defaults to `random_data_1` so existing behavior is preserved if no
env var is set. Script refuses to start if the named folder doesn't exist or
lacks a `fixtures.mjs`.

### Dataset shape (`fixtures.mjs`)

Each dataset exports a default object:

```js
export default {
  // Optional metadata (used in seedBatch tag).
  name: 'real_user_data_1',

  users: [
    {
      ref: 'admin',                            // local id used to cross-reference below
      email: 'cultuvilla@gmail.com',
      password: 'cultuvilla-dev',              // dev only; user can change later
      displayName: 'Cultuvilla',
      isAppAdmin: true,                        // → admins/{uid}
      photo: 'cultuvilla-logo.png',            // file in images/
      birthday: '1990-01-01',
    },
    {
      ref: 'alvaro',
      email: 'xxpowervaroxx@gmail.com',
      password: 'cultuvilla-dev',
      displayName: 'Álvaro Francisco Gil',
      isAppAdmin: false,
      photo: null,
      birthday: '1990-01-01',
    },
  ],

  villages: [
    {
      id: 'aranjuez',                          // becomes seed-village-aranjuez
      name: 'Aranjuez',
      province: 'Madrid',
      comunidadAutonoma: 'Comunidad de Madrid',
      codigoINE: '28013',
      coordinates: { lat: 40.0319, lng: -3.6033 },
      description: 'Real Sitio de Aranjuez…',
      coverImages: ['aranjuez-plaza.jpg', 'aranjuez-jardin.jpg'],
      adminUserRef: 'admin',                   // cross-ref into users[]
      organizations: [
        {
          id: 'ayto',
          name: 'Ayuntamiento de Aranjuez',
          type: 'ayuntamiento',
          description: 'Organización municipal oficial.',
          events: [
            {
              id: 'verbena',
              title: 'Verbena de Aranjuez',
              description: 'Música en directo en la plaza.',
              startOffsetDays: 7,
              durationHours: 4,
              maxAttendees: 200,
              price: 0,
              status: 'published',
              image: 'verbena.jpg',            // optional, file in images/
            },
          ],
        },
      ],
    },
  ],
}
```

`startOffsetDays` is days from "now" (negative = past). `durationHours` may be
`null` for open-ended events.

### Doc/Storage write flow

For each user:
1. Find or create Firebase Auth user (by email).
2. If `photo` set: upload `images/<photo>` to `users/{uid}/photo/seed-<photo>`,
   `getDownloadURL()`, `auth.updateUser(uid, { photoURL })`.
3. Write `users/{uid}` via `buildUserData(...)`.
4. If `isAppAdmin`: write `admins/{uid}` marker doc.

For each village:
1. Resolve `adminUserRef` → uid.
2. Upload each `coverImages[i]` to `villages/{seed-village-<id>}/images/seed-<file>`,
   collect download URLs → `coverImages: [...urls]`.
3. Write `municipalities/seed-village-<id>` with `buildMunicipalityData(...)` +
   `buildVillageCommunity({ adminUserId: <uid> })`.
4. Write membership at `municipalities/{id}/members/{adminUid}` (role: admin).

For each organization: same as today.

For each event:
1. If `image` set: upload to
   `villages/{villageId}/events/{eventId}/image/seed-<file>`, get URL.
2. Write `events/{seed-event-<orgId>-<eventId>}` with `buildEventData(...)`
   including `imageURL` and denormalized `municipalityCoverImage` (first cover).

### Auth for uploads

`getDownloadURL()` requires a service account key — ADC alone can't sign.
Script asserts `GOOGLE_APPLICATION_CREDENTIALS` is set (same as
`scripts/upload-escudos.mjs`). If missing, fail fast with a clear message
pointing at the `firebase-admin-dev` skill.

### Idempotency

- Doc IDs deterministic: `seed-village-<id>`, `seed-org-<id>`, `seed-event-<orgId>-<id>`.
- Storage uploads check existence first; skip if same size (same as
  `upload-escudos.mjs`).
- Auth users looked up by email before create.
- All docs tagged `seedBatch: 'dev-fixtures-<dataset-name>'`.

### Wipe

`pnpm seed:dev:wipe` (with `DATASET` set) enumerates everything in the chosen
dataset by deterministic ID and:
- Deletes events, orgs, village docs, membership subdocs.
- Deletes uploaded Storage files (best-effort — `bucket.file(...).delete().catch(() => {})`).
- Deletes `users/{uid}` and `admins/{uid}` for users created by the seed.
- Deletes the throwaway Auth users (those whose `customClaims` or email match the
  dataset). Conservative: only delete Auth users whose email is in the
  dataset's `users[].email`.

## Components changed

1. **New**: `scripts/data/seed-fixtures/random_data_1/fixtures.mjs` — migrated
   from current hardcoded VILLAGES.
2. **New**: `scripts/data/seed-fixtures/real_user_data_1/fixtures.mjs` — skeleton
   with the two requested users + placeholder villages for the user to fill in.
3. **New**: `scripts/data/seed-fixtures/{random_data_1,real_user_data_1}/images/`
   directories (with a `.gitkeep` so the folder ships even when empty).
4. **Rewritten**: `scripts/seed-dev-fixtures.mjs` — dataset loader, image
   uploader, multi-user support.
5. **Updated**: `package.json` — script comments (no command name changes).
6. **Updated**: `AGENTS.md` — short note on dataset selection.

## Open questions

- **Default dataset**: leaving `DATASET` unset uses `random_data_1` (the
  migrated current data). Safe default.
- **Passwords in fixtures.mjs**: dev-only convenience. Files are gitignored?
  No — they ship in the repo. Acceptable since these are dev-only auth users in
  a dev project; production has separate auth. Document this caveat.

## Testing

- Manual: `DATASET=random_data_1 pnpm seed:dev` produces same docs as today.
- Manual: `DATASET=real_user_data_1 pnpm seed:dev` produces the new users + their
  photos + any villages defined.
- Manual: `pnpm seed:dev:wipe` (both datasets) leaves project clean.
- No unit tests — this is a dev-only one-shot script.

## Rollout

Single PR / commit. No migration. Old behavior preserved via default.
