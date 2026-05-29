# Firestore Typed Converters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hand-rolled `map<X>Doc` function in `packages/shared/src/services/` and every untyped `admin.firestore().collection('...').doc(id).get()` call in `functions/src/` with Zod-schema-driven typed Firestore converters, then enable ESLint type-aware rules across both workspaces.

**Architecture:** Zod schemas are the source of truth (`type EventData = z.infer<typeof EventDataSchema>`). Schemas are SDK-agnostic (`Date`, plain `{lat, lng}` instead of `Timestamp`/`GeoPoint`). A generic `makeConverter(schema, sdkCtors)` factory produces a Firestore `withConverter`-compatible object; two thin adapters bind it to client SDK and admin SDK. Services and functions access Firestore exclusively through ref factories in `packages/shared/src/firebase/refs/{client,admin}.ts`.

**Tech Stack:** TypeScript 5.8, Zod 4, Firebase JS SDK 11 (client), firebase-admin 13 (admin), Vitest 4, ESLint 9 with `typescript-eslint` `strictTypeChecked + recommendedTypeChecked`.

**Spec:** [docs/superpowers/specs/2026-05-29-firestore-typed-converters-design.md](../specs/2026-05-29-firestore-typed-converters-design.md)

---

## Phase 1 — Foundation (machinery, no model changes yet)

### Task 1: Walker functions (`normalize` + `denormalize`)

The recursive walkers translate between SDK-shaped data (Timestamp, GeoPoint) and schema-shaped data (Date, `{lat, lng}`). Pure functions, no Firestore deps — testable in isolation. We write tests first, then the implementation.

**Files:**
- Create: `packages/shared/src/firebase/converters/walkers.ts`
- Create: `packages/shared/test/firebase/converters/walkers.test.ts`

- [ ] **Step 1: Write failing test for `normalize`**

```ts
// packages/shared/test/firebase/converters/walkers.test.ts
import { describe, it, expect } from 'vitest';
import { normalize, denormalize, type SdkCtors } from '../../../src/firebase/converters/walkers';

// Fake SDK ctors that mimic Timestamp/GeoPoint shape (constructors return tagged objects).
class FakeTimestamp {
  constructor(private readonly d: Date) {}
  toDate(): Date { return this.d; }
}
class FakeGeoPoint {
  constructor(public readonly latitude: number, public readonly longitude: number) {}
}
const fakeSdk: SdkCtors = {
  TimestampFromDate: (d) => new FakeTimestamp(d),
  GeoPointFrom: (lat, lng) => new FakeGeoPoint(lat, lng),
  isTimestamp: (v): v is { toDate(): Date } => v instanceof FakeTimestamp,
  isGeoPoint: (v): v is { latitude: number; longitude: number } => v instanceof FakeGeoPoint,
};

describe('normalize', () => {
  it('converts Timestamp instances to Date', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const input = { createdAt: new FakeTimestamp(d) };
    expect(normalize(input, fakeSdk)).toEqual({ createdAt: d });
  });

  it('converts GeoPoint instances to {lat, lng}', () => {
    const input = { coords: new FakeGeoPoint(40.4, -3.7) };
    expect(normalize(input, fakeSdk)).toEqual({ coords: { lat: 40.4, lng: -3.7 } });
  });

  it('recurses into nested objects and arrays', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const input = {
      events: [
        { startDate: new FakeTimestamp(d), location: { coords: new FakeGeoPoint(1, 2) } },
      ],
    };
    expect(normalize(input, fakeSdk)).toEqual({
      events: [{ startDate: d, location: { coords: { lat: 1, lng: 2 } } }],
    });
  });

  it('passes primitives and null through unchanged', () => {
    expect(normalize({ a: 1, b: 'x', c: null, d: false }, fakeSdk)).toEqual({
      a: 1, b: 'x', c: null, d: false,
    });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/walkers.test.ts
```

Expected: FAIL with `Cannot find module .../walkers`.

- [ ] **Step 3: Implement `normalize` and the types**

```ts
// packages/shared/src/firebase/converters/walkers.ts
/**
 * Walker functions that translate between Firestore SDK shapes and schema shapes.
 *
 * Reads:  Timestamp instance -> Date;  GeoPoint instance -> { lat, lng }.
 * Writes: Date instance      -> Timestamp;  { lat, lng } object -> GeoPoint.
 *
 * Convention: an object with EXACTLY two numeric keys `lat` and `lng` is
 * treated as a coordinate on writes. Do not introduce non-coordinate objects
 * with this shape elsewhere in the codebase.
 */

export interface SdkCtors {
  TimestampFromDate: (d: Date) => unknown;
  GeoPointFrom: (lat: number, lng: number) => unknown;
  isTimestamp: (v: unknown) => v is { toDate(): Date };
  isGeoPoint: (v: unknown) => v is { latitude: number; longitude: number };
}

export function normalize(value: unknown, sdk: SdkCtors): unknown {
  if (value === null || value === undefined) return value;
  if (sdk.isTimestamp(value)) return value.toDate();
  if (sdk.isGeoPoint(value)) return { lat: value.latitude, lng: value.longitude };
  if (Array.isArray(value)) return value.map((v) => normalize(v, sdk));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v, sdk);
    return out;
  }
  return value;
}

function isLatLng(v: unknown): v is { lat: number; lng: number } {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length !== 2) return false;
  const o = v as Record<string, unknown>;
  return typeof o.lat === 'number' && typeof o.lng === 'number';
}

export function denormalize(value: unknown, sdk: SdkCtors): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return sdk.TimestampFromDate(value);
  if (isLatLng(value)) return sdk.GeoPointFrom(value.lat, value.lng);
  if (Array.isArray(value)) return value.map((v) => denormalize(v, sdk));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = denormalize(v, sdk);
    return out;
  }
  return value;
}
```

