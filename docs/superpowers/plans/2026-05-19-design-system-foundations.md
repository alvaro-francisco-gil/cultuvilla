# Design System Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the design tokens, web primitives, hoisted i18n catalog, and locale formatting helpers that both `apps/web` and the future `apps/mobile` will consume — so that no later screen ships hard-coded `padding: 14` or duplicated date-formatting code.

**Architecture:** Tokens live in `packages/shared/src/design-system/` as platform-agnostic TypeScript objects. `apps/web` adds a JS-based `tailwind.config.ts` that imports those tokens and extends Tailwind's theme. Web primitives (`Screen`, `HStack`, `VStack`, `Text`, `Pressable`, `Button`, `Card`, `Input`) live under `apps/web/components/primitives/` and compose tokens via Tailwind classes. i18n message catalogs move to `packages/i18n/` and are loaded by next-intl through a thin loader. Locale formatting helpers (`formatDate`, `formatPrice`, `formatRelativeTime`) live in `packages/shared/src/utils/format.ts`, preset to `es-ES`.

**Tech Stack:** TypeScript 5.8, Tailwind v4 (with JS-based `tailwind.config.ts`), Next.js 15, next-intl, vitest, @testing-library/react, jsdom, pnpm workspaces.

**Scope boundary:** This plan does NOT migrate existing `apps/web` screens to the new primitives. Existing screens keep their inline Tailwind classes for now; primitives are mandatory only for NEW code (with a follow-up cleanup pass later). The plan also does NOT scaffold `apps/mobile/` — that's a separate plan; this one establishes the foundation it will build on. Asset registry is also deferred to the mobile plan (web's `public/` directory doesn't benefit from a typed registry).

---

## Pre-flight (one-time, executor reads this before Task 1)

The executor MUST work in an isolated worktree. Use `superpowers:using-git-worktrees` (the native `EnterWorktree` tool, if available) to create one named `design-system-foundations` branched off `feat/villa-events-v2` (the active development branch, not `main`).

Verify baseline:

```bash
pnpm install
pnpm shared:test                 # expected: ~153 tests passing
pnpm --prefix functions test     # expected: 30 tests passing
NEXT_PUBLIC_APP_ENV=dev \
  NEXT_PUBLIC_FIREBASE_API_KEY_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV=0 \
  NEXT_PUBLIC_FIREBASE_APP_ID_DEV=ci-placeholder \
  pnpm check                     # expected: exit 0
```

If any of those fail before you change a single file, stop and ask the user — don't try to "fix" a pre-existing failure within this plan.

Conventional commit prefixes (the repo enforces commitlint): `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `ci`. Header ≤ 100 chars.

---

## Phase 0: Test infra for web primitives

The web app currently has no test runner — `apps/web` only gets lint/typecheck/build. Phase 3 primitives need a place to put render tests, so we add vitest + jsdom + @testing-library/react first.

### Task 0.1: Add vitest devDeps to `apps/web`

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Read current state**

```bash
cat apps/web/package.json
```

Note the current `scripts` and `devDependencies`. The script for typecheck is `"typecheck": "tsc --noEmit"` and there is currently no `test` script.

- [ ] **Step 2: Add devDeps and the test script**

Edit `apps/web/package.json`. Add to `devDependencies` (alphabetical):

```json
"@testing-library/dom": "^10.4.0",
"@testing-library/jest-dom": "^6.6.3",
"@testing-library/react": "^16.1.0",
"@vitejs/plugin-react": "^4.4.1",
"jsdom": "^26.0.0",
"vitest": "^4.0.15"
```

Add to `scripts` (place between `lint` and `typecheck` so it stays grouped):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Install**

```bash
pnpm install
```

Expected: pnpm resolves successfully, no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add vitest + testing-library devDeps for component tests"
```

### Task 0.2: Add vitest config + test setup

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/test/setup.ts`

- [ ] **Step 1: Create vitest config**

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 2: Create test setup**

`apps/web/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Verify vitest boots (no tests yet, but config loads)**

```bash
pnpm --filter cultuvilla-web test
```

Expected: vitest runs, reports "No test files found" or similar (non-zero exit because no tests yet — that's fine, we'll wire it once we have one).

- [ ] **Step 4: Smoke test with a trivial test**

Create `apps/web/lib/sanity.test.ts` temporarily:

```ts
import { describe, expect, it } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

```bash
pnpm --filter cultuvilla-web test
```

Expected: 1 test passes.

- [ ] **Step 6: Delete the sanity test**

```bash
rm apps/web/lib/sanity.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/test/setup.ts
git commit -m "test(web): add vitest + jsdom + testing-library setup"
```

### Task 0.3: Wire `pnpm web:test` and include it in root `pnpm test`

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add `web:test` root script**

In root `package.json`, add to `scripts` (insert after `shared:test`):

```json
"web:test": "pnpm --filter cultuvilla-web test",
```

And change the root `test` script to include it. Current value:

```json
"test": "pnpm shared:test && pnpm functions:test",
```

Change to:

```json
"test": "pnpm shared:test && pnpm web:test && pnpm functions:test",
```

- [ ] **Step 2: Verify root test runs all three**

```bash
pnpm test
```

Expected: shared tests run, web tests run (still no tests, exits 1 with "No test files found"). At this point root `test` exits 1 because web has no tests yet — that's OK, we'll add one in Phase 1.

If web's "no tests" exit-1 blocks the chain, temporarily set `passWithNoTests` in `apps/web/vitest.config.ts`:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./test/setup.ts'],
  passWithNoTests: true,  // remove once Phase 1 adds the first test
  include: ['components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
},
```

- [ ] **Step 3: Re-run root test**

```bash
pnpm test
```

Expected: shared, web (0 tests with passWithNoTests), functions — all pass; exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json apps/web/vitest.config.ts
git commit -m "chore(root): wire pnpm web:test into root test gate"
```

---

## Phase 1: Design system tokens

Tokens are plain TypeScript objects. They live in `packages/shared/src/design-system/tokens/`. Each token file has a test verifying values + types.

### Task 1.1: Spacing scale

**Files:**
- Create: `packages/shared/src/design-system/tokens/spacing.ts`
- Test: `packages/shared/test/design-system/spacing.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/spacing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { spacing, type SpacingKey } from '../../src/design-system/tokens/spacing';

// The spacing scale must match Tailwind's default numeric keys for the
// subset we actually use (4-based). This keeps `p-4` in JSX and
// `spacing[4]` in TypeScript pointing at the same pixel value.

