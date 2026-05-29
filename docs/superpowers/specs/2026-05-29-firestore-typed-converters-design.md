# Firestore Typed Converters — Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-29
**Worktree:** `.claude/worktrees/firestore-typed-converters` on branch `worktree-firestore-typed-converters`
**Inspired by:** `ordago-apps/docs/plans/queued/firestore-converters.md` and `ordago-apps/docs/plans/blocked/typed-test-fixtures.md` — adapted for cultuvilla's much smaller surface and clean-slate position (no entrenched untyped code, no ESLint rules to retrofit).

## Goal

Introduce **Zod-schema-driven typed Firestore converters** across `packages/shared` (client SDK) and `functions/` (admin SDK) so that:

1. Document reads and writes are statically typed against schemas defined once per collection.
2. Runtime data is validated against those same schemas on every read (strict — throws on mismatch).
3. The hand-rolled `map<X>Doc` functions in every service (~17 services × ~30 lines each = ~500 lines of drift-prone boilerplate) are deleted.
4. ESLint `recommendedTypeChecked` rules (`no-unsafe-*`, `no-explicit-any`, `restrict-template-expressions`, etc.) are enabled across `packages/shared` and `functions/` from day one and pass cleanly.

## Why now

cultuvilla has ~17 services and ~20 Cloud Functions today. Doing this work now — before the data layer ossifies into 50+ services — is roughly 10× cheaper than the equivalent retrofit ordago is now scoping. We have no production users, dev DB has only seed data, Zod 4 is already a dependency, and there is no existing ESLint config to disable rules in. This is the cheapest moment in the project's life to enforce schema-as-source-of-truth.

## Conceptual model: compile-time vs runtime safety

(Borrowed from the ordago plan because it is load-bearing context.)

Two kinds of safety, often conflated:

- **Compile-time safety** is what TypeScript provides. Errors fire on the developer's machine and in CI — *before* code is built. They never reach a user. The compiled JavaScript that ships has all type info stripped.
- **Runtime safety** is what executes against real data on a user's phone or in a Cloud Function. Only runtime safety prevents users from experiencing crashes from malformed data.

The converter spans both:

- *At compile time* it declares "this collection's docs match `EventData`." Every read site downstream gets that type. Renames, missing fields, and shape mismatches surface in the editor and in CI.
- *At runtime* `fromFirestore` actually executes on every read. It validates raw `DocumentData` against the schema and either returns the typed model or throws.

cultuvilla picks **strict (throw on mismatch) from day one** because there are no users yet — a thrown error is a *signal* (fix the seed or fix the schema), not an outage. This decision is cheap to revisit before beta launch.

## Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Schema-first.** Zod schema is the source of truth; TS type is `z.infer<typeof EventDataSchema>`. The existing TS interfaces are replaced. | Zero drift between TS type and runtime validator by construction. Zod 4 already a dep. |
| 2 | **SDK-agnostic schemas.** `GeoPoint` → `{lat: number, lng: number}` everywhere outside the converter. `Timestamp` → `Date`. | One schema works for both client SDK and admin SDK. JSON-serializable for logs/audit. |
| 3 | **Strict reads.** `fromFirestore` calls `schema.parse(normalized)` and throws on mismatch. | Dev-only project, no real users. Drift is a signal, not an outage. |
| 4 | **Writes also validated.** `toFirestore` calls `schema.parse(model)` before denormalizing. | Catches developer bugs before they hit Firestore. |
| 5 | **Schema lives inside the model file** (`EventDataModel.ts` exports `EventDataSchema` + `type EventData`). No sibling `*Schema.ts` for persistence. | "What is an Event" is one file to open. Form-input schemas (`EventFormSchema.ts`) remain separate because they describe a different shape. |
| 6 | **Subpath exports** in `packages/shared/package.json`. `@cultuvilla/shared/firebase/refs/client` and `.../refs/admin` are distinct entry points. | Keeps the client SDK out of the functions/ bundle. Long-term-clean. |
| 7 | **One PR for the whole migration.** All ~20 ref factories, all services migrated, all functions migrated, lint rules on, in a single landing. | cultuvilla is small enough; staged rollout has more overhead than value at this scale. |
| 8 | **No audit + backfill ceremony.** Document required pre-beta. | Dev DB only contains seed data we control. |
| 9 | **Typed test fixtures deferred.** Tests are migrated minimally; the typed-fixtures plan is a follow-up, not a blocker. | Test surface is still small; the cost/value flips later. |

## Architecture

### File layout