- [ ] **Step 4: Run `normalize` tests, verify they pass**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/walkers.test.ts -t normalize
```

Expected: 4 tests pass.

- [ ] **Step 5: Add failing tests for `denormalize`**

Append to `walkers.test.ts`:

```ts
describe('denormalize', () => {
  it('converts Date instances to Timestamp via TimestampFromDate', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const out = denormalize({ createdAt: d }, fakeSdk) as { createdAt: FakeTimestamp };
    expect(out.createdAt).toBeInstanceOf(FakeTimestamp);
    expect(out.createdAt.toDate()).toEqual(d);
  });

  it('converts {lat, lng} objects to GeoPoint via GeoPointFrom', () => {
    const out = denormalize({ coords: { lat: 40.4, lng: -3.7 } }, fakeSdk) as { coords: FakeGeoPoint };
    expect(out.coords).toBeInstanceOf(FakeGeoPoint);
    expect(out.coords.latitude).toBe(40.4);
    expect(out.coords.longitude).toBe(-3.7);
  });

  it('does NOT treat objects with extra keys as coordinates', () => {
    const input = { thing: { lat: 1, lng: 2, label: 'home' } };
    const out = denormalize(input, fakeSdk) as { thing: Record<string, unknown> };
    expect(out.thing).toEqual({ lat: 1, lng: 2, label: 'home' });
  });

  it('passes primitives and null through unchanged', () => {
    expect(denormalize({ a: 1, b: 'x', c: null, d: false }, fakeSdk)).toEqual({
      a: 1, b: 'x', c: null, d: false,
    });
  });
});
```

- [ ] **Step 6: Run all walker tests, verify all pass**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/walkers.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/firebase/converters/walkers.ts packages/shared/test/firebase/converters/walkers.test.ts
git -c commit.gpgsign=false commit -m "feat(firebase): walker functions for Firestore <-> schema shape normalization

Pure recursive walkers that translate between SDK-shaped data (Timestamp,
GeoPoint instances) and schema-shaped data (Date, {lat,lng}). Foundation for
the typed converter factory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `makeConverter` factory (with strict parse on read + write)

**Files:**
- Create: `packages/shared/src/firebase/converters/makeConverter.ts`
- Create: `packages/shared/test/firebase/converters/makeConverter.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/shared/test/firebase/converters/makeConverter.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { makeConverter } from '../../../src/firebase/converters/makeConverter';
import type { SdkCtors } from '../../../src/firebase/converters/walkers';

class FakeTimestamp {
  constructor(private readonly d: Date) {}
  toDate(): Date { return this.d; }
}
class FakeGeoPoint {
  constructor(public readonly latitude: number, public readonly longitude: number) {}
}
const fakeSdk: SdkCtors = {
  TimestampFromDate: (d) => new FakeTimestamp(d),
  GeoPointFrom: (lat, lng) => new FakeGeoPoint(lat, lng),
  isTimestamp: (v): v is { toDate(): Date } => v instanceof FakeTimestamp,
  isGeoPoint: (v): v is { latitude: number; longitude: number } => v instanceof FakeGeoPoint,
};

const Schema = z.object({
  name: z.string(),
  createdAt: z.date(),
  coords: z.object({ lat: z.number(), lng: z.number() }).nullable(),
});

const converter = makeConverter(Schema, fakeSdk);