describe('spacing tokens', () => {
  it('exposes a 4-based scale: 0, 1, 2, 3, 4, 6, 8, 12, 16', () => {
    expect(spacing).toEqual({
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      6: 24,
      8: 32,
      12: 48,
      16: 64,
    });
  });

  it('SpacingKey is the union of available keys', () => {
    const k: SpacingKey = 4;
    expect(spacing[k]).toBe(16);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/spacing.test.ts
```

Expected: FAIL — `Cannot find module '../../src/design-system/tokens/spacing'`.

- [ ] **Step 3: Create the spacing tokens file**

`packages/shared/src/design-system/tokens/spacing.ts`:

```ts
/**
 * Spacing scale (in px). 4-based, with the same numeric keys Tailwind uses
 * (1=4px, 2=8px, …), restricted to the subset we actually want. Use these
 * via Tailwind utilities (`p-4`, `gap-2`) in JSX, and via `spacing[N]` when
 * you need a raw pixel value (e.g. RN StyleSheet, computed inline styles).
 *
 * Do not extend this scale ad-hoc. If a screen really needs `5` or `7`,
 * that's a design conversation, not a token addition.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
  12: 48,
  16: 64,
} as const;

export type SpacingKey = keyof typeof spacing;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/spacing.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/spacing.ts packages/shared/test/design-system/spacing.test.ts
git commit -m "feat(shared): add spacing tokens (4-based scale)"
```

### Task 1.2: Typography scale

**Files:**
- Create: `packages/shared/src/design-system/tokens/typography.ts`
- Test: `packages/shared/test/design-system/typography.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/typography.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  typography,
  type TypographyVariant,
} from '../../src/design-system/tokens/typography';

describe('typography tokens', () => {
  it('defines exactly 7 variants', () => {
    expect(Object.keys(typography).sort()).toEqual(
      ['body', 'bodySm', 'caption', 'display', 'h1', 'h2', 'h3'].sort(),
    );
  });

  it('each variant carries fontSize + lineHeight + fontWeight', () => {
    for (const v of Object.values(typography)) {
      expect(typeof v.fontSize).toBe('number');
      expect(typeof v.lineHeight).toBe('number');
      expect(typeof v.fontWeight).toBe('string');
    }
  });

  it('headlines use a tighter line-height than body (~1.2 vs ~1.5)', () => {
    const h1Ratio = typography.h1.lineHeight / typography.h1.fontSize;
    const bodyRatio = typography.body.lineHeight / typography.body.fontSize;
    expect(h1Ratio).toBeLessThan(bodyRatio);
  });

  it('body is 16/24 — the read-baseline', () => {
    expect(typography.body.fontSize).toBe(16);
    expect(typography.body.lineHeight).toBe(24);
  });

  it('TypographyVariant is the keys of typography', () => {
    const v: TypographyVariant = 'body';
    expect(typography[v]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/typography.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the typography tokens file**

`packages/shared/src/design-system/tokens/typography.ts`:

```ts
/**
 * Type scale. Seven variants. Each carries a font-size, a line-height
 * (in px, not unitless ratio — RN doesn't accept ratios), and a default
 * font-weight that callers can override at the use site.
 *
 * Why explicit line-heights: tight ratios (~1.2) for headlines kill
 * vertical rhythm in body text, and loose ratios (~1.5) in headlines
 * make them feel slack. Pairing size + line-height per variant locks
 * the rhythm without per-screen tuning.
 */
export const typography = {
  display: { fontSize: 36, lineHeight: 40, fontWeight: '700' },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySm: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/typography.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/typography.ts packages/shared/test/design-system/typography.test.ts
git commit -m "feat(shared): add typography tokens (7-variant scale)"
```

### Task 1.3: Semantic color tokens (light mode)

**Files:**
- Create: `packages/shared/src/design-system/tokens/colors.ts`
- Test: `packages/shared/test/design-system/colors.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/colors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { colors, type ColorMode } from '../../src/design-system/tokens/colors';

describe('semantic color tokens', () => {
  it('has a light mode', () => {
    expect(colors.light).toBeDefined();
  });

  it('exposes bg, fg, and border groups (per Tailwind utility family)', () => {
    expect(Object.keys(colors.light).sort()).toEqual(['bg', 'border', 'fg']);
  });

  it('every color value is a 7-char hex string (#rrggbb)', () => {
    for (const group of Object.values(colors.light)) {
      for (const value of Object.values(group)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('fg.on-accent contrasts with bg.accent (sanity: different hex)', () => {
    expect(colors.light.fg['on-accent']).not.toBe(colors.light.bg.accent);
  });

  it('bg has the surface, accent, danger, success roles', () => {
    expect(colors.light.bg.surface).toBeDefined();
    expect(colors.light.bg.accent).toBeDefined();
    expect(colors.light.bg.danger).toBeDefined();
    expect(colors.light.bg.success).toBeDefined();
  });

  it('ColorMode union includes light (dark added later)', () => {
    const m: ColorMode = 'light';
    expect(colors[m]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/colors.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the colors tokens file**

`packages/shared/src/design-system/tokens/colors.ts`:

```ts
/**
 * Semantic color tokens, keyed by mode and by Tailwind utility family
 * (`bg`, `fg`, `border`). Light mode is the only shipped mode today —
 * `dark` will be added by mapping the same semantic keys to different
 * raw values, so screens never reach for raw colors and dark mode is a
 * switch, not a sweep.
 *
 * The `bg` / `fg` / `border` split mirrors the Tailwind utility families
 * we extend in `apps/web/tailwind.config.ts`: `bg.X` is what
 * `theme.extend.backgroundColor.X` consumes (producing `bg-X` classes),
 * `fg.X` produces `text-X`, `border.X` produces `border-X`. That keeps
 * class names crisp (`bg-surface`, `text-primary`) instead of
 * doubly-namespaced (`bg-surface`).
 *
 * Naming rule: tokens describe *intent* (surface, on-accent, muted),
 * not appearance (gray-100, slate-900). Never expose raw palette names
 * outside this file. Keys use kebab-case so they survive into Tailwind
 * class generation unchanged.
 */
const light = {
  bg: {
    surface: '#ffffff',
    'surface-elevated': '#f9fafb',
    subtle: '#f3f4f6',
    accent: '#2563eb',
    danger: '#dc2626',
    'danger-subtle': '#fef2f2',
    success: '#16a34a',
    'success-subtle': '#f0fdf4',
  },
  fg: {
    primary: '#0f172a',
    muted: '#64748b',
    'on-accent': '#ffffff',
    'on-danger': '#ffffff',
    'on-success': '#ffffff',
    accent: '#2563eb',
    danger: '#dc2626',
    success: '#16a34a',
  },
  border: {
    subtle: '#e5e7eb',
    strong: '#cbd5e1',
    accent: '#2563eb',
    danger: '#dc2626',
  },
} as const;

export const colors = { light } as const;

export type ColorMode = keyof typeof colors;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/colors.test.ts
```

Expected: PASS, 6 tests (light mode + bg/fg/border groups + hex shape + fg.on-accent ≠ bg.accent + bg roles + ColorMode union).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/colors.ts packages/shared/test/design-system/colors.test.ts
git commit -m "feat(shared): add semantic color tokens (light mode)"
```

### Task 1.4: Radii

**Files:**
- Create: `packages/shared/src/design-system/tokens/radii.ts`
- Test: `packages/shared/test/design-system/radii.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/radii.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { radii, type RadiusKey } from '../../src/design-system/tokens/radii';

describe('radii tokens', () => {
  it('exposes none, sm, md, lg, xl, full', () => {
    expect(radii).toEqual({
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    });
  });

  it('RadiusKey union accepts known keys', () => {
    const k: RadiusKey = 'md';
    expect(radii[k]).toBe(8);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/radii.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the radii tokens file**

`packages/shared/src/design-system/tokens/radii.ts`:

```ts
/**
 * Border-radius scale (in px). `full` is a sentinel that resolves to a
 * pill shape — Tailwind uses 9999, RN uses the same.
 */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof radii;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/radii.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/radii.ts packages/shared/test/design-system/radii.test.ts
git commit -m "feat(shared): add radii tokens"
```

### Task 1.5: Elevation

**Files:**
- Create: `packages/shared/src/design-system/tokens/elevation.ts`
- Test: `packages/shared/test/design-system/elevation.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/elevation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  elevation,
  type ElevationLevel,
} from '../../src/design-system/tokens/elevation';

describe('elevation tokens', () => {
  it('exposes none, sm, md', () => {
    expect(Object.keys(elevation).sort()).toEqual(['md', 'none', 'sm']);
  });

  it('each level carries a web boxShadow CSS string', () => {
    for (const e of Object.values(elevation)) {
      expect(typeof e.web).toBe('string');
    }
  });

  it('each level carries an rn descriptor (color/offset/opacity/radius/elevation)', () => {
    for (const e of Object.values(elevation)) {
      expect(typeof e.rn.shadowColor).toBe('string');
      expect(typeof e.rn.shadowOffset.width).toBe('number');
      expect(typeof e.rn.shadowOffset.height).toBe('number');
      expect(typeof e.rn.shadowOpacity).toBe('number');
      expect(typeof e.rn.shadowRadius).toBe('number');
      expect(typeof e.rn.elevation).toBe('number');
    }
  });

  it('none has the expected zero-cost descriptor on both platforms', () => {
    expect(elevation.none.web).toBe('none');
    expect(elevation.none.rn.elevation).toBe(0);
    expect(elevation.none.rn.shadowOpacity).toBe(0);
  });

  it('ElevationLevel accepts known keys', () => {
    const l: ElevationLevel = 'sm';
    expect(elevation[l]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/elevation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the elevation tokens file**

`packages/shared/src/design-system/tokens/elevation.ts`:

```ts
/**
 * Elevation/shadow tokens. Each level carries:
 *  - `web`: a CSS box-shadow value (consumed by Tailwind `boxShadow`).
 *  - `rn`: the React Native shadow shape (`shadowColor`, `shadowOffset`,
 *    `shadowOpacity`, `shadowRadius`, and Android's `elevation`).
 *
 * Three levels is deliberate. RN shadows are expensive to render; more
 * levels means more state to keep consistent across iOS/Android and more
 * temptation to invent ad-hoc "elevation 7" cases.
 */
export const elevation = {
  none: {
    web: 'none',
    rn: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
  sm: {
    web: '0 1px 2px rgba(0, 0, 0, 0.06)',
    rn: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  md: {
    web: '0 4px 6px rgba(0, 0, 0, 0.10)',
    rn: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
      elevation: 3,
    },
  },
} as const;

export type ElevationLevel = keyof typeof elevation;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/elevation.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/elevation.ts packages/shared/test/design-system/elevation.test.ts
git commit -m "feat(shared): add elevation tokens (web + rn dual-shape)"
```

### Task 1.6: Z-index

**Files:**
- Create: `packages/shared/src/design-system/tokens/zIndex.ts`
- Test: `packages/shared/test/design-system/zIndex.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/zIndex.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { zIndex, type ZIndexKey } from '../../src/design-system/tokens/zIndex';

describe('z-index tokens', () => {
  it('exposes the named layers in ascending order', () => {
    const entries = Object.entries(zIndex);
    const sorted = [...entries].sort(([, a], [, b]) => a - b);
    expect(entries).toEqual(sorted);
  });

  it('includes base, dropdown, sticky, sheet, modal, toast', () => {
    expect(Object.keys(zIndex).sort()).toEqual(
      ['base', 'dropdown', 'modal', 'sheet', 'sticky', 'toast'].sort(),
    );
  });

  it('toast sits on top', () => {
    const values = Object.values(zIndex);
    expect(zIndex.toast).toBe(Math.max(...values));
  });

  it('ZIndexKey accepts known keys', () => {
    const k: ZIndexKey = 'modal';
    expect(zIndex[k]).toBeGreaterThan(zIndex.sheet);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/zIndex.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the z-index tokens file**

`packages/shared/src/design-system/tokens/zIndex.ts`:

```ts
/**
 * Named z-index layers. Reach for a name, never a number. Modal sits
 * above sheet because a modal can open from inside a sheet; toast sits
 * above modal because a "saved" toast should show even with a confirm
 * dialog open.
 */
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  sheet: 300,
  modal: 400,
  toast: 500,
} as const;

export type ZIndexKey = keyof typeof zIndex;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/zIndex.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/zIndex.ts packages/shared/test/design-system/zIndex.test.ts
git commit -m "feat(shared): add z-index tokens (named layers)"
```

### Task 1.7: A11y constants (touch target, hit slop)

**Files:**
- Create: `packages/shared/src/design-system/tokens/a11y.ts`
- Test: `packages/shared/test/design-system/a11y.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/a11y.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { a11y } from '../../src/design-system/tokens/a11y';

describe('a11y tokens', () => {
  it('minimum touch target is 44 (Apple HIG / WCAG 2.5.5)', () => {
    expect(a11y.minTouchTarget).toBe(44);
  });

  it('default hit slop covers all four edges with the same value', () => {
    expect(a11y.defaultHitSlop).toEqual({
      top: 8,
      bottom: 8,
      left: 8,
      right: 8,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/a11y.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the a11y tokens file**

`packages/shared/src/design-system/tokens/a11y.ts`:

```ts
/**
 * Accessibility constants used by interactive primitives.
 *
 * `minTouchTarget` is 44 (Apple HIG, WCAG 2.5.5). The `<Pressable>`
 * primitive enforces this by guaranteeing 44 of padded hit area even
 * when the visible target is smaller (e.g. a 24px icon button).
 *
 * `defaultHitSlop` is an RN-shaped value (top/bottom/left/right) used
 * by RN's <Pressable>. On web it's translated to padding by the
 * `<Pressable>` wrapper.
 */
export const a11y = {
  minTouchTarget: 44,
  defaultHitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/a11y.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/tokens/a11y.ts packages/shared/test/design-system/a11y.test.ts
git commit -m "feat(shared): add a11y tokens (minTouchTarget, defaultHitSlop)"
```

### Task 1.8: Icon sizes

**Files:**
- Create: `packages/shared/src/design-system/icons.ts`
- Test: `packages/shared/test/design-system/icons.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/icons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { iconSizes, type IconSize } from '../../src/design-system/icons';

describe('icon sizes', () => {
  it('exposes sm/md/lg = 16/20/24', () => {
    expect(iconSizes).toEqual({ sm: 16, md: 20, lg: 24 });
  });

  it('IconSize union accepts known keys', () => {
    const s: IconSize = 'md';
    expect(iconSizes[s]).toBe(20);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/icons.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the icons file**

`packages/shared/src/design-system/icons.ts`:

```ts
/**
 * Icon size scale (in px). Use these with `lucide-react` (web) or
 * `lucide-react-native` (mobile): `<Calendar size={iconSizes.md} />`.
 * Three sizes keep visual rhythm tight; if a screen really needs a 32px
 * icon it's probably actually an illustration — wrap it in <Image>.
 */
export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

export type IconSize = keyof typeof iconSizes;
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/icons.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/design-system/icons.ts packages/shared/test/design-system/icons.test.ts
git commit -m "feat(shared): add icon size scale"
```

### Task 1.9: Design-system barrel + shared re-export

**Files:**
- Create: `packages/shared/src/design-system/tokens/index.ts`
- Create: `packages/shared/src/design-system/index.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/design-system/barrel.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/design-system/barrel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as ds from '../../src/design-system';

describe('design-system barrel', () => {
  it('re-exports spacing, typography, colors, radii, elevation, zIndex, a11y, iconSizes', () => {
    expect(ds.spacing).toBeDefined();
    expect(ds.typography).toBeDefined();
    expect(ds.colors).toBeDefined();
    expect(ds.radii).toBeDefined();
    expect(ds.elevation).toBeDefined();
    expect(ds.zIndex).toBeDefined();
    expect(ds.a11y).toBeDefined();
    expect(ds.iconSizes).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/barrel.test.ts
```

Expected: FAIL — barrel doesn't exist yet.

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/barrel.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create tokens barrel**

`packages/shared/src/design-system/tokens/index.ts`:

```ts
export { spacing, type SpacingKey } from './spacing';
export { typography, type TypographyVariant } from './typography';
export { colors, type ColorMode } from './colors';
export { radii, type RadiusKey } from './radii';
export { elevation, type ElevationLevel } from './elevation';
export { zIndex, type ZIndexKey } from './zIndex';
export { a11y } from './a11y';
```

- [ ] **Step 4: Create design-system barrel**

`packages/shared/src/design-system/index.ts`:

```ts
export * from './tokens';
export { iconSizes, type IconSize } from './icons';
```

- [ ] **Step 5: Re-export from the shared root index**

Read `packages/shared/src/index.ts`:

```bash
cat packages/shared/src/index.ts
```

Expected current content:

```ts
export * from './models';
export * from './services';
export * from './firebase';
export * from './utils';
export * from './config';
```

Add the design-system line. New content:

```ts
export * from './models';
export * from './services';
export * from './firebase';
export * from './utils';
export * from './config';
export * from './design-system';
```

- [ ] **Step 6: Run the barrel test**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/design-system/barrel.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 7: Verify nothing else broke**

```bash
pnpm shared:test
pnpm shared:typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/design-system/tokens/index.ts packages/shared/src/design-system/index.ts packages/shared/src/index.ts packages/shared/test/design-system/barrel.test.ts
git commit -m "feat(shared): add design-system barrel + re-export from shared root"
```

---

## Phase 2: Tailwind config that consumes tokens

The web app uses Tailwind v4 with CSS-based config (`@import 'tailwindcss'` in `globals.css`). We switch to a JS-based `tailwind.config.ts` so tokens can be imported from `@cultuvilla/shared`. Tailwind v4 supports both.

### Task 2.1: Add `tailwind.config.ts` that maps tokens onto Tailwind theme

**Files:**
- Create: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Create the config**

`apps/web/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
import {
  colors as semanticColors,
  elevation,
  iconSizes,
  radii,
  spacing as semanticSpacing,
  typography,
  zIndex,
} from '@cultuvilla/shared/design-system';

// Tailwind v4 reads this file in addition to the CSS-first config in
// `app/globals.css`. We extend the theme so tokens are reachable as
// utility classes (`bg-surface`, `text-primary`, `rounded-md`,
// `shadow-sm`, `z-modal`, `text-body`). Numeric spacing keys (`p-4`)
// keep matching Tailwind's defaults because our scale uses the same
// numeric keys for the same px values.
//
// Colors are split across `backgroundColor` / `textColor` / `borderColor`
// instead of a single `colors` block, so class names stay flat:
// `bg-surface` and `text-primary` instead of `bg-surface`.

function pxRecord<T extends Record<string, number>>(rec: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(rec) as Array<keyof T>) {
    out[k] = `${rec[k]}px`;
  }
  return out;
}

function stringRecord<T extends Record<string, number>>(rec: T): Record<keyof T, string> {
  const out = {} as Record<keyof T, string>;
  for (const k of Object.keys(rec) as Array<keyof T>) {
    out[k] = String(rec[k]);
  }
  return out;
}

const fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]> = {};
for (const [variant, t] of Object.entries(typography)) {
  fontSize[variant] = [
    `${t.fontSize}px`,
    { lineHeight: `${t.lineHeight}px`, fontWeight: t.fontWeight },
  ];
}

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      spacing: pxRecord(semanticSpacing),
      borderRadius: pxRecord(radii),
      fontSize,
      backgroundColor: semanticColors.light.bg,
      textColor: semanticColors.light.fg,
      borderColor: semanticColors.light.border,
      boxShadow: {
        none: elevation.none.web,
        sm: elevation.sm.web,
        md: elevation.md.web,
      },
      zIndex: stringRecord(zIndex),
    },
  },
};

// Re-export iconSizes for ergonomic consumers (some folks like to import
// from the Tailwind config; the canonical export is still the shared module).
export { iconSizes };
export default config;
```

- [ ] **Step 2: Verify the import path resolves**

```bash
pnpm web:typecheck
```

Expected: clean. If TypeScript complains about `@cultuvilla/shared/design-system`, double-check that Task 1.9 actually re-exported the design-system from `packages/shared/src/index.ts` (root barrel) and that the package's `dist/index.d.ts` was rebuilt — run `pnpm shared:build` and retry.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "feat(web): add tailwind.config.ts that consumes shared design tokens"
```

### Task 2.2: Verify tokens reachable as utility classes

**Files:**
- Test: `apps/web/lib/tailwind.test.ts`

- [ ] **Step 1: Write a smoke test that compiles a class with a semantic token**

`apps/web/lib/tailwind.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// This test doesn't compile Tailwind — it just verifies the design-system
// shim is reachable from the web workspace, which is the actual integration
// risk. Visual verification of the classes (`bg-surface`, `shadow-sm`) is
// done in the dev server.
import {
  colors,
  elevation,
  iconSizes,
} from '@cultuvilla/shared/design-system';

describe('design-system reachable from apps/web', () => {
  it('colors.light.bg.surface is white', () => {
    expect(colors.light.bg.surface).toBe('#ffffff');
  });

  it('colors.light.fg.primary is the dark text color', () => {
    expect(colors.light.fg.primary).toBe('#0f172a');
  });

  it('elevation.sm.web is a CSS shadow string', () => {
    expect(elevation.sm.web).toContain('rgba(0, 0, 0, 0.06)');
  });

  it('iconSizes.md is 20', () => {
    expect(iconSizes.md).toBe(20);
  });
});
```

- [ ] **Step 2: Run it**

```bash
pnpm --filter cultuvilla-web test
```

Expected: PASS, 3 tests.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/tailwind.test.ts
git commit -m "test(web): verify design-system tokens reachable from apps/web"
```

### Task 2.3: Remove `passWithNoTests` if it was set in Task 0.3

**Files:**
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1: Read current config**

```bash
cat apps/web/vitest.config.ts
```

- [ ] **Step 2: Remove `passWithNoTests: true` if present**

Delete the line `passWithNoTests: true,` from the `test` block. We now have real tests, so the flag is no longer needed and would hide future "all your tests got deleted" regressions.

- [ ] **Step 3: Verify**

```bash
pnpm --filter cultuvilla-web test
```

Expected: PASS, 3 tests (the ones from Task 2.2).

- [ ] **Step 4: Commit**

```bash
git add apps/web/vitest.config.ts
git commit -m "test(web): drop passWithNoTests now that real tests exist"
```

---

## Phase 3: Web primitives

All primitives go under `apps/web/components/primitives/`. They are tiny — typically <40 lines each. Each has a colocated test under the same directory.

### Task 3.1: `<Screen>`

**Files:**
- Create: `apps/web/components/primitives/Screen.tsx`
- Test: `apps/web/components/primitives/Screen.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/components/primitives/Screen.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Screen } from './Screen';

describe('<Screen>', () => {
  it('renders children', () => {
    render(<Screen>hello</Screen>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies the default surface background', () => {
    render(<Screen data-testid="root">x</Screen>);
    expect(screen.getByTestId('root').className).toMatch(/bg-surface/);
  });

  it('caps width to the mobile-first reading column', () => {
    render(<Screen data-testid="root">x</Screen>);
    expect(screen.getByTestId('root').className).toMatch(/max-w-lg/);
  });

  it('passes through className and merges, not replaces', () => {
    render(<Screen className="custom" data-testid="root">x</Screen>);
    const el = screen.getByTestId('root');
    expect(el.className).toMatch(/custom/);
    expect(el.className).toMatch(/bg-surface/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Screen.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Screen component**

`apps/web/components/primitives/Screen.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

interface ScreenProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// Page-level wrapper. Sets the surface background, the mobile-first reading
// column, and the bottom padding that keeps content clear of the floating
// BottomNav. Every route renders inside one of these.
export function Screen({ children, className = '', ...rest }: ScreenProps) {
  return (
    <div
      className={`bg-surface text-primary min-h-screen max-w-lg mx-auto pb-20 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

```bash
pnpm --filter cultuvilla-web test components/primitives/Screen.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/primitives/Screen.tsx apps/web/components/primitives/Screen.test.tsx
git commit -m "feat(web): add <Screen> primitive"
```

### Task 3.2: `<HStack>` and `<VStack>`

**Files:**
- Create: `apps/web/components/primitives/HStack.tsx`
- Create: `apps/web/components/primitives/VStack.tsx`
- Test: `apps/web/components/primitives/Stack.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/primitives/Stack.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HStack } from './HStack';
import { VStack } from './VStack';

describe('<HStack>', () => {
  it('renders children in a row', () => {
    render(<HStack data-testid="row">a</HStack>);
    expect(screen.getByTestId('row').className).toMatch(/flex-row/);
  });

  it('applies the spacing gap', () => {
    render(<HStack gap={2} data-testid="row">a</HStack>);
    expect(screen.getByTestId('row').className).toMatch(/gap-2/);
  });

  it('default gap is 2', () => {
    render(<HStack data-testid="row">a</HStack>);
    expect(screen.getByTestId('row').className).toMatch(/gap-2/);
  });

  it('aligns items via the align prop', () => {
    render(<HStack align="center" data-testid="row">a</HStack>);
    expect(screen.getByTestId('row').className).toMatch(/items-center/);
  });
});

describe('<VStack>', () => {
  it('renders children in a column', () => {
    render(<VStack data-testid="col">a</VStack>);
    expect(screen.getByTestId('col').className).toMatch(/flex-col/);
  });

  it('applies the spacing gap', () => {
    render(<VStack gap={4} data-testid="col">a</VStack>);
    expect(screen.getByTestId('col').className).toMatch(/gap-4/);
  });

  it('default gap is 3', () => {
    render(<VStack data-testid="col">a</VStack>);
    expect(screen.getByTestId('col').className).toMatch(/gap-3/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Stack.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create HStack**

`apps/web/components/primitives/HStack.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import type { SpacingKey } from '@cultuvilla/shared/design-system';

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';

interface HStackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  gap?: SpacingKey;
  align?: Align;
  justify?: Justify;
}

const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

// Horizontal stack. `gap` keys come from the spacing scale so callers
// never write `marginRight: 8` to space children.
export function HStack({
  children,
  gap = 2,
  align,
  justify,
  className = '',
  ...rest
}: HStackProps) {
  return (
    <div
      className={`flex flex-row gap-${gap} ${align ? ALIGN[align] : ''} ${
        justify ? JUSTIFY[justify] : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create VStack**

`apps/web/components/primitives/VStack.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';
import type { SpacingKey } from '@cultuvilla/shared/design-system';

type Align = 'start' | 'center' | 'end' | 'stretch';

interface VStackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  gap?: SpacingKey;
  align?: Align;
}

const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

// Vertical stack. Default `gap` is 3 (12px) — most form rows + card
// stacks land there.
export function VStack({
  children,
  gap = 3,
  align,
  className = '',
  ...rest
}: VStackProps) {
  return (
    <div
      className={`flex flex-col gap-${gap} ${align ? ALIGN[align] : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter cultuvilla-web test components/primitives/Stack.test.tsx
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/primitives/HStack.tsx apps/web/components/primitives/VStack.tsx apps/web/components/primitives/Stack.test.tsx
git commit -m "feat(web): add <HStack> and <VStack> primitives"
```

### Task 3.3: `<Text>`

**Files:**
- Create: `apps/web/components/primitives/Text.tsx`
- Test: `apps/web/components/primitives/Text.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/primitives/Text.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('<Text>', () => {
  it('renders the body variant by default', () => {
    render(<Text>hello</Text>);
    const el = screen.getByText('hello');
    expect(el.className).toMatch(/text-body/);
  });

  it('applies the variant class', () => {
    render(<Text variant="h1">title</Text>);
    expect(screen.getByText('title').className).toMatch(/text-h1/);
  });

  it('applies the muted tone class', () => {
    render(<Text tone="muted">muted</Text>);
    expect(screen.getByText('muted').className).toMatch(/text-muted/);
  });

  it('uses the right HTML tag for headings', () => {
    render(<Text variant="h2">h2</Text>);
    const el = screen.getByText('h2');
    expect(el.tagName).toBe('H2');
  });

  it('uses <span> for non-heading variants', () => {
    render(<Text>body</Text>);
    expect(screen.getByText('body').tagName).toBe('SPAN');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Text.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Text component**

`apps/web/components/primitives/Text.tsx`:

```tsx
import type { HTMLAttributes, ReactNode, JSX } from 'react';
import type { TypographyVariant } from '@cultuvilla/shared/design-system';

type Tone = 'primary' | 'muted' | 'onAccent' | 'danger' | 'success';

interface TextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: ReactNode;
  variant?: TypographyVariant;
  tone?: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  primary: 'text-primary',
  muted: 'text-muted',
  onAccent: 'text-on-accent',
  danger: 'text-danger',
  success: 'text-success',
};

const TAG: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  body: 'span',
  bodySm: 'span',
  caption: 'span',
};

// Typography primitive. Renders the right HTML element for its variant
// (so headings stay semantic), pulls size/weight/line-height from the
// type scale, and accepts a `tone` to switch semantic text color.
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  className = '',
  ...rest
}: TextProps) {
  const Tag = TAG[variant];
  return (
    <Tag
      className={`text-${variant} ${TONE_CLASS[tone]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter cultuvilla-web test components/primitives/Text.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/primitives/Text.tsx apps/web/components/primitives/Text.test.tsx
git commit -m "feat(web): add <Text> primitive (variant + tone, semantic HTML tag)"
```

### Task 3.4: `<Pressable>`

**Files:**
- Create: `apps/web/components/primitives/Pressable.tsx`
- Test: `apps/web/components/primitives/Pressable.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/primitives/Pressable.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pressable } from './Pressable';

describe('<Pressable>', () => {
  it('renders children inside a button by default', () => {
    render(<Pressable onPress={() => {}}>click</Pressable>);
    const el = screen.getByText('click');
    expect(el.tagName).toBe('BUTTON');
  });

  it('calls onPress when clicked', () => {
    const onPress = vi.fn();
    render(<Pressable onPress={onPress}>click</Pressable>);
    fireEvent.click(screen.getByText('click'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = vi.fn();
    render(<Pressable onPress={onPress} disabled>click</Pressable>);
    fireEvent.click(screen.getByText('click'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes a minimum 44px touch target via padding when smaller content is inside', () => {
    render(<Pressable onPress={() => {}} data-testid="p">x</Pressable>);
    expect(screen.getByTestId('p').className).toMatch(/min-h-\[44px\]/);
    expect(screen.getByTestId('p').className).toMatch(/min-w-\[44px\]/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Pressable.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Pressable component**

`apps/web/components/primitives/Pressable.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PressableProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: ReactNode;
  onPress: () => void;
}

// Interactive wrapper. `onPress` keeps the API aligned with React Native
// (where there is no `onClick`); a `<Pressable>` written today reads the
// same way when ported to mobile. Enforces the 44px touch target by
// applying min-w/min-h so even icon-only buttons stay tappable.
export function Pressable({
  children,
  onPress,
  className = '',
  disabled,
  type,
  ...rest
}: PressableProps) {
  return (
    <button
      type={type ?? 'button'}
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter cultuvilla-web test components/primitives/Pressable.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/primitives/Pressable.tsx apps/web/components/primitives/Pressable.test.tsx
git commit -m "feat(web): add <Pressable> primitive (44px touch target, onPress)"
```

### Task 3.5: `<Button>`

**Files:**
- Create: `apps/web/components/primitives/Button.tsx`
- Test: `apps/web/components/primitives/Button.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/primitives/Button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('<Button>', () => {
  it('renders the label', () => {
    render(<Button onPress={() => {}}>Save</Button>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('fires onPress on click', () => {
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);
    fireEvent.click(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant by default', () => {
    render(<Button onPress={() => {}} data-testid="b">x</Button>);
    expect(screen.getByTestId('b').className).toMatch(/bg-accent/);
  });

  it('applies secondary variant class', () => {
    render(
      <Button variant="secondary" onPress={() => {}} data-testid="b">x</Button>,
    );
    expect(screen.getByTestId('b').className).toMatch(/bg-subtle/);
  });

  it('applies ghost variant class', () => {
    render(
      <Button variant="ghost" onPress={() => {}} data-testid="b">x</Button>,
    );
    expect(screen.getByTestId('b').className).toMatch(/bg-transparent/);
  });

  it('renders a loading indicator when loading', () => {
    render(
      <Button onPress={() => {}} loading data-testid="b">Save</Button>,
    );
    // The label is replaced with a "…" while loading; the button is
    // also disabled to prevent double-submits.
    expect(screen.getByTestId('b').textContent).toBe('…');
    expect(screen.getByTestId('b')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Button.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Button component**

`apps/web/components/primitives/Button.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Pressable } from './Pressable';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: `data-${string}`]: any;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90',
  secondary:
    'bg-subtle text-primary border border-subtle hover:bg-subtle',
  ghost: 'bg-transparent text-primary hover:bg-subtle',
  danger: 'bg-danger text-on-danger hover:opacity-90',
};

const SIZE: Record<Size, string> = {
  md: 'px-4 py-2 text-body',
  lg: 'px-6 py-3 text-body',
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${VARIANT[variant]} ${SIZE[size]} rounded-md font-medium ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter cultuvilla-web test components/primitives/Button.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/primitives/Button.tsx apps/web/components/primitives/Button.test.tsx
git commit -m "feat(web): add <Button> primitive (4 variants, loading state)"
```

### Task 3.6: `<Card>`

**Files:**
- Create: `apps/web/components/primitives/Card.tsx`
- Test: `apps/web/components/primitives/Card.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/primitives/Card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('<Card>', () => {
  it('renders children', () => {
    render(<Card>hello</Card>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies the default flat variant (no shadow)', () => {
    render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toMatch(/shadow-none/);
  });

  it('applies the elevated variant shadow', () => {
    render(<Card variant="elevated" data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toMatch(/shadow-sm/);
  });

  it('applies rounded-lg by default', () => {
    render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c').className).toMatch(/rounded-lg/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Card component**

`apps/web/components/primitives/Card.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

type Variant = 'flat' | 'elevated';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  flat: 'bg-surface shadow-none border border-border-subtle',
  elevated: 'bg-surfaceElevated shadow-sm',
};

// Container primitive. Two variants only: flat (bordered surface) and
// elevated (raised, no border). Padding and child layout are the
// caller's responsibility — wrap with <VStack gap={3}> inside if you
// want the typical card layout.
export function Card({
  children,
  variant = 'flat',
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={`${VARIANT[variant]} rounded-lg p-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter cultuvilla-web test components/primitives/Card.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/primitives/Card.tsx apps/web/components/primitives/Card.test.tsx
git commit -m "feat(web): add <Card> primitive (flat | elevated)"
```

### Task 3.7: `<Input>`

**Files:**
- Create: `apps/web/components/primitives/Input.tsx`
- Test: `apps/web/components/primitives/Input.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/components/primitives/Input.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('<Input>', () => {
  it('renders a controlled text input with the value', () => {
    render(<Input value="hi" onChangeText={() => {}} />);
    const el = screen.getByRole('textbox') as HTMLInputElement;
    expect(el.value).toBe('hi');
  });

  it('calls onChangeText with the new value', () => {
    const onChangeText = vi.fn();
    render(<Input value="" onChangeText={onChangeText} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(onChangeText).toHaveBeenCalledWith('x');
  });

  it('shows the label when provided', () => {
    render(
      <Input value="" onChangeText={() => {}} label="Nombre" />,
    );
    expect(screen.getByText('Nombre')).toBeInTheDocument();
  });

  it('shows the error message and applies the error class', () => {
    render(
      <Input
        value=""
        onChangeText={() => {}}
        error="Required"
        data-testid="wrap"
      />,
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input.className).toMatch(/border-danger/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter cultuvilla-web test components/primitives/Input.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the Input component**

`apps/web/components/primitives/Input.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react';

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChangeText: (next: string) => void;
  label?: string;
  error?: string;
}

// Controlled text input. `onChangeText` (vs `onChange`) keeps the API
// aligned with React Native, where event objects don't exist. Label and
// error are rendered inline so callers don't reinvent the wrapper
// markup on every form.
export function Input({
  value,
  onChangeText,
  label,
  error,
  className = '',
  ...rest
}: InputProps) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-bodySm text-muted">{label}</span>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        className={`border rounded-md px-3 py-2 text-body bg-surface focus:outline-none focus:ring-2 focus:ring-accent ${
          error ? 'border-danger' : 'border-border-subtle'
        } ${className}`}
        {...rest}
      />
      {error && (
        <span className="text-caption text-danger">{error}</span>
      )}
    </label>
  );
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter cultuvilla-web test components/primitives/Input.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/primitives/Input.tsx apps/web/components/primitives/Input.test.tsx
git commit -m "feat(web): add <Input> primitive (controlled, label, error)"
```

### Task 3.8: Primitives barrel

**Files:**
- Create: `apps/web/components/primitives/index.ts`

- [ ] **Step 1: Create the barrel**

`apps/web/components/primitives/index.ts`:

```ts
export { Screen } from './Screen';
export { HStack } from './HStack';
export { VStack } from './VStack';
export { Text } from './Text';
export { Pressable } from './Pressable';
export { Button } from './Button';
export { Card } from './Card';
export { Input } from './Input';
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm web:typecheck
```

Expected: clean.

- [ ] **Step 3: Run all web tests**

```bash
pnpm --filter cultuvilla-web test
```

Expected: all primitive tests pass (~30 tests across the 7 component test files + the 3 from Task 2.2).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/primitives/index.ts
git commit -m "feat(web): add primitives barrel"
```

---

## Phase 4: i18n catalog hoist

Currently `apps/web/i18n/messages/es.json` (91 lines) is consumed by next-intl via `apps/web/i18n/request.ts`. We move the catalog into a new `packages/i18n/` workspace so future `apps/mobile` consumes the same JSON.

### Task 4.1: Create `packages/i18n/` workspace

**Files:**
- Create: `packages/i18n/package.json`
- Create: `packages/i18n/index.ts`
- Modify: `pnpm-workspace.yaml` (no change needed — `packages/*` already matches)

- [ ] **Step 1: Create the package.json**

`packages/i18n/package.json`:

```json
{
  "name": "@cultuvilla/i18n",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "index.ts",
  "types": "index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "~5.8.3"
  }
}
```

- [ ] **Step 2: Create a tsconfig**

`packages/i18n/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "./dist",
    "noEmit": true,
    "resolveJsonModule": true
  },
  "include": ["index.ts", "messages/*.json"]
}
```

- [ ] **Step 3: Verify root tsconfig.json exists; if not, this will fail — read it**

```bash
cat tsconfig.json | head -10
```

Expected: it exists with shared compiler options. If `tsconfig.json` doesn't have the expected shape, drop `"extends"` from `packages/i18n/tsconfig.json` and inline the needed options.

- [ ] **Step 4: Install (so the workspace is registered)**

```bash
pnpm install
```

Expected: `@cultuvilla/i18n` listed in pnpm workspace output.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/package.json packages/i18n/tsconfig.json pnpm-lock.yaml
git commit -m "chore(i18n): create @cultuvilla/i18n workspace"
```

### Task 4.2: Move the message catalog

**Files:**
- Move: `apps/web/i18n/messages/es.json` → `packages/i18n/messages/es.json`
- Create: `packages/i18n/index.ts`

- [ ] **Step 1: Create the messages directory and move the JSON**

```bash
mkdir -p packages/i18n/messages
git mv apps/web/i18n/messages/es.json packages/i18n/messages/es.json
```

- [ ] **Step 2: Create the loader**

`packages/i18n/index.ts`:

```ts
import es from './messages/es.json' assert { type: 'json' };

export type Locale = 'es';

const CATALOGS: Record<Locale, Record<string, unknown>> = {
  es,
};

export function getMessages(locale: Locale): Record<string, unknown> {
  return CATALOGS[locale];
}

export const SUPPORTED_LOCALES: Locale[] = ['es'];
export const DEFAULT_LOCALE: Locale = 'es';
```

- [ ] **Step 3: Verify the JSON moved cleanly**

```bash
ls packages/i18n/messages/
ls apps/web/i18n/messages/ 2>/dev/null
```

Expected: `packages/i18n/messages/es.json` exists. `apps/web/i18n/messages/` either doesn't exist or is empty.

If `apps/web/i18n/messages/` still exists empty, remove it:

```bash
rmdir apps/web/i18n/messages 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/messages/es.json packages/i18n/index.ts
# Note: `git mv` already staged the deletion from apps/web/i18n/messages/
git commit -m "refactor(i18n): hoist es.json into @cultuvilla/i18n workspace"
```

### Task 4.3: Wire `apps/web` to consume `@cultuvilla/i18n`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/i18n/request.ts`

- [ ] **Step 1: Add the workspace dep**

In `apps/web/package.json`, add to `dependencies` (after `@cultuvilla/shared` if present, otherwise alphabetical):

```json
"@cultuvilla/i18n": "workspace:*"
```

- [ ] **Step 2: Update the request loader**

Replace `apps/web/i18n/request.ts` with:

```ts
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, getMessages } from '@cultuvilla/i18n';

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: getMessages(DEFAULT_LOCALE),
}));
```

- [ ] **Step 3: Re-install + typecheck**

```bash
pnpm install
pnpm web:typecheck
```

Expected: clean.

- [ ] **Step 4: Smoke test — boot the dev server and confirm Spanish strings render**

```bash
NEXT_PUBLIC_APP_ENV=dev \
  NEXT_PUBLIC_FIREBASE_API_KEY_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV=0 \
  NEXT_PUBLIC_FIREBASE_APP_ID_DEV=ci-placeholder \
  pnpm web:dev
```

Open `http://localhost:3000`, confirm the page still renders Spanish text (e.g., "Eventos" or whatever the home page shows). Kill the dev server.

If strings show as key paths (`feed.title` instead of "Inicio"), the import is wrong — recheck `getMessages` returns the JSON contents (it should — `import es from './es.json'` returns the parsed object).

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/i18n/request.ts pnpm-lock.yaml
git commit -m "refactor(web): load i18n messages from @cultuvilla/i18n"
```

### Task 4.4: Wire i18n typecheck into root

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add i18n typecheck to root typecheck**

In root `package.json`, find the `typecheck` script:

```json
"typecheck": "pnpm shared:typecheck && pnpm web:typecheck && pnpm functions:typecheck",
```

Add an `i18n:typecheck` script and chain it:

```json
"i18n:typecheck": "pnpm --filter @cultuvilla/i18n typecheck",
"typecheck": "pnpm shared:typecheck && pnpm web:typecheck && pnpm functions:typecheck && pnpm i18n:typecheck",
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: all four packages typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(root): include @cultuvilla/i18n in typecheck gate"
```

---

## Phase 5: Locale formatting helpers

`packages/shared/src/utils/format.ts` exposes `formatDate`, `formatPrice`, `formatRelativeTime`. All preset to `es-ES`.

### Task 5.1: `formatDate`

**Files:**
- Create: `packages/shared/src/utils/format.ts`
- Test: `packages/shared/test/utils/format.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/shared/test/utils/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDate } from '../../src/utils/format';

describe('formatDate', () => {
  const d = new Date('2026-05-19T15:30:00.000Z');

  it('formats short (numeric date)', () => {
    expect(formatDate(d, 'short')).toMatch(/19\/05\/2026|19\/5\/2026/);
  });

  it('formats long (with weekday + month name)', () => {
    const out = formatDate(d, 'long');
    expect(out).toMatch(/martes/i);
    expect(out).toMatch(/mayo/i);
    expect(out).toMatch(/2026/);
  });

  it('formats time-only', () => {
    // Output depends on the host TZ; assert the shape, not the wall clock.
    expect(formatDate(d, 'time')).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats datetime (date + time)', () => {
    expect(formatDate(d, 'datetime')).toMatch(/2026/);
    expect(formatDate(d, 'datetime')).toMatch(/\d{1,2}:\d{2}/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/utils/format.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the helper**

`packages/shared/src/utils/format.ts`:

```ts
/**
 * Locale-formatted display helpers. All preset to `es-ES`. Whenever you
 * find yourself reaching for `Intl.DateTimeFormat` or
 * `Intl.NumberFormat` in a screen, write a helper here instead —
 * formatting drift across the app reads as bugs.
 */

const LOCALE = 'es-ES';

export type DateStyle = 'short' | 'long' | 'time' | 'datetime';

export function formatDate(date: Date, style: DateStyle = 'short'): string {
  switch (style) {
    case 'short':
      return new Intl.DateTimeFormat(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    case 'long':
      return new Intl.DateTimeFormat(LOCALE, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    case 'time':
      return new Intl.DateTimeFormat(LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    case 'datetime':
      return new Intl.DateTimeFormat(LOCALE, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/utils/format.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/format.ts packages/shared/test/utils/format.test.ts
git commit -m "feat(shared): add formatDate (es-ES) with short/long/time/datetime"
```

### Task 5.2: `formatPrice`

**Files:**
- Modify: `packages/shared/src/utils/format.ts`
- Modify: `packages/shared/test/utils/format.test.ts`

- [ ] **Step 1: Append the failing tests to the same test file**

Add to `packages/shared/test/utils/format.test.ts`:

```ts
import { formatPrice } from '../../src/utils/format';

describe('formatPrice', () => {
  it('formats EUR by default with the Spanish thousands separator', () => {
    expect(formatPrice(1234.5)).toMatch(/1\.234,50/);
    expect(formatPrice(1234.5)).toMatch(/€/);
  });

  it('treats zero as a real value, not a missing one', () => {
    expect(formatPrice(0)).toMatch(/0,00/);
  });

  it('honors a custom currency', () => {
    expect(formatPrice(10, 'USD')).toMatch(/10,00/);
  });
});
```

- [ ] **Step 2: Run to verify the new block fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/utils/format.test.ts
```

Expected: FAIL — `formatPrice` not found.

- [ ] **Step 3: Implement**

Append to `packages/shared/src/utils/format.ts`:

```ts
export function formatPrice(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
  }).format(amount);
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/utils/format.test.ts
```

Expected: PASS, all 4 + 3 = 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/format.ts packages/shared/test/utils/format.test.ts
git commit -m "feat(shared): add formatPrice (es-ES, EUR default)"
```

### Task 5.3: `formatRelativeTime`

**Files:**
- Modify: `packages/shared/src/utils/format.ts`
- Modify: `packages/shared/test/utils/format.test.ts`

- [ ] **Step 1: Append the failing tests**

Add to `packages/shared/test/utils/format.test.ts`:

```ts
import { formatRelativeTime } from '../../src/utils/format';

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-05-19T12:00:00.000Z');

  it('says "hace 5 minutos" when 5 minutes in the past', () => {
    const past = new Date(NOW.getTime() - 5 * 60 * 1000);
    expect(formatRelativeTime(past, NOW)).toMatch(/hace\s+5\s+minuto/i);
  });

  it('says "en 2 horas" when 2 hours in the future', () => {
    const future = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(future, NOW)).toMatch(/en\s+2\s+hora/i);
  });

  it('says "ayer" when ~1 day in the past', () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(yesterday, NOW)).toMatch(/ayer/i);
  });

  it('says "mañana" when ~1 day in the future', () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(tomorrow, NOW)).toMatch(/mañana/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/utils/format.test.ts
```

Expected: FAIL — `formatRelativeTime` not found.

- [ ] **Step 3: Implement**

Append to `packages/shared/src/utils/format.ts`:

```ts
const RTF = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

interface TimeUnit {
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
}

const UNITS: TimeUnit[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  for (const { unit, ms } of UNITS) {
    if (Math.abs(diff) >= ms) {
      return RTF.format(Math.round(diff / ms), unit);
    }
  }
  return RTF.format(0, 'second');
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter @cultuvilla/shared exec vitest run test/utils/format.test.ts
```

Expected: PASS, 11 tests total.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/format.ts packages/shared/test/utils/format.test.ts
git commit -m "feat(shared): add formatRelativeTime (es-ES, auto numeric)"
```

### Task 5.4: Re-export from shared utils barrel

**Files:**
- Modify: `packages/shared/src/utils/index.ts` (if it exists)

- [ ] **Step 1: Check whether a utils barrel exists**

```bash
ls packages/shared/src/utils/
cat packages/shared/src/utils/index.ts 2>/dev/null || echo "no barrel"
```

- [ ] **Step 2: Add the re-export**

If the barrel exists, append:

```ts
export { formatDate, formatPrice, formatRelativeTime, type DateStyle } from './format';
```

If no barrel exists, create one:

`packages/shared/src/utils/index.ts`:

```ts
export { formatDate, formatPrice, formatRelativeTime, type DateStyle } from './format';
```

- [ ] **Step 3: Verify shared root re-exports utils (it should — Task 1.9 left `export * from './utils'`)**

```bash
grep "from './utils'" packages/shared/src/index.ts
```

Expected: line exists.

- [ ] **Step 4: Verify**

```bash
pnpm shared:typecheck
pnpm shared:test
```

Expected: clean, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/index.ts
git commit -m "feat(shared): re-export format helpers from utils barrel"
```

---

## Phase 6: Documentation

### Task 6.1: Design-system README

**Files:**
- Create: `packages/shared/src/design-system/README.md`

- [ ] **Step 1: Write the README**

`packages/shared/src/design-system/README.md`:

```markdown
# `@cultuvilla/shared/design-system`

Platform-agnostic design tokens consumed by both `apps/web` (Tailwind v4)
and the future `apps/mobile` (NativeWind). The contract is intentionally
tight:

- **Tokens are TypeScript objects**, not CSS strings. They render to CSS
  via the Tailwind config (`apps/web/tailwind.config.ts`); the same
  objects are read by NativeWind in the mobile app.
- **Semantic, not raw.** `bg-surface`, not `bg-white`. `text-muted`, not
  `text-gray-500`. The whole point is that dark mode can be a single
  switch later.
- **Never extend ad-hoc.** If a screen needs a value that isn't here,
  that's a design conversation, not a token addition.

## What's exported

| Module | What |
|---|---|
| `tokens/spacing` | `{ 0, 1, 2, 3, 4, 6, 8, 12, 16 }` → `{ 0, 4, 8, 12, 16, 24, 32, 48, 64 }` px |
| `tokens/typography` | 7 variants: `display`, `h1`, `h2`, `h3`, `body`, `bodySm`, `caption`. Each carries `fontSize`, `lineHeight`, `fontWeight`. |
| `tokens/colors` | Semantic light-mode palette (`bg.surface`, `text.primary`, `accent.DEFAULT`, …). Dark mode added later by adding `colors.dark` with the same keys. |
| `tokens/radii` | `none / sm / md / lg / xl / full`. |
| `tokens/elevation` | `none / sm / md`. Each carries a `web` CSS string and an `rn` descriptor for React Native. |
| `tokens/zIndex` | Named layers: `base / dropdown / sticky / sheet / modal / toast`. |
| `tokens/a11y` | `minTouchTarget: 44`, `defaultHitSlop`. |
| `icons` | `iconSizes = { sm: 16, md: 20, lg: 24 }` for `lucide-react` / `lucide-react-native`. |

## Web usage

Tokens flow into `apps/web/tailwind.config.ts`, which extends Tailwind's
theme. JSX consumes them as utility classes:

```tsx
<div className="bg-surface text-primary p-4 rounded-md shadow-sm">
  …
</div>
```

When you need a raw number (e.g. computed inline style, animation
target), import directly:

```tsx
import { spacing } from '@cultuvilla/shared/design-system';

const sidebarWidth = spacing[16];  // 64
```

## Mobile usage (when `apps/mobile/` lands)

The mobile app will configure NativeWind with the same `tailwind.config.ts`
shape. Tokens reach NativeWind via the JS config; raw values are
available for `StyleSheet.create` callers that prefer direct numeric
access.

For RN shadows, `elevation.{none,sm,md}.rn` carries the full
`{ shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }`
descriptor — never recompute these in a screen.

## Adding a new token

Don't, lightly. Tokens are a small vocabulary on purpose. If you must:

1. Add the value to the relevant `tokens/<name>.ts`.
2. Update its test.
3. Update this README's table.
4. If the value should appear in Tailwind classes, extend
   `apps/web/tailwind.config.ts` in the same PR.
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/design-system/README.md
git commit -m "docs(shared): add design-system README"
```

### Task 6.2: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md` (repo root)

- [ ] **Step 1: Read current Conventions section**

```bash
sed -n '/^### Styling/,/^### /p' AGENTS.md
```

Note the current `### Styling` section. It says: "Tailwind 4. Utility classes inline. No CSS modules, no styled-components. lucide-react for icons."

- [ ] **Step 2: Update the Styling section**

Replace the current `### Styling` section in `AGENTS.md` with:

```markdown
### Styling

Tailwind v4 with a JS-based `tailwind.config.ts` (`apps/web/tailwind.config.ts`).
**Design tokens live in `@cultuvilla/shared/design-system`** and feed
Tailwind's `backgroundColor` / `textColor` / `borderColor` / `boxShadow` /
`borderRadius` / `spacing` / `fontSize` / `zIndex` extensions. New code
must use semantic Tailwind classes (`bg-surface`, `text-primary`,
`rounded-md`, `shadow-sm`, `text-body`, etc.) — not raw Tailwind palette
names (`bg-white`, `text-gray-900`). Existing screens still use raw
classes; migration is opportunistic, not mandatory.

When a screen needs a raw numeric value (computed style, RN inline style),
import directly from the design-system: `spacing[4]`, `iconSizes.md`,
`elevation.sm.rn`. See [packages/shared/src/design-system/README.md]
(packages/shared/src/design-system/README.md) for the full token vocabulary.

**Web primitives** live under [apps/web/components/primitives/]
(apps/web/components/primitives/) — `Screen`, `HStack`, `VStack`, `Text`,
`Pressable`, `Button`, `Card`, `Input`. New screens compose primitives;
inline `<div>` + Tailwind is fine where a primitive doesn't fit, but reach
for the primitive first. The same component names will exist under
`apps/mobile/components/primitives/` once the mobile app lands.

Icons: `lucide-react` (web) / `lucide-react-native` (mobile). Pass
`iconSizes.sm | md | lg` for size — no ad-hoc `size={18}`.
```

- [ ] **Step 3: Add an "i18n" subsection under Conventions (if not already present)**

Locate the `### i18n` section (it should exist). Update it to:

```markdown
### i18n

Messages live in [@cultuvilla/i18n](packages/i18n/) and are consumed by web
via next-intl (see `apps/web/i18n/request.ts`). The future mobile app will
consume the same JSON via i18next + i18next-icu. User-facing strings go
through `useTranslations()`; hardcoded Spanish is allowed only in
dev-only surfaces (admin panels, debug pages) where i18n is not a current
priority.

Locale formatting (`formatDate`, `formatPrice`, `formatRelativeTime`)
lives in `@cultuvilla/shared/utils/format.ts`, preset to `es-ES`. Never
call `Intl.DateTimeFormat` or `Intl.NumberFormat` directly in screens —
the formatter is the single point of locale truth.
```

- [ ] **Step 4: Verify**

```bash
grep -A2 "Design tokens" AGENTS.md
grep -A2 "@cultuvilla/i18n" AGENTS.md
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): document design-system, primitives, and i18n hoist"
```

### Task 6.3: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Read current Unreleased section**

```bash
sed -n '/^## \[Unreleased\]/,/^## /p' CHANGELOG.md | head -50
```

- [ ] **Step 2: Add new entries under `### Added` (or create the section if it doesn't exist)**

Find the `## [Unreleased]` block and add to its `### Added` subsection (creating the subsection if needed):

```markdown
- **Design system tokens** at [packages/shared/src/design-system/](packages/shared/src/design-system/) — spacing (4-based scale), typography (7 variants), semantic colors (light mode; dark added via `colors.dark` later), radii, elevation (web + RN shapes), z-index named layers, a11y constants (min touch target, default hit slop), icon sizes. See [packages/shared/src/design-system/README.md](packages/shared/src/design-system/README.md).
- **Tailwind v4 JS-based config** at [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts) extending the theme from the shared tokens. Semantic utility classes (`bg-surface`, `text-primary`, `rounded-md`, etc.) now resolve to design-system values.
- **Web primitives** at [apps/web/components/primitives/](apps/web/components/primitives/) — `Screen`, `HStack`, `VStack`, `Text`, `Pressable`, `Button`, `Card`, `Input`. `<Pressable>` enforces the 44px minimum touch target. New screens compose primitives; existing screens unchanged.
- **`@cultuvilla/i18n` workspace** at [packages/i18n/](packages/i18n/) — message catalog hoisted out of `apps/web/i18n/messages/`. Web consumes it via next-intl; the future mobile app will consume the same JSON via i18next.
- **Locale formatting helpers** at [packages/shared/src/utils/format.ts](packages/shared/src/utils/format.ts) — `formatDate`, `formatPrice`, `formatRelativeTime`, all preset to `es-ES`.
- **`apps/web` test setup**: vitest + jsdom + @testing-library/react. `pnpm web:test` runs the suite; included in root `pnpm test`.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): record design-system + primitives + i18n hoist"
```

---

## Phase 7: Final verification

### Task 7.1: Full check from a fresh shell

- [ ] **Step 1: Run root check with CI placeholder env**

```bash
NEXT_PUBLIC_APP_ENV=dev \
  NEXT_PUBLIC_FIREBASE_API_KEY_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV=0 \
  NEXT_PUBLIC_FIREBASE_APP_ID_DEV=ci-placeholder \
  pnpm check
```

Expected: exit 0. If any step fails, fix it before moving on — don't ship a broken `pnpm check`.

- [ ] **Step 2: Run emulator suites**

```bash
pnpm test:emulators
```

Expected: all three suites pass (integration, rules, functions handlers). The design-system change should not affect any emulator-backed test, but verify.

- [ ] **Step 3: Manual smoke in dev server**

```bash
NEXT_PUBLIC_APP_ENV=dev \
  NEXT_PUBLIC_FIREBASE_API_KEY_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV=ci-placeholder \
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV=ci.example.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV=0 \
  NEXT_PUBLIC_FIREBASE_APP_ID_DEV=ci-placeholder \
  pnpm web:dev
```

Open `http://localhost:3000`. Verify:
1. The home page renders.
2. Spanish strings render (no key-paths).
3. Existing screens look the same as before (they're still using raw Tailwind classes).
4. Open the React DevTools or browser inspector and verify a semantic class like `bg-surface` resolves to `#ffffff`.

Kill the dev server.

- [ ] **Step 4: Open the PR**

The branch is ready. Push and open the PR with the description below. Target: `feat/villa-events-v2` (the active development branch), not `main`.

```bash
git push -u origin <branch-name>
```

PR title:
```
feat(shared,web,i18n): design-system tokens + web primitives + i18n hoist
```

PR body should include:

- **Summary**: link to this plan, summarize the four landings (tokens, web primitives, i18n hoist, locale helpers).
- **Why**: load-bearing foundation that all future screens (web + mobile) depend on; expensive to retrofit.
- **Tests**: enumerate the new test counts per phase.
- **Test plan**: `pnpm check`, `pnpm test:emulators`, manual smoke in dev server.

---

## Summary

When this plan lands, the foundation is:

- `@cultuvilla/shared/design-system` — tokens + icon sizes.
- `apps/web/tailwind.config.ts` — JS-based, consuming shared tokens, exposing semantic utility classes.
- `apps/web/components/primitives/` — 8 primitives (Screen, HStack, VStack, Text, Pressable, Button, Card, Input).
- `@cultuvilla/i18n` workspace — message catalog hoisted, ready for the mobile app to consume.
- `@cultuvilla/shared/utils/format` — formatDate, formatPrice, formatRelativeTime.

What's explicitly NOT in scope (separate plans):

- **`apps/mobile/` scaffolding** — Expo, React Navigation, RN AuthContext, mobile primitives.
- **Mobile tailwind / NativeWind setup** — will land with the mobile app.
- **Dark mode** — semantic tokens are dark-ready; the toggle and `colors.dark` block are a separate plan when product wants it.
- **Migrating existing `apps/web` screens to primitives** — opportunistic in follow-up PRs.
- **Asset registry** — deferred until the mobile app needs `require()`-ed images.
- **Animations / haptics / sheets / toasts** — add libraries on first real use.