```
packages/shared/
├── package.json                              # exports map: ./firebase/refs/client, ./firebase/refs/admin
├── src/
│   ├── models/
│   │   ├── event/
│   │   │   ├── EventDataModel.ts             # EventDataSchema + type EventData (NEW shape)
│   │   │   ├── EventFormSchema.ts            # unchanged — different concern (form input)
│   │   │   └── RegistrationDataModel.ts      # RegistrationDataSchema + type
│   │   ├── core/
│   │   │   └── LocationDataModel.ts          # LocationSchema (uses {lat,lng}, not GeoPoint)
│   │   ├── municipality/                     # municipality + member + inviteToken + barrio + cemetery + joinRequest
│   │   ├── news/                             # newsPost + comment + reaction + report
│   │   ├── notification/
│   │   ├── occupation/                       # occupation + proposal
│   │   ├── organization/                     # organization + orgMember + organizerRequest
│   │   ├── person/
│   │   └── user/
│   ├── firebase/
│   │   ├── firebaseApp.ts                    # existing
│   │   ├── converters/
│   │   │   ├── makeConverter.ts              # generic factory + normalize/denormalize walkers
│   │   │   ├── sdkAdapters.ts                # ClientSdkCtors, AdminSdkCtors
│   │   │   ├── eventConverter.ts             # eventConverterClient, eventConverterAdmin
│   │   │   └── ...one file per model
│   │   └── refs/
│   │       ├── client.ts                     # all client ref factories
│   │       └── admin.ts                      # all admin ref factories
│   └── services/                             # migrated to import refs from refs/client
└── eslint.config.mjs                         # NEW — strictTypeChecked + recommendedTypeChecked

functions/
├── eslint.config.mjs                         # NEW — strictTypeChecked + recommendedTypeChecked
└── src/                                      # migrated to import refs from @cultuvilla/shared/firebase/refs/admin
```

### The converter pattern

```ts
// packages/shared/src/firebase/converters/makeConverter.ts
import type { z } from 'zod';

export interface SdkCtors {
  TimestampFromDate: (d: Date) => unknown;
  GeoPointFrom: (lat: number, lng: number) => unknown;
  isTimestamp: (v: unknown) => v is { toDate(): Date };
  isGeoPoint: (v: unknown) => v is { latitude: number; longitude: number };
}

export function makeConverter<S extends z.ZodTypeAny>(schema: S, sdk: SdkCtors) {
  type Model = z.infer<S>;
  return {
    toFirestore(model: Model): Record<string, unknown> {
      schema.parse(model);  // validate developer payload
      return denormalize(model, sdk) as Record<string, unknown>;
    },
    fromFirestore(snap: { data(): unknown }): Model {
      const normalized = normalize(snap.data(), sdk);
      return schema.parse(normalized) as Model;
    },
  };
}
```

`normalize` (read path): recursively walks the value. `Timestamp` instance → `Date`; `GeoPoint` instance → `{lat, lng}`; arrays and plain objects are recursed; primitives pass through.

`denormalize` (write path): recursively walks the model. `Date` instance → `sdk.TimestampFromDate(d)`; objects with exactly the keys `{lat, lng}` both as `number` → `sdk.GeoPointFrom(lat, lng)`; arrays and other objects are recursed; primitives pass through.

### The `{lat, lng}` convention

The denormalizer detects coordinates by structural shape: an object with **exactly** the keys `lat` and `lng`, both numbers. This is a deliberate codebase-wide convention — coordinate pairs are the ONLY plain-object shape that matches `{lat, lng}: number`. The convention is documented in a header comment in `makeConverter.ts` so future contributors don't accidentally introduce a non-coordinate `{lat, lng}` object that the converter then wraps in a `GeoPoint`.

### SDK adapter wiring

```ts
// packages/shared/src/firebase/converters/sdkAdapters.ts
// Two thin adapter modules; only one is imported by client refs, only the other by admin refs.

// client.ts variant:
import { Timestamp, GeoPoint } from 'firebase/firestore';
export const clientSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: (v): v is Timestamp => v instanceof Timestamp,
  isGeoPoint: (v): v is GeoPoint => v instanceof GeoPoint,
};

// admin.ts variant:
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
export const adminSdkCtors: SdkCtors = { /* analogous */ };
```

The actual converter module per collection imports BOTH adapters and exports BOTH converters:

```ts
// packages/shared/src/firebase/converters/eventConverter.ts
import { EventDataSchema } from '../../models/event/EventDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const eventConverterClient = makeConverter(EventDataSchema, clientSdkCtors);
export const eventConverterAdmin = makeConverter(EventDataSchema, adminSdkCtors);
```

Tree-shaking + subpath exports ensure the client-SDK adapter never lands in the functions/ bundle and vice versa.