describe('makeConverter', () => {
  describe('fromFirestore', () => {
    it('returns the typed model when the doc matches the schema', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      const snap = { data: () => ({ name: 'x', createdAt: new FakeTimestamp(d), coords: new FakeGeoPoint(1, 2) }) };
      expect(converter.fromFirestore(snap)).toEqual({ name: 'x', createdAt: d, coords: { lat: 1, lng: 2 } });
    });

    it('throws when a required field is missing', () => {
      const snap = { data: () => ({ name: 'x', coords: null }) };
      expect(() => converter.fromFirestore(snap)).toThrow();
    });

    it('throws when a field has the wrong type', () => {
      const snap = { data: () => ({ name: 123, createdAt: new FakeTimestamp(new Date()), coords: null }) };
      expect(() => converter.fromFirestore(snap)).toThrow();
    });
  });

  describe('toFirestore', () => {
    it('returns Firestore-shaped data when the model matches the schema', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      const out = converter.toFirestore({ name: 'x', createdAt: d, coords: { lat: 1, lng: 2 } }) as {
        name: string; createdAt: FakeTimestamp; coords: FakeGeoPoint;
      };
      expect(out.name).toBe('x');
      expect(out.createdAt).toBeInstanceOf(FakeTimestamp);
      expect(out.createdAt.toDate()).toEqual(d);
      expect(out.coords).toBeInstanceOf(FakeGeoPoint);
    });

    it('throws when the model does not match the schema', () => {
      // @ts-expect-error -- intentional violation to verify runtime guard
      expect(() => converter.toFirestore({ name: 'x' })).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/makeConverter.test.ts
```

Expected: FAIL with `Cannot find module .../makeConverter`.

- [ ] **Step 3: Implement `makeConverter`**

```ts
// packages/shared/src/firebase/converters/makeConverter.ts
import type { z } from 'zod';
import { normalize, denormalize, type SdkCtors } from './walkers';

/**
 * Build a Firestore converter (`{ toFirestore, fromFirestore }`) from a Zod
 * schema and a SDK adapter. Strict on both directions:
 *   - reads: snap.data() is normalized (Timestamp -> Date, GeoPoint -> {lat,lng})
 *     and then validated against the schema; throws on mismatch
 *   - writes: the model is validated against the schema first, then denormalized
 *     (Date -> Timestamp, {lat,lng} -> GeoPoint)
 *
 * The returned object is shaped to match Firestore's `FirestoreDataConverter`.
 * We don't import that type directly so the same converter works for both the
 * client SDK and the admin SDK (which expose structurally-identical interfaces).
 */
export function makeConverter<S extends z.ZodTypeAny>(schema: S, sdk: SdkCtors) {
  type Model = z.infer<S>;
  return {
    toFirestore(model: Model): Record<string, unknown> {
      schema.parse(model);
      return denormalize(model, sdk) as Record<string, unknown>;
    },
    fromFirestore(snap: { data(): unknown }): Model {
      const normalized = normalize(snap.data(), sdk);
      return schema.parse(normalized) as Model;
    },
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/makeConverter.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/firebase/converters/makeConverter.ts packages/shared/test/firebase/converters/makeConverter.test.ts
git -c commit.gpgsign=false commit -m "feat(firebase): makeConverter factory binding Zod schema to Firestore

Strict on both directions: fromFirestore normalizes then parses; toFirestore
parses then denormalizes. Pure factory — no SDK imports; consumers supply the
SDK adapter via SdkCtors.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: SDK adapter modules (client + admin)

The adapter modules wire the Firebase SDK-specific Timestamp/GeoPoint classes to the generic `SdkCtors` shape. Each adapter is a one-line export; the value is keeping these isolated so subpath exports can ensure the client SDK never lands in the functions/ bundle and vice versa.

**Files:**
- Create: `packages/shared/src/firebase/converters/sdkAdapters.client.ts`
- Create: `packages/shared/src/firebase/converters/sdkAdapters.admin.ts`

- [ ] **Step 1: Write client adapter**

```ts
// packages/shared/src/firebase/converters/sdkAdapters.client.ts
import { Timestamp, GeoPoint } from 'firebase/firestore';
import type { SdkCtors } from './walkers';

export const clientSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: (v): v is Timestamp => v instanceof Timestamp,
  isGeoPoint: (v): v is GeoPoint => v instanceof GeoPoint,
};
```

- [ ] **Step 2: Write admin adapter**

```ts
// packages/shared/src/firebase/converters/sdkAdapters.admin.ts
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import type { SdkCtors } from './walkers';

export const adminSdkCtors: SdkCtors = {
  TimestampFromDate: (d) => Timestamp.fromDate(d),
  GeoPointFrom: (lat, lng) => new GeoPoint(lat, lng),
  isTimestamp: (v): v is Timestamp => v instanceof Timestamp,
  isGeoPoint: (v): v is GeoPoint => v instanceof GeoPoint,
};
```

- [ ] **Step 3: Add `firebase-admin` to `packages/shared/package.json` peerDependencies**

Edit `packages/shared/package.json`. In the existing `peerDependencies` block (which has `firebase`), add `firebase-admin`:

```json
"peerDependencies": {
  "firebase": "^11.0.0",
  "firebase-admin": "^13.0.0"
},
"peerDependenciesMeta": {
  "firebase": { "optional": true },
  "firebase-admin": { "optional": true }
},
```

The `optional: true` flag tells pnpm that consumers can omit either SDK (e.g. the mobile app only needs `firebase`, functions/ only needs `firebase-admin`). Then run install in repo root:

```bash
pnpm install
```

Expected: no errors; lockfile updated.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @cultuvilla/shared typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/firebase/converters/sdkAdapters.client.ts packages/shared/src/firebase/converters/sdkAdapters.admin.ts packages/shared/package.json pnpm-lock.yaml
git -c commit.gpgsign=false commit -m "feat(firebase): SDK adapters for client and admin Firestore

Two thin adapter modules wire the Firebase client / admin SDK Timestamp and
GeoPoint classes to the SdkCtors interface consumed by makeConverter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Subpath exports in `packages/shared/package.json`

We need `@cultuvilla/shared/firebase/refs/client` and `@cultuvilla/shared/firebase/refs/admin` to resolve as distinct entry points so the mobile bundle never pulls in `firebase-admin` and functions never pulls in `firebase/firestore`.

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/tsconfig.json` (verify `moduleResolution: "Bundler"` or `"NodeNext"`)

- [ ] **Step 1: Read current tsconfig**

```bash
cat packages/shared/tsconfig.json
```

Confirm `moduleResolution` is `Bundler` or `NodeNext` (both support `exports`). If it's `Node` or `Node10`, change it to `Bundler`.

- [ ] **Step 2: Update package.json with exports map**

Edit `packages/shared/package.json` — replace the existing `"main"` and `"types"` fields with an `exports` map:

```json
{
  "name": "@cultuvilla/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./firebase/refs/client": {
      "types": "./dist/firebase/refs/client.d.ts",
      "import": "./dist/firebase/refs/client.js"
    },
    "./firebase/refs/admin": {
      "types": "./dist/firebase/refs/admin.d.ts",
      "import": "./dist/firebase/refs/admin.js"
    }
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  ...
}
```

Keep `main` and `types` as fallbacks for tools that don't read `exports`.

- [ ] **Step 3: Create stub ref files so the build passes**

```ts
// packages/shared/src/firebase/refs/client.ts
// Ref factories — populated as collections migrate. See Task 11+.
export {};
```

```ts
// packages/shared/src/firebase/refs/admin.ts
// Ref factories — populated as collections migrate. See Task 11+.
export {};
```

- [ ] **Step 4: Build to verify exports resolve**

```bash
pnpm --filter @cultuvilla/shared build
ls packages/shared/dist/firebase/refs/
```

Expected: `client.js`, `client.d.ts`, `admin.js`, `admin.d.ts` exist.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/src/firebase/refs/client.ts packages/shared/src/firebase/refs/admin.ts
git -c commit.gpgsign=false commit -m "feat(shared): subpath exports for firebase/refs/{client,admin}

Distinct entry points keep the client SDK out of the functions bundle and
firebase-admin out of the mobile bundle. Empty ref stubs populated by
subsequent per-collection commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: ESLint configs for `packages/shared` and `functions/`

Both workspaces get a config now, but path-scoped so only the new converter/refs/models code is enforced at first. We flip to whole-workspace in Phase 4 after all collections migrate.

**Files:**
- Create: `packages/shared/eslint.config.mjs`
- Create: `functions/eslint.config.mjs`
- Modify: `packages/shared/package.json` (add `lint` script)
- Modify: `functions/package.json` (add `lint` script)

- [ ] **Step 1: Add typescript-eslint and eslint to root devDeps if missing**

```bash
pnpm -w add -D eslint@^9 typescript-eslint@^8 globals
```

Expected: installed without errors.

- [ ] **Step 2: Write `packages/shared/eslint.config.mjs`**

```js
// packages/shared/eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: [
      'src/firebase/**/*.ts',
      'src/models/**/*.ts',
      'test/firebase/**/*.ts',
    ],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
```

- [ ] **Step 3: Write `functions/eslint.config.mjs`**

```js
// functions/eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Phase 1 scope: nothing yet. Each collection-migration commit adds the
    // touched function files to this glob until Phase 4 flips it to src/**.
    files: ['src/__never__'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['lib/**', 'node_modules/**'],
  },
);
```

- [ ] **Step 4: Add `lint` scripts**

In `packages/shared/package.json`, add to `scripts`:

```json
"lint": "eslint . --max-warnings 0"
```

In `functions/package.json`, add to `scripts`:

```json
"lint": "eslint . --max-warnings 0"
```

In the root `package.json`, extend the existing `check` script:

```json
"lint": "pnpm --filter @cultuvilla/shared lint && pnpm --filter @cultuvilla/functions lint",
"check": "pnpm typecheck && pnpm lint && pnpm test && pnpm build"
```

- [ ] **Step 5: Run lint on each workspace**

```bash
pnpm --filter @cultuvilla/shared lint
pnpm --filter @cultuvilla/functions lint
```

Expected: both pass at `--max-warnings 0`. The path-scoped config means only the new code under `src/firebase/` and `src/models/` is checked in shared (which is clean so far).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/eslint.config.mjs packages/shared/package.json functions/eslint.config.mjs functions/package.json package.json pnpm-lock.yaml
git -c commit.gpgsign=false commit -m "feat(lint): ESLint type-aware rules scoped to converter/refs/models scope

Path-scoped recommendedTypeChecked + strictTypeChecked in packages/shared and
functions/. Phase 4 flips to whole-workspace once all collections migrate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Event domain end-to-end (the proof)

The event domain (event + registration + the LocationData primitive it uses) goes through the full pattern first. This is the template every subsequent collection follows.

### Task 6: Migrate `LocationDataModel.ts` to schema-first

`LocationData` is used by `EventData.location`; it currently references `GeoPoint`. This file gets rewritten first.

**Files:**
- Modify: `packages/shared/src/models/core/LocationDataModel.ts`
- Create: `packages/shared/test/models/core/LocationDataModel.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/test/models/core/LocationDataModel.test.ts
import { describe, it, expect } from 'vitest';
import { LocationDataSchema, buildLocationData } from '../../../src/models/core/LocationDataModel';

describe('LocationDataSchema', () => {
  it('accepts a coordinates location with {lat, lng}', () => {
    const parsed = LocationDataSchema.parse({
      type: 'coordinates',
      coordinates: { lat: 40.4, lng: -3.7 },
      text: null,
    });
    expect(parsed.coordinates).toEqual({ lat: 40.4, lng: -3.7 });
  });

  it('accepts a text location with null coordinates', () => {
    expect(() => LocationDataSchema.parse({
      type: 'text',
      coordinates: null,
      text: 'Main square',
    })).not.toThrow();
  });

  it('rejects malformed coordinates', () => {
    expect(() => LocationDataSchema.parse({
      type: 'coordinates',
      coordinates: { lat: 'forty', lng: -3.7 },
      text: null,
    })).toThrow();
  });
});

describe('buildLocationData', () => {
  it('defaults to a text location with both fields null', () => {
    expect(buildLocationData()).toEqual({ type: 'text', coordinates: null, text: null });
  });

  it('clears coordinates when type is text', () => {
    const data = buildLocationData({ type: 'text', coordinates: { lat: 1, lng: 2 }, text: 'x' });
    expect(data.coordinates).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/models/core/LocationDataModel.test.ts
```

Expected: FAIL with `LocationDataSchema is not exported`.

- [ ] **Step 3: Rewrite `LocationDataModel.ts`**

```ts
// packages/shared/src/models/core/LocationDataModel.ts
import { z } from 'zod';

export const LocationTypeSchema = z.enum(['coordinates', 'text']);
export type LocationType = z.infer<typeof LocationTypeSchema>;

export const LatLngSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type LatLng = z.infer<typeof LatLngSchema>;

export const LocationDataSchema = z.object({
  type: LocationTypeSchema,
  coordinates: LatLngSchema.nullable(),
  text: z.string().nullable(),
});
export type LocationData = z.infer<typeof LocationDataSchema>;

export interface LocationDataInput {
  type?: LocationType;
  coordinates?: LatLng | null;
  text?: string | null;
}

export function buildLocationData(input: LocationDataInput = {}): LocationData {
  const type = input.type ?? 'text';
  return {
    type,
    coordinates: type === 'coordinates' ? (input.coordinates ?? null) : null,
    text: type === 'text' ? (input.text ?? null) : null,
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/models/core/LocationDataModel.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Find all consumers of `GeoPoint` via `LocationData.coordinates` and confirm none break the build yet**

```bash
grep -rn "coordinates" packages/shared/src/services/ functions/src/ apps/mobile/ | grep -i "geopoint\|GeoPoint\|new GeoPoint" | head -20
pnpm --filter @cultuvilla/shared typecheck
```

Expected: typecheck may fail at sites that still pass `GeoPoint` to `coordinates`. Note them; they will be fixed in Task 7 + 12 + 13 (event-domain migrations) or later domain tasks. Skip ahead only if the failures are confined to event-domain files.

- [ ] **Step 6: Commit (with the broken-typecheck context if applicable)**

```bash
git add packages/shared/src/models/core/LocationDataModel.ts packages/shared/test/models/core/LocationDataModel.test.ts
git -c commit.gpgsign=false commit -m "refactor(models): LocationData schema-first; coordinates as {lat,lng}

GeoPoint usage moves to the converter boundary. Sites that pass GeoPoint
into LocationData get fixed in the per-domain migrations that follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Pre-commit hook will run lint-staged; if it fails, fix and re-commit.)

---

### Task 7: Migrate `EventDataModel.ts` to schema-first

**Files:**
- Modify: `packages/shared/src/models/event/EventDataModel.ts`
- Create: `packages/shared/test/models/event/EventDataModel.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/shared/test/models/event/EventDataModel.test.ts
import { describe, it, expect } from 'vitest';
import { EventDataSchema, EventStatusSchema, buildEventData } from '../../../src/models/event/EventDataModel';

const validEvent = {
  title: 'Fiesta',
  description: 'Annual fiesta',
  startDate: new Date('2026-06-15T18:00:00Z'),
  endDate: null,
  location: { type: 'text' as const, coordinates: null, text: 'Plaza Mayor' },
  imageURL: null,
  price: null,
  maxAttendees: 100,
  telephoneRequired: false,
  status: 'published' as const,
  organizationId: 'org-1',
  organizationName: 'Asociación X',
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  municipalityId: 'm-1',
  municipalityName: 'Villa',
  municipalityCoverImage: null,
  municipalityCoordinates: { lat: 40.4, lng: -3.7 },
};

describe('EventDataSchema', () => {
  it('parses a complete valid event', () => {
    expect(() => EventDataSchema.parse(validEvent)).not.toThrow();
  });

  it('accepts optional confirmedCount and totalCount', () => {
    expect(() => EventDataSchema.parse({ ...validEvent, confirmedCount: 12, totalCount: 15 })).not.toThrow();
  });

  it('rejects a missing required field', () => {
    const { title, ...rest } = validEvent;
    expect(() => EventDataSchema.parse(rest)).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => EventDataSchema.parse({ ...validEvent, status: 'archived' })).toThrow();
  });
});

describe('buildEventData', () => {
  it('fills defaults for optional fields', () => {
    const built = buildEventData({
      title: 'X', description: 'Y',
      startDate: new Date('2026-06-15T18:00:00Z'),
      location: { type: 'text', coordinates: null, text: null },
      organizationId: 'o', organizationName: 'O',
      createdBy: 'u',
      municipalityId: 'm', municipalityName: 'M',
      municipalityCoordinates: { lat: 1, lng: 2 },
    });
    expect(built.status).toBe('draft');
    expect(built.telephoneRequired).toBe(false);
    expect(built.endDate).toBeNull();
    // Validate the result against the schema
    expect(() => EventDataSchema.parse(built)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/models/event/EventDataModel.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Rewrite `EventDataModel.ts`**

```ts
// packages/shared/src/models/event/EventDataModel.ts
import { z } from 'zod';
import { LocationDataSchema, LatLngSchema } from '../core/LocationDataModel';

export const EventStatusSchema = z.enum(['draft', 'published', 'cancelled', 'completed']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.date(),
  endDate: z.date().nullable(),
  location: LocationDataSchema,
  imageURL: z.string().nullable(),
  price: z.number().nullable(),
  maxAttendees: z.number().int().nullable(),
  telephoneRequired: z.boolean(),
  status: EventStatusSchema,
  organizationId: z.string(),
  organizationName: z.string(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  municipalityCoverImage: z.string().nullable(),
  municipalityCoordinates: LatLngSchema.nullable(),
  confirmedCount: z.number().int().optional(),
  totalCount: z.number().int().optional(),
});
export type EventData = z.infer<typeof EventDataSchema>;

export interface EventDataInput {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date | null;
  location: z.infer<typeof LocationDataSchema>;
  imageURL?: string | null;
  price?: number | null;
  maxAttendees?: number | null;
  telephoneRequired?: boolean;
  status?: EventStatus;
  organizationId: string;
  organizationName: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  municipalityId: string;
  municipalityName: string;
  municipalityCoverImage?: string | null;
  municipalityCoordinates: z.infer<typeof LatLngSchema> | null;
}

export function buildEventData(input: EventDataInput): EventData {
  const now = new Date();
  return {
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    price: input.price ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'draft',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    municipalityId: input.municipalityId,
    municipalityName: input.municipalityName,
    municipalityCoverImage: input.municipalityCoverImage ?? null,
    municipalityCoordinates: input.municipalityCoordinates,
  };
}

export function isEventFull(event: EventData, confirmedCount: number): boolean {
  if (event.maxAttendees === null) return false;
  return confirmedCount >= event.maxAttendees;
}

export function isEventSignupOpen(event: EventData): boolean {
  return event.status === 'published';
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/models/event/EventDataModel.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/models/event/EventDataModel.ts packages/shared/test/models/event/EventDataModel.test.ts
git -c commit.gpgsign=false commit -m "refactor(models): EventData schema-first with Zod

EventDataSchema is the source of truth; type EventData = z.infer<...>.
GeoPoint references replaced with LatLng ({lat,lng}). buildEventData
typed by the schema-derived input shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Migrate `RegistrationDataModel.ts` to schema-first

**Files:**
- Modify: `packages/shared/src/models/event/RegistrationDataModel.ts`
- Create: `packages/shared/test/models/event/RegistrationDataModel.test.ts`

- [ ] **Step 1: Read current file to learn its shape**

```bash
cat packages/shared/src/models/event/RegistrationDataModel.ts
```

- [ ] **Step 2: Write failing test scoped to whatever the schema needs to express**

Based on the file read above, write a test that mirrors the structure of `EventDataModel.test.ts`: a complete-valid case, a missing-required case, and a type-mismatch case. Re-use the literal shape from current `RegistrationData` as the seed.

- [ ] **Step 3: Run test, verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/models/event/RegistrationDataModel.test.ts
```

- [ ] **Step 4: Rewrite `RegistrationDataModel.ts` to mirror `EventDataModel.ts`'s shape**

Same pattern as Task 7: `RegistrationDataSchema = z.object({...})`, `type RegistrationData = z.infer<...>`, preserve any existing `buildRegistrationData` builder retyped against the new schema.

- [ ] **Step 5: Run tests, verify pass**

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/models/event/RegistrationDataModel.ts packages/shared/test/models/event/RegistrationDataModel.test.ts
git -c commit.gpgsign=false commit -m "refactor(models): RegistrationData schema-first with Zod

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Implement `eventConverter.ts` and `registrationConverter.ts`

**Files:**
- Create: `packages/shared/src/firebase/converters/eventConverter.ts`
- Create: `packages/shared/src/firebase/converters/registrationConverter.ts`
- Create: `packages/shared/test/firebase/converters/eventConverter.test.ts`

- [ ] **Step 1: Write failing test for `eventConverter`**

```ts
// packages/shared/test/firebase/converters/eventConverter.test.ts
import { describe, it, expect } from 'vitest';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { eventConverterClient } from '../../../src/firebase/converters/eventConverter';

const baseFirestoreShape = {
  title: 'Fiesta',
  description: 'Annual fiesta',
  startDate: Timestamp.fromDate(new Date('2026-06-15T18:00:00Z')),
  endDate: null,
  location: { type: 'text', coordinates: null, text: 'Plaza' },
  imageURL: null,
  price: null,
  maxAttendees: 100,
  telephoneRequired: false,
  status: 'published',
  organizationId: 'org-1',
  organizationName: 'Asociación X',
  createdBy: 'user-1',
  createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  updatedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  municipalityId: 'm-1',
  municipalityName: 'Villa',
  municipalityCoverImage: null,
  municipalityCoordinates: new GeoPoint(40.4, -3.7),
};

describe('eventConverterClient', () => {
  it('fromFirestore returns typed EventData with Date and {lat,lng}', () => {
    const snap = { data: () => baseFirestoreShape };
    const event = eventConverterClient.fromFirestore(snap);
    expect(event.startDate).toBeInstanceOf(Date);
    expect(event.municipalityCoordinates).toEqual({ lat: 40.4, lng: -3.7 });
    expect(event.status).toBe('published');
  });

  it('toFirestore returns Firestore-shaped data with Timestamp and GeoPoint', () => {
    const event = eventConverterClient.fromFirestore({ data: () => baseFirestoreShape });
    const out = eventConverterClient.toFirestore(event) as Record<string, unknown>;
    expect(out.startDate).toBeInstanceOf(Timestamp);
    expect(out.municipalityCoordinates).toBeInstanceOf(GeoPoint);
  });

  it('fromFirestore throws when a required field is missing', () => {
    const { title: _t, ...rest } = baseFirestoreShape;
    expect(() => eventConverterClient.fromFirestore({ data: () => rest })).toThrow();
  });
});
```

- [ ] **Step 2: Run, verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/eventConverter.test.ts
```

- [ ] **Step 3: Implement `eventConverter.ts`**

```ts
// packages/shared/src/firebase/converters/eventConverter.ts
import { EventDataSchema } from '../../models/event/EventDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const eventConverterClient = makeConverter(EventDataSchema, clientSdkCtors);
export const eventConverterAdmin = makeConverter(EventDataSchema, adminSdkCtors);
```

- [ ] **Step 4: Implement `registrationConverter.ts`**

```ts
// packages/shared/src/firebase/converters/registrationConverter.ts
import { RegistrationDataSchema } from '../../models/event/RegistrationDataModel';
import { makeConverter } from './makeConverter';
import { clientSdkCtors } from './sdkAdapters.client';
import { adminSdkCtors } from './sdkAdapters.admin';

export const registrationConverterClient = makeConverter(RegistrationDataSchema, clientSdkCtors);
export const registrationConverterAdmin = makeConverter(RegistrationDataSchema, adminSdkCtors);
```

- [ ] **Step 5: Run tests, verify pass**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/firebase/converters/eventConverter.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/firebase/converters/eventConverter.ts packages/shared/src/firebase/converters/registrationConverter.ts packages/shared/test/firebase/converters/eventConverter.test.ts
git -c commit.gpgsign=false commit -m "feat(firebase): eventConverter + registrationConverter (client + admin)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Add event + registration ref factories

**Files:**
- Modify: `packages/shared/src/firebase/refs/client.ts`
- Modify: `packages/shared/src/firebase/refs/admin.ts`

- [ ] **Step 1: Update client refs**

```ts
// packages/shared/src/firebase/refs/client.ts
import { collection, doc, type Firestore } from 'firebase/firestore';
import { eventConverterClient } from '../converters/eventConverter';
import { registrationConverterClient } from '../converters/registrationConverter';

export const eventsCollection = (db: Firestore) =>
  collection(db, 'events').withConverter(eventConverterClient);

export const eventDoc = (db: Firestore, eventId: string) =>
  doc(db, 'events', eventId).withConverter(eventConverterClient);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  collection(db, 'events', eventId, 'registrations').withConverter(registrationConverterClient);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  doc(db, 'events', eventId, 'registrations', registrationId).withConverter(registrationConverterClient);
```

- [ ] **Step 2: Update admin refs**

```ts
// packages/shared/src/firebase/refs/admin.ts
import type { Firestore } from 'firebase-admin/firestore';
import { eventConverterAdmin } from '../converters/eventConverter';
import { registrationConverterAdmin } from '../converters/registrationConverter';

export const eventsCollection = (db: Firestore) =>
  db.collection('events').withConverter(eventConverterAdmin);

export const eventDoc = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).withConverter(eventConverterAdmin);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).collection('registrations').withConverter(registrationConverterAdmin);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  db.collection('events').doc(eventId).collection('registrations').doc(registrationId).withConverter(registrationConverterAdmin);
```

- [ ] **Step 3: Typecheck and build**

```bash
pnpm --filter @cultuvilla/shared typecheck
pnpm --filter @cultuvilla/shared build
```

Expected: passes (dist now contains populated `refs/client.js` and `refs/admin.js`).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/firebase/refs/client.ts packages/shared/src/firebase/refs/admin.ts
git -c commit.gpgsign=false commit -m "feat(firebase): event + registration ref factories (client + admin)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Migrate `eventService.ts`

**Files:**
- Modify: `packages/shared/src/services/eventService.ts`
- Modify: `packages/shared/test/services/eventService.test.ts` (if it exists; or add one)

- [ ] **Step 1: Identify all callers of `mapEventDoc`**

```bash
grep -rn "mapEventDoc\|eventsCol\|collection(.*'events'" packages/shared/src/ packages/shared/test/ apps/mobile/
```

Note every caller — they'll need their types updated when `snap.data()` becomes typed.

- [ ] **Step 2: Rewrite `eventService.ts`**

Goal: delete `eventsCol()` and `mapEventDoc()` entirely; rewrite each exported function to use the new ref factories.

```ts
// packages/shared/src/services/eventService.ts
import {
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  getCountFromServer,
} from 'firebase/firestore';
import { eventsCollection, eventDoc } from '../firebase/refs/client';
import { getDb } from '../firebase';
import type { EventData, EventStatus } from '../models/event/EventDataModel';
// ...rewrite each existing exported function. Pattern:
// before: const snap = await getDoc(doc(eventsCol(), eventId));
//         if (!snap.exists()) return null;
//         return mapEventDoc(snap);
// after:  const snap = await getDoc(eventDoc(getDb(), eventId));
//         return snap.exists() ? { id: snap.id, ...snap.data() } : null;
```

For each function in the file: keep the function name, parameter list, and return type stable; rewrite the body to use `eventsCollection(getDb())` and `eventDoc(getDb(), id)` and let `snap.data()` carry the type.

Writes: any `setDoc(ref, payload)` where `payload` previously included `serverTimestamp()` must now use a plain `new Date()`. Any `updateDoc(ref, patch)` is unchanged (Firestore doesn't invoke `toFirestore` on `updateDoc`).

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @cultuvilla/shared typecheck
```

Expected: clean. Any errors at consumers (mobile app code importing from this service) are out of scope here — fix them in Task 14 or in the mobile-side migration commits.

- [ ] **Step 4: Run shared unit tests**

```bash
pnpm --filter @cultuvilla/shared test
```

Expected: previously passing tests still pass. If any test relied on `mapEventDoc`, update it to call `snap.data()` directly or refactor it to use the new shape.

- [ ] **Step 5: Run lint on the touched files**

```bash
pnpm --filter @cultuvilla/shared lint
```

Note: `services/` is not in the lint scope yet (Phase 1 was scoped to `firebase/` + `models/`). Add `src/services/eventService.ts` to the `files` glob in `packages/shared/eslint.config.mjs` if you want lint coverage in this commit; otherwise lint coverage arrives in Phase 4.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/eventService.ts
git -c commit.gpgsign=false commit -m "refactor(services): eventService uses typed refs and converter

Deletes the hand-rolled mapEventDoc; snap.data() now returns typed EventData
via withConverter. All reads validate against EventDataSchema; writes are
validated before send.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Migrate `registrationService.ts`

Same pattern as Task 11, applied to `registrationService.ts`. Use `eventRegistrationsCollection(getDb(), eventId)` and `eventRegistrationDoc(getDb(), eventId, registrationId)`.

**Files:**
- Modify: `packages/shared/src/services/registrationService.ts`

- [ ] **Step 1: Read current `registrationService.ts`**

```bash
cat packages/shared/src/services/registrationService.ts
```

- [ ] **Step 2: Rewrite each exported function to use the new refs**

Same recipe: delete any local `registrationsCol(eventId)` helper; delete `mapRegistrationDoc` (if it exists); each read becomes `snap.data()` returning typed `RegistrationData`; each write becomes a plain typed object.

- [ ] **Step 3: Typecheck + tests + commit**

```bash
pnpm --filter @cultuvilla/shared typecheck
pnpm --filter @cultuvilla/shared test
git add packages/shared/src/services/registrationService.ts
git -c commit.gpgsign=false commit -m "refactor(services): registrationService uses typed refs and converter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Migrate event-touching Cloud Functions

The functions/ files that read or write events or registrations:
- `functions/src/registerToEvent.ts` (if it exists)
- `functions/src/syncVillageDenormalization.ts`
- `functions/src/waitlistPromotion.ts`
- any other in `functions/src/` that touches `events` / `registrations` (grep below)

**Files:**
- Modify: each functions/ file that touches `events` or `registrations`

- [ ] **Step 1: Enumerate target files**

```bash
grep -rln "'events'\|/events/\|registrations" functions/src/ | grep -v __tests__
```

- [ ] **Step 2: For each file, replace raw admin SDK access**

Before (typical pattern):

```ts
import * as admin from 'firebase-admin';
const db = admin.firestore();
const snap = await db.collection('events').doc(eventId).get();
const data = snap.data() as Record<string, unknown>;
```

After:

```ts
import { getFirestore } from 'firebase-admin/firestore';
import { eventDoc, eventRegistrationsCollection } from '@cultuvilla/shared/firebase/refs/admin';
const db = getFirestore();
const snap = await eventDoc(db, eventId).get();
if (!snap.exists) return;
const event = snap.data();  // typed EventData
```

- [ ] **Step 3: Typecheck functions/**

```bash
pnpm --filter @cultuvilla/functions typecheck
```

- [ ] **Step 4: Add the touched functions to the functions/ ESLint scope**

In `functions/eslint.config.mjs`, replace `files: ['src/__never__']` with an explicit list of files touched in this and subsequent commits:

```js
files: [
  'src/syncVillageDenormalization.ts',
  // add more files here as future commits migrate them
],
```

Run lint:

```bash
pnpm --filter @cultuvilla/functions lint
```

Expected: clean.

- [ ] **Step 5: Run functions integration tests**

```bash
pnpm test:functions
```

Expected: previously passing tests still pass. Fix any breakage caused by the shape change (e.g. tests that seeded a doc with the old shape may need to be updated to the new `{lat, lng}` shape).

- [ ] **Step 6: Commit**

```bash
git add functions/src/ functions/eslint.config.mjs
git -c commit.gpgsign=false commit -m "refactor(functions): event-touching handlers use typed admin refs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Fix mobile-side consumers of `GeoPoint`-typed `LocationData`

Any UI code in `apps/mobile/` that constructed `new GeoPoint(...)` to pass into an event service input now needs to pass `{lat, lng}` instead.

**Files:**
- Modify: each consumer in `apps/mobile/` that builds `EventData` inputs

- [ ] **Step 1: Find all callers**

```bash
grep -rn "new GeoPoint\|GeoPoint(" apps/mobile/
```

- [ ] **Step 2: For each call site, replace `new GeoPoint(lat, lng)` with `{ lat, lng }`**

The receiver (now the typed service signature) expects `LatLng` (`{lat, lng}`). The callers were previously also passing `GeoPoint` — both shapes coexisted ambiguously. Now there is exactly one accepted shape.

- [ ] **Step 3: Run mobile typecheck**

```bash
pnpm --filter @cultuvilla/mobile typecheck
```

Expected: clean (or surfaced bugs to fix — those are real).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/
git -c commit.gpgsign=false commit -m "refactor(mobile): replace GeoPoint instances with {lat, lng}

The persistence layer no longer accepts GeoPoint; the converter wraps the
GeoPoint at the Firestore boundary. Mobile code now constructs plain
{lat, lng} objects when calling event service inputs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Full check on the event domain

- [ ] **Step 1: Run the full repo check**

```bash
pnpm check
```

Expected: typecheck + lint + tests + build all pass. The event domain is fully migrated; the next phase rolls out the same pattern to the remaining 10 domains.

If anything fails, fix and re-run before moving on. Each fix is its own focused commit.

---

## Phase 3 — Roll out remaining domains

Each remaining domain follows the **Phase 2 pattern**, condensed here because the recipe is identical. For each domain task below, walk through the same sub-steps as Task 6–15:

1. Rewrite the `*DataModel.ts` files to schema-first (test + commit).
2. Create the `*Converter.ts` (test + commit).
3. Add ref factories to `refs/client.ts` and `refs/admin.ts` (commit).
4. Migrate the service in `packages/shared/src/services/` (commit).
5. Migrate any functions/ files that touch the domain (commit).
6. Fix any mobile-side `GeoPoint` / shape consumers (commit).
7. Run `pnpm check` before moving to the next domain.

The schemas mirror the existing TS interfaces exactly. The converter file is one-to-one. The ref factories follow the pattern: top-level collections take `(db)`; subcollections take `(db, parentId)`.

### Task 16: Municipality domain (+ members, inviteTokens, barrios, cemeteries, joinRequests)

**Models touched:** `models/municipality/MunicipalityDataModel.ts` (and any sibling model files for members/inviteTokens/barrios/cemeteries/joinRequests in the same dir).

**Refs to add:**
- `municipalitiesCollection(db)`, `municipalityDoc(db, id)`
- `municipalityMembersCollection(db, municipalityId)`, `municipalityMemberDoc(db, municipalityId, memberId)`
- `municipalityInviteTokensCollection(db, municipalityId)`, `municipalityInviteTokenDoc(db, municipalityId, tokenId)`
- `municipalityBarriosCollection(db, municipalityId)`, `municipalityBarrioDoc(db, municipalityId, barrioId)`
- `municipalityCemeteriesCollection(db, municipalityId)`, `municipalityCemeteryDoc(db, municipalityId, cemeteryId)`
- `municipalityJoinRequestsCollection(db, municipalityId)`, `municipalityJoinRequestDoc(db, municipalityId, requestId)`

**Services touched:** `municipalityService.ts`, `orgMemberService.ts` (verify whether it owns municipality members or organization members — they're different collections), `inviteTokenService.ts`, `joinRequestService.ts`, `censoService.ts` (touches barrios/cemeteries).

**Functions touched:** grep `functions/src/` for `'municipalities'` and `'joinRequests'`.

Steps 1–6 mirror Phase 2 exactly.

- [ ] Complete municipality model + member + inviteToken + barrio + cemetery + joinRequest schemas and tests.
- [ ] Implement converters for all six.
- [ ] Add all 12 ref factories (top-level + 5 subcollection pairs).
- [ ] Migrate `municipalityService.ts`.
- [ ] Migrate `inviteTokenService.ts`, `joinRequestService.ts`, `censoService.ts`.
- [ ] Migrate functions/ files touching municipalities/joinRequests.
- [ ] Fix mobile consumers.
- [ ] `pnpm check` passes; commit each step.

### Task 17: Organization domain (+ members)

**Models touched:** `models/organization/OrganizationDataModel.ts`, `models/organization/OrgMemberDataModel.ts`.

**Refs:** `organizationsCollection(db)`, `organizationDoc(db, id)`, `organizationMembersCollection(db, orgId)`, `organizationMemberDoc(db, orgId, memberId)`.

**Services:** `organizationService.ts`, `orgMemberService.ts`.

**Functions:** grep for `'organizations'`.

- [ ] Complete the same six sub-steps.

### Task 18: OrganizerRequest domain

**Models:** `models/organization/OrganizerRequestDataModel.ts` (or wherever it lives — verify).

**Refs:** `organizerRequestsCollection(db)`, `organizerRequestDoc(db, id)`.

**Services:** `organizerRequestService.ts`.

**Functions:** `functions/src/respondToOrganizerRequest.ts`, `functions/src/requestOrganizeVillage.ts`.

- [ ] Complete the same six sub-steps.

### Task 19: Person domain

**Models:** `models/person/PersonDataModel.ts`.

**Refs:** `personsCollection(db)`, `personDoc(db, id)`.

**Services:** `personService.ts`, `membershipProfileService.ts` (verify whether profiles are persisted separately or are persons).

**Functions:** grep for `'persons'`.

- [ ] Complete the same six sub-steps.

### Task 20: User domain (+ notifications subcollection)

**Models:** `models/user/UserDataModel.ts`, `models/notification/NotificationDataModel.ts`.

**Refs:** `usersCollection(db)`, `userDoc(db, id)`, `userNotificationsCollection(db, userId)`, `userNotificationDoc(db, userId, notificationId)`.

**Services:** `userService.ts`, `notificationService.ts`.

**Functions:** `functions/src/notificationTriggers.ts`, anything in `functions/src/news/*` that fans out notifications.

- [ ] Complete the same six sub-steps.

### Task 21: News domain (posts, comments, reactions, reports)

**Models:** `models/news/NewsPostDataModel.ts`, `models/news/NewsCommentDataModel.ts`, `models/news/NewsReactionDataModel.ts`, `models/news/NewsReportDataModel.ts`.

**Refs:** four pairs — `newsCollection / newsDoc`, `newsCommentsCollection / newsCommentDoc`, `newsReactionsCollection / newsReactionDoc`, `newsReportsCollection / newsReportDoc`.

(Note: based on the inventory, `newsComments`, `newsReactions`, `newsReports` are **top-level** collections, not subcollections of `news`. The ref factories take `(db)` only.)

**Services:** `newsService.ts`, `feedService.ts` (verify; may also touch news).

**Functions:** everything under `functions/src/news/`.

- [ ] Complete the same six sub-steps.

### Task 22: Occupation domain (+ proposals)

**Models:** `models/occupation/OccupationDataModel.ts`, `models/occupation/OccupationProposalDataModel.ts`.

**Refs:** `occupationsCollection(db)`, `occupationDoc(db, id)`, `occupationProposalsCollection(db)`, `occupationProposalDoc(db, id)`.

**Services:** `occupationService.ts`.

**Functions:** `functions/src/onOccupationProposalApproved.ts`.

- [ ] Complete the same six sub-steps.

---

## Phase 4 — Whole-workspace ESLint enforcement

After all domains are migrated, the lint config is no longer path-scoped.

### Task 23: Flip ESLint configs to whole-workspace

**Files:**
- Modify: `packages/shared/eslint.config.mjs`
- Modify: `functions/eslint.config.mjs`

- [ ] **Step 1: Update `packages/shared/eslint.config.mjs`**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['test/mocks/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',  // mock implementations legitimately fake SDK shapes
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
```

- [ ] **Step 2: Update `functions/eslint.config.mjs`**

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/__tests__/**/*.ts'],
    rules: {
      // Tests are stricter than production code in this codebase. No carve-out
      // unless a specific need arises.
    },
  },
  {
    ignores: ['lib/**', 'node_modules/**'],
  },
);
```

- [ ] **Step 3: Run lint on both workspaces, see what surfaces**

```bash
pnpm --filter @cultuvilla/shared lint 2>&1 | tee /tmp/shared-lint.log
pnpm --filter @cultuvilla/functions lint 2>&1 | tee /tmp/functions-lint.log
```

Expected: failures in code that wasn't touched by the migration (utility files, helpers, older code). Each failure is a real opportunity to tighten types.

- [ ] **Step 4: Commit the config flip (failures expected)**

```bash
git add packages/shared/eslint.config.mjs functions/eslint.config.mjs
git -c commit.gpgsign=false commit -m "chore(lint): widen ESLint type-aware rules to entire workspaces

Surfaces remaining no-unsafe-* / no-explicit-any violations outside the
migrated paths. Fixed in the follow-up commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 24: Fix newly surfaced lint violations

- [ ] **Step 1: Walk the violations one file at a time**

For each file with violations:
1. Read the file.
2. Replace `any` with the actual type (often inferable from context).
3. Replace unsafe member access with typed access (introduce a local schema or a typed helper if needed).
4. Re-run lint on that file: `pnpm --filter @cultuvilla/shared exec eslint <file>`.

- [ ] **Step 2: Commit per logical group**

Group fixes by responsibility (e.g. one commit for `utils/`, one for `factories/`, one for `helpers/`). Each commit ends with `pnpm --filter <workspace> lint` passing.

- [ ] **Step 3: Run the full repo check**

```bash
pnpm check
```

Expected: passes.

---

## Phase 5 — Cleanup audit

### Task 25: Acceptance-criteria grep audit

- [ ] **Step 1: No raw collection access in services**

```bash
grep -rn "collection(getDb()" packages/shared/src/services/
```

Expected: zero hits.

- [ ] **Step 2: No raw collection access in functions**

```bash
grep -rn "\.collection('[a-z]" functions/src/ | grep -v "firebase/refs/admin"
```

Expected: zero hits.

- [ ] **Step 3: No `map*Doc` helpers left**

```bash
grep -rn "map[A-Z][a-zA-Z]*Doc" packages/shared/src/services/
```

Expected: zero hits.

- [ ] **Step 4: GeoPoint usage only in converters/refs/sdkAdapters**

```bash
grep -rn "GeoPoint" packages/shared/src/ functions/src/
```

Expected: hits only in `firebase/converters/sdkAdapters.*.ts` and `firebase/refs/*.ts`.

- [ ] **Step 5: Lint passes everywhere**

```bash
pnpm --filter @cultuvilla/shared lint
pnpm --filter @cultuvilla/functions lint
```

Expected: both pass at `--max-warnings 0`.

- [ ] **Step 6: Full repo check**

```bash
pnpm check
```

Expected: passes.

### Task 26: Manual smoke test on dev

- [ ] **Step 1: Start the mobile app pointed at dev Firestore**

Use the `drive-android-avd` skill or `pnpm app:dev` (whatever the project's normal dev-run is).

- [ ] **Step 2: Exercise at least one read and one write per migrated collection**

Per the acceptance criteria in the spec:
- Create an event (`events` collection write)
- View the event in the feed (`events` collection read)
- Register for an event (`events/{id}/registrations` write)
- View notifications (`users/{id}/notifications` read)
- ...etc, one per collection

- [ ] **Step 3: Check the device logs for any thrown `ZodError`**

A thrown ZodError on a read indicates a schema/reality mismatch: the seed data has drift, or the schema is wrong. Fix the schema or fix the seed; do NOT loosen the strict-parse contract.

- [ ] **Step 4: Final commit if any fixes**

If smoke testing surfaced schema or seed fixes, commit them with a descriptive message.

- [ ] **Step 5: Tag the worktree's final state for merge**

```bash
git log --oneline main..HEAD
```

Confirm the commit chain is clean and reviewable. Merge to `main` via fast-forward (or the project's standard merge style):

```bash
git checkout main
git merge --ff-only worktree-firestore-typed-converters
git push origin main
```

(Per project memory, direct push to main is the standard workflow; no PR is required.)

---

## Self-review notes

- **Spec coverage:** every numbered decision in the spec maps to a task. Decisions 1–5 (schema-first, SDK normalization, strict, schema-in-model, write validation) are realized in Phase 1 (Tasks 1–3) and Phase 2 (Tasks 6–9). Decision 6 (subpath exports) is Task 4. Decision 7 (one PR, several commits) is the worktree convention this plan operates in. Decisions 8–9 (no audit, defer typed fixtures) are documented exclusions, not tasks.
- **Acceptance criteria from the spec:** mapped 1:1 to Task 25 sub-steps.
- **Inventory completeness:** the spec lists 12 top-level + 8 subcollections. Phase 3 tasks 16–22 cover all of them. The event domain (Phase 2) covers `events` + `events/{id}/registrations`. Phase 3 covers the remaining 11 top-level + 7 subcollections.
- **Build verification:** every commit ends with either a focused test run, `pnpm check`, or `pnpm --filter ... typecheck/lint/test`. Phase boundaries (Task 15, Task 24, Task 25) require full `pnpm check`.