### Ref factories

```ts
// packages/shared/src/firebase/refs/client.ts
import { collection, doc, type Firestore } from 'firebase/firestore';
import { eventConverterClient } from '../converters/eventConverter';

export const eventsCollection = (db: Firestore) =>
  collection(db, 'events').withConverter(eventConverterClient);
export const eventDoc = (db: Firestore, id: string) =>
  doc(db, 'events', id).withConverter(eventConverterClient);

// Subcollections take parent ids:
export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  collection(db, 'events', eventId, 'registrations').withConverter(registrationConverterClient);
export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  doc(db, 'events', eventId, 'registrations', registrationId).withConverter(registrationConverterClient);
```

`refs/admin.ts` is structurally identical but uses `firebase-admin/firestore`.

**Convention:** all subcollection access goes through these factories. No `parentRef.collection('children')` chained access in services or functions — only `subCollection(db, parentId)`. This is grep-friendly: `grep "eventRegistrationsCollection"` finds every consumer.

### Service code after migration (example)

```ts
// packages/shared/src/services/eventService.ts
import { getDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { eventsCollection, eventDoc } from '../firebase/refs/client';
import { getDb } from '../firebase';
import type { EventData, EventStatus } from '../models/event/EventDataModel';

export async function getEvent(eventId: string): Promise<(EventData & { id: string }) | null> {
  const snap = await getDoc(eventDoc(getDb(), eventId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getEventsByMunicipality(
  municipalityId: string,
  status?: EventStatus,
): Promise<(EventData & { id: string })[]> {
  const ref = eventsCollection(getDb());
  const constraints = status
    ? [where('municipalityId', '==', municipalityId), where('status', '==', status), orderBy('startDate', 'asc')]
    : [where('municipalityId', '==', municipalityId), orderBy('startDate', 'asc')];
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
```

**Every `map<X>Doc` function in every service is deleted.** `snap.data()` returns the typed model.

### Write sentinels (`serverTimestamp`, `increment`, `arrayUnion`)

`setDoc` and `addDoc` invoke `toFirestore`. `updateDoc` does NOT — so FieldValue sentinels in partial updates are naturally bypassed by the converter.

For `setDoc` payloads, the model must be plain (`Date`, `number`, etc.). Current `buildEventData` already uses `new Date()` for `createdAt`/`updatedAt` rather than `serverTimestamp()`. Audit during implementation: any `setDoc(ref, { ...serverTimestamp() })` call switches to a plain `Date`.

## Collection inventory

12 top-level + 8 subcollections (full set as of 2026-05-29):

**Top-level:** `events`, `municipalities`, `news`, `newsComments`, `newsReactions`, `newsReports`, `occupationProposals`, `occupations`, `organizations`, `organizerRequests`, `persons`, `users`.

**Subcollections:** `municipalities/{id}/members`, `municipalities/{id}/inviteTokens`, `municipalities/{id}/barrios`, `municipalities/{id}/cemeteries`, `municipalities/{id}/joinRequests`, `users/{id}/notifications`, `events/{id}/registrations`, `organizations/{id}/members`.

Each gets:
- A `<X>DataModel.ts` with schema + inferred type (one file per logical collection — barrios/cemeteries may share `municipality/`).
- A `<x>Converter.ts` exposing client + admin converters.
- Ref factory entries in `refs/client.ts` and `refs/admin.ts`.

## ESLint setup

Two new configs (one in `packages/shared`, one in `functions/`):

```js
// packages/shared/eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // No file-level disables. If a test legitimately needs `any` (mock impls),
      // we use a narrow rule override scoped to test/mocks/, not file-level disables.
    },
  },
);
```

`functions/eslint.config.mjs` is structurally identical.

Both packages add `"lint": "eslint . --max-warnings 0"` to package.json. `pnpm check` (root) includes both.

## Test impact

Tests fall into three groups:

1. **Unit tests against models** (vitest in `packages/shared/test/models/`): construct fixtures using `schema.parse(...)` or the existing builders. Replace any `as any` casts with proper shapes.
2. **Emulator tests** (`packages/shared/test/e2e/`, `functions/src/__tests__/`): seed Firestore via typed refs. Reads automatically validate. A few "deliberately malformed doc" tests may be needed to exercise the strict-throw path.
3. **Rules tests** (`@firebase/rules-unit-testing`): unaffected — they validate Firestore Rules, not type contracts.

The typed-test-fixtures plan (per ordago's blocked plan) is deferred. We commit to writing tests in a "minimally typed" style during this migration and revisit fixture builders only if drift becomes a maintenance burden.

## Migration order (one PR, several reviewable commits)

1. **Foundation commit.** `makeConverter.ts`, `sdkAdapters.client.ts`, `sdkAdapters.admin.ts`, `refs/client.ts` (empty), `refs/admin.ts` (empty). New `eslint.config.mjs` files in both workspaces, initially scoped to the new directories. Pin TS strict settings.
2. **First collection end-to-end.** `event` is the proof. `EventDataModel.ts` → schema + type; `RegistrationDataModel.ts` → schema + type; converters; ref factories; migrate `eventService.ts` + `registrationService.ts`; migrate `functions/src/registerToEvent*.ts` + `functions/src/syncVillageDenormalization.ts` (the event-touching ones); update vitest fixtures for the affected tests; run `pnpm check`. Lint rules now active across the touched paths.
3. **Remaining collections, one commit each (or grouped by domain).** Per the inventory list. Each commit migrates schema + converter + refs + service + any functions consumer + tests.
4. **Flip ESLint config to whole workspaces.** Move from path-scoped rules to whole-workspace `recommendedTypeChecked + strictTypeChecked`. Fix the long tail of newly-surfaced violations.
5. **Cleanup.** Delete every `map<X>Doc` function. Grep for `as Foo` casts on Firestore-derived data and delete the now-redundant ones. Grep for `collection(getDb(), '...'` and `db.collection('...')` outside `refs/` — both should return zero hits.

## Acceptance criteria

- `grep -rn "collection(getDb(), '"  packages/shared/src/services/` returns zero hits.
- `grep -rn "\.collection('[a-z]"  functions/src/` returns zero hits outside `firebase/refs/admin.ts`.
- `grep -rn "map[A-Z][a-zA-Z]*Doc"  packages/shared/src/services/` returns zero hits.
- `grep -rn "GeoPoint"  packages/shared/src/ functions/src/` returns hits only inside `firebase/converters/sdkAdapters.*.ts` and `firebase/refs/*.ts` (and any UI code that explicitly constructs one to pass to a service input — these become `{lat, lng}` literals).
- `pnpm --filter @cultuvilla/shared lint` passes at `--max-warnings 0`.
- `pnpm --filter @cultuvilla/functions lint` passes at `--max-warnings 0` (configure if not present).
- `pnpm check` passes (typecheck + lint + tests across the workspace).
- Manual smoke test on dev: read + write at least one document per collection through the mobile app.

## Risks and call-outs

- **`{lat, lng}` structural detection on writes.** Documented as a codebase convention; the converter's denormalizer header comment owns enforcing this. Risk is low because no existing model uses `{lat, lng}` for non-coordinate purposes.
- **Date vs Timestamp consistency.** Forcing `Date` in schemas will surface places where the codebase already drifted (e.g. an ISO string sneaking into a date field). Treat surfaced failures as bugs to fix, not noise.
- **Admin SDK type imports in `packages/shared`.** Required for the admin adapter and admin refs. We use type-only imports (`import type { Firestore } from 'firebase-admin/firestore'`) where possible, and the subpath exports map ensures the admin runtime never bundles into the mobile app.
- **Bundle cost on mobile.** Zod 4 is already shipped; this migration adds schema definitions (small constant cost) and the converter walker (tiny). Net new bundle weight: low single-digit KB.
- **Per-read parse cost.** Schema validation on every read has a small CPU cost. Negligible for cultuvilla's current read volume; revisit if/when a high-volume real-time listener becomes a hot path.
- **Future contributors writing `serverTimestamp()` in `setDoc`.** ESLint can't catch this directly. We rely on `toFirestore`'s `schema.parse(model)` throwing (since `serverTimestamp()` is not a `Date`) — that converts the bug from "silent wrong timestamp" to "loud thrown error at write site." Acceptable.

## Out of scope

- Audit/backfill scripts (`scripts/audit-firestore-shapes.ts`). Required before beta launch — captured as a follow-up task, not this PR.
- Typed test fixture builders (the `buildEventFixture` family from ordago's blocked plan). Deferred until test surface size makes the investment pay off.
- Refactoring `EventFormSchema`-style form schemas. They describe a different concern (user input) and stay as-is.
- Firestore rules changes. This is a typing project, not a security project.
- Storage rules, App Check, or any other auth-adjacent concern.

## Handoff to the implementation plan

The implementation plan (next document, produced by `superpowers:writing-plans`) takes the Migration Order section above and expands each step into:
- Files touched
- Tests added/updated
- The verification gate that must pass before the next commit lands

Expected commit count: 8–12 small commits on `worktree-firestore-typed-converters`, landing as a single fast-forward merge to `main` once `pnpm check` passes cleanly.
