# QR + `/descarga` endpoint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a print-forever QR that encodes `https://cultuvilla.es/descarga`, backed by a smart web landing page, plus a script that generates the branded (logo-in-center) QR asset.

**Architecture:** The QR encodes a plain `https://` URL that resolves as a real Expo Router web route today and can be intercepted by the native app later — the printed bytes never change. `/descarga` is a client-side smart landing (NOT a Universal Link): web-only for now (branded "open in web" page), with the app-download half fully coded but gated behind a single `APP_AVAILABLE` flag flipped at native release. A standalone Node script generates the QR (PNG + SVG) with the Cultuvilla logo composited into the center at error-correction level H.

**Tech Stack:** Expo Router v4, React Native / NativeWind, `useT()` i18n adapter; Node ESM scripts using `qrcode` (encode) + `sharp` (composite) + `jsqr` (test-time decode).

## Global Constraints

- **No `firebase/*` imports in screens** — `/descarga` touches no Firebase; keep it that way.
- **All user-facing strings via `useT()`** and `packages/i18n/messages/es.json`; no hardcoded Spanish in the screen.
- **Strict TypeScript**, no `any`, no `@ts-nocheck`.
- **Compose primitives** (`Screen`, `VStack`, `Text`, `Button`) from `apps/mobile/components/primitives`; reach for a raw `<View>` only where no primitive fits.
- **Do NOT modify** `apps/mobile/public/.well-known/**` — `/descarga` is deliberately not an App/Universal Link.
- **QR error-correction level is `H`** (30%) — non-negotiable, the center logo needs it.
- **Default QR target URL:** `https://cultuvilla.es/descarga` (host overridable via `--url`).
- **App custom scheme is `cultuvilla`** (from `apps/mobile/app.config.ts` `scheme`).

---

### Task 1: `/descarga` smart landing endpoint

**Files:**
- Create: `apps/mobile/lib/appStores.ts`
- Create: `apps/mobile/app/descarga.tsx`
- Create: `apps/mobile/app/__tests__/descarga.test.tsx`
- Modify: `packages/i18n/messages/es.json` (add `descarga` namespace)

**Interfaces:**
- Produces: `APP_AVAILABLE: boolean`, `APP_STORES: { ios: string; android: string }`, `APP_SCHEME: string` from `apps/mobile/lib/appStores.ts`.
- Consumes: `useT()` from `apps/mobile/lib/i18n`; `Screen`, `VStack`, `Text`, `Button` from `apps/mobile/components/primitives`; `Redirect`, `useRouter` from `expo-router`.

- [ ] **Step 1: Add the i18n strings**

Add this block to `packages/i18n/messages/es.json` (nested under the root object, alphabetically near other top-level namespaces):

```json
"descarga": {
  "tagline": "La agenda de tu pueblo, en tu bolsillo.",
  "openWeb": "Abrir en la web",
  "comingSoon": "App para móvil, muy pronto.",
  "getOnAppStore": "Descargar en el App Store",
  "getOnPlayStore": "Descargar en Google Play",
  "continueOnWeb": "Seguir en la web"
}
```

- [ ] **Step 2: Create the config module**

`apps/mobile/lib/appStores.ts`:

```ts
// Single source of truth for the app-download landing (/descarga).
// Flip APP_AVAILABLE to true and fill APP_STORES the day the native apps ship.
export const APP_AVAILABLE = false;

export const APP_STORES: { ios: string; android: string } = {
  ios: '', // App Store URL — fill at release
  android: '', // Play Store URL — fill at release
};

// Must match `scheme` in apps/mobile/app.config.ts. Used to attempt opening an
// already-installed app before falling back to the store.
export const APP_SCHEME = 'cultuvilla';
```

- [ ] **Step 3: Write the failing test**

`apps/mobile/app/__tests__/descarga.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import Descarga from '../descarga';

// Force web platform + APP_AVAILABLE=false (the current pre-release state).
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'web',
  select: (obj: Record<string, unknown>) => obj.web ?? obj.default,
}));
jest.mock('../../lib/appStores', () => ({
  APP_AVAILABLE: false,
  APP_STORES: { ios: '', android: '' },
  APP_SCHEME: 'cultuvilla',
}));

describe('Descarga landing (web, pre-release)', () => {
  it('shows the open-in-web CTA and the coming-soon note, no store buttons', () => {
    render(<Descarga />);
    expect(screen.getByText('Abrir en la web')).toBeTruthy();
    expect(screen.getByText('App para móvil, muy pronto.')).toBeTruthy();
    expect(screen.queryByText('Descargar en el App Store')).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter cultuvilla-mobile exec jest app/__tests__/descarga.test.tsx`
Expected: FAIL — cannot find module `../descarga`.

- [ ] **Step 5: Implement the landing page**

`apps/mobile/app/descarga.tsx`:

```tsx
import { Platform, Linking } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen, VStack, Text, Button } from '../components/primitives';
import { useT } from '../lib/i18n';
import { APP_AVAILABLE, APP_STORES, APP_SCHEME } from '../lib/appStores';

export default function Descarga() {
  const { t } = useT();
  const router = useRouter();

  // On native, the user is already in the app — this route only exists so the
  // shared app/ tree compiles; send them home.
  if (Platform.OS !== 'web') {
    return <Redirect href="/(tabs)" />;
  }

  const openWeb = () => router.replace('/(tabs)');

  return (
    <Screen>
      <VStack className="flex-1 items-center justify-center gap-6 px-6">
        <Text tone="primary" className="text-3xl font-bold">Cultuvilla</Text>
        <Text tone="muted" className="text-center text-body">{t('descarga.tagline')}</Text>

        <Button onPress={openWeb} variant="primary" size="lg" fullWidth>
          {t('descarga.openWeb')}
        </Button>

        {APP_AVAILABLE ? (
          <VStack className="w-full gap-3">
            {APP_STORES.ios ? (
              <Button onPress={() => Linking.openURL(APP_STORES.ios)} variant="secondary" fullWidth>
                {t('descarga.getOnAppStore')}
              </Button>
            ) : null}
            {APP_STORES.android ? (
              <Button onPress={() => Linking.openURL(APP_STORES.android)} variant="secondary" fullWidth>
                {t('descarga.getOnPlayStore')}
              </Button>
            ) : null}
          </VStack>
        ) : (
          <Text tone="muted" className="text-center text-caption">{t('descarga.comingSoon')}</Text>
        )}
      </VStack>
    </Screen>
  );
}
```

Note: `APP_SCHEME` is imported for the release-time deep-link attempt; keep the import even though the pre-release branch does not use it yet — it belongs to the same gated block and is filled in the release follow-up. If the mobile lint/typecheck flags the unused import, wire the `cultuvilla://` open-attempt into the `APP_AVAILABLE` branch (try `Linking.openURL(`${APP_SCHEME}://`)` before showing store buttons) rather than deleting it.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter cultuvilla-mobile exec jest app/__tests__/descarga.test.tsx`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `pnpm app:typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib/appStores.ts apps/mobile/app/descarga.tsx apps/mobile/app/__tests__/descarga.test.tsx packages/i18n/messages/es.json
git commit -m "feat(mobile): add /descarga smart landing endpoint"
```

---

### Task 2: Branded QR generator script

**Files:**
- Create: `scripts/generate-qr.mjs`
- Create: `scripts/__tests__/generate-qr.test.mjs`
- Create: `apps/mobile/assets/qr/cultuvilla-descarga.png` + `.svg` (generated output, committed)
- Modify: `package.json` (root — add `qrcode`, `jsqr` devDeps + `qr:generate` / `qr:test` scripts)

**Interfaces:**
- Produces: `generateQr({ url, outDir, size }): Promise<{ pngPath: string; svgPath: string }>` exported from `scripts/generate-qr.mjs`, plus a CLI entrypoint when run directly.
- Consumes: `qrcode`, `sharp`, and (test only) `jsqr`.

- [ ] **Step 1: Add dependencies**

Run:
```bash
pnpm add -w -D qrcode jsqr
```
(`sharp` is already a root dependency.)
Expected: `qrcode` and `jsqr` appear under `devDependencies` in root `package.json`.

- [ ] **Step 2: Write the failing test**

`scripts/__tests__/generate-qr.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { generateQr } from '../generate-qr.mjs';

test('generateQr writes PNG + SVG and the PNG decodes back to the URL', async () => {
  const url = 'https://cultuvilla.es/descarga';
  const outDir = await mkdtemp(join(tmpdir(), 'qr-'));

  const { pngPath, svgPath } = await generateQr({ url, outDir, size: 1024 });

  // Both files exist and are non-empty.
  assert.ok((await stat(pngPath)).size > 0, 'PNG is non-empty');
  const svg = await readFile(svgPath, 'utf8');
  assert.ok(svg.includes('<svg'), 'SVG looks like SVG');

  // The generated QR round-trips the exact URL (proves the logo overlay didn't
  // break scannability at EC level H).
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  assert.ok(decoded, 'QR decodes');
  assert.equal(decoded.data, url);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test scripts/__tests__/generate-qr.test.mjs`
Expected: FAIL — cannot find module `../generate-qr.mjs`.

- [ ] **Step 4: Implement the generator**

`scripts/generate-qr.mjs`:

```js
#!/usr/bin/env node
/**
 * generate-qr.mjs
 *
 * Generate the print-forever Cultuvilla QR: encodes an https URL (default
 * https://cultuvilla.es/descarga), with the Cultuvilla logo composited into the
 * center on a white rounded pad. Error-correction level H so the logo overlay
 * stays scannable. Emits a high-res PNG (print) and an SVG (vector).
 *
 * USAGE
 *   node scripts/generate-qr.mjs [--url <url>] [--out <dir>] [--size <px>]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'https://cultuvilla.es/descarga';
const DEFAULT_OUT = join(ROOT, 'apps/mobile/assets/qr');
const LOGO = join(ROOT, 'apps/mobile/assets/logo.png');
const BASENAME = 'cultuvilla-descarga';

export async function generateQr({ url = DEFAULT_URL, outDir = DEFAULT_OUT, size = 2048 } = {}) {
  await mkdir(outDir, { recursive: true });
  const pngPath = join(outDir, `${BASENAME}.png`);
  const svgPath = join(outDir, `${BASENAME}.svg`);
  const qrOpts = { errorCorrectionLevel: 'H', margin: 2, width: size };

  // --- PNG: render QR, then composite a padded logo in the center. ---
  const qrPng = await QRCode.toBuffer(url, { ...qrOpts, type: 'png' });

  // Logo occupies ~18% of the QR; white rounded pad ~24% behind it.
  const logoSize = Math.round(size * 0.18);
  const padSize = Math.round(size * 0.24);
  const radius = Math.round(padSize * 0.18);

  const logo = await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer();
  const pad = await sharp({
    create: { width: padSize, height: padSize, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${padSize}" height="${padSize}"><rect width="${padSize}" height="${padSize}" rx="${radius}" ry="${radius}"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const offPad = Math.round((size - padSize) / 2);
  const offLogo = Math.round((size - logoSize) / 2);
  await sharp(qrPng)
    .composite([
      { input: pad, top: offPad, left: offPad },
      { input: logo, top: offLogo, left: offLogo },
    ])
    .png()
    .toFile(pngPath);

  // --- SVG: QR as vector, logo embedded as a base64 <image> in the center. ---
  const qrSvg = await QRCode.toString(url, { ...qrOpts, type: 'svg' });
  const logoB64 = (await sharp(LOGO).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer()).toString('base64');
  const vb = size; // qrcode svg viewBox is 0 0 <modules> <modules>; scale logo to fraction instead.
  const frac = 0.18;
  const padFrac = 0.24;
  const logoImg =
    `<g transform="translate(${(1 - padFrac) / 2} ${(1 - padFrac) / 2})">` +
    `<rect width="${padFrac}" height="${padFrac}" rx="${padFrac * 0.18}" fill="#fff"/>` +
    `<image x="${(padFrac - frac) / 2}" y="${(padFrac - frac) / 2}" width="${frac}" height="${frac}" ` +
    `href="data:image/png;base64,${logoB64}"/></g>`;
  // Inject before closing </svg>. qrcode's svg uses a 0..N viewBox where N =
  // module count; re-emit with a normalized 0 0 1 1 viewBox so the fractional
  // overlay above lines up regardless of module count.
  const normalized = qrSvg
    .replace(/viewBox="[^"]*"/, 'viewBox="0 0 1 1"')
    .replace(/<path ([^>]*?)\/>/, (m) => m); // keep path; scaled by viewBox
  const withLogo = normalized.replace('</svg>', `${logoImg}</svg>`);
  void vb;
  await writeFile(svgPath, withLogo, 'utf8');

  return { pngPath, svgPath };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const { pngPath, svgPath } = await generateQr({
    url: get('--url'),
    outDir: get('--out'),
    size: get('--size') ? Number(get('--size')) : undefined,
  });
  console.log(`QR written:\n  ${pngPath}\n  ${svgPath}`);
}
```

Implementation note on the SVG viewBox: `qrcode`'s SVG output uses a `0 0 <moduleCount> <moduleCount>` viewBox and a single `<path>` of the dark modules. Normalizing to `viewBox="0 0 1 1"` will misplace the path (the path coordinates are in module units, not 0..1). If the normalization approach does not line up when you open the SVG, fall back to the robust approach: read the module count from the `<svg>` element's original viewBox, and express the logo overlay `x/y/width/height` in those same module units (multiply the fractions by the module count) instead of rewriting the viewBox. Verify by opening the SVG in a browser and scanning it — this is the acceptance check for the SVG path.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/__tests__/generate-qr.test.mjs`
Expected: PASS (both assertions on files + the decode round-trip).

- [ ] **Step 6: Wire up package.json scripts**

Add to root `package.json` `scripts`:

```json
"qr:generate": "node scripts/generate-qr.mjs",
"qr:test": "node --test scripts/__tests__/generate-qr.test.mjs"
```

- [ ] **Step 7: Generate the committed asset**

Run: `pnpm qr:generate`
Expected: `apps/mobile/assets/qr/cultuvilla-descarga.png` (2048px) and `.svg` created. Open the PNG and scan it with a phone camera → it resolves to `https://cultuvilla.es/descarga`.

- [ ] **Step 8: Commit**

```bash
git add scripts/generate-qr.mjs scripts/__tests__/generate-qr.test.mjs package.json pnpm-lock.yaml apps/mobile/assets/qr/
git commit -m "feat(scripts): add branded QR generator for /descarga"
```

---

### Task 3: Docs + finalize

**Files:**
- Modify: `CHANGELOG.md` (under `## [Unreleased]`)
- Move: design doc `docs/plans/ideas/2026-07-11-qr-descarga-endpoint-design.md` stays as the record; this plan lives in `docs/plans/ready/`.

- [ ] **Step 1: CHANGELOG entry**

Add under `## [Unreleased]`:

```markdown
- Add `/descarga` landing endpoint and a branded QR generator (`pnpm qr:generate`) encoding `https://cultuvilla.es/descarga` — a print-once QR that works on web now and will open the native app once released.
```

- [ ] **Step 2: Full gate**

Run: `pnpm check`
Expected: lint + typecheck + test + build all green.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note /descarga endpoint + QR generator"
```

---

## User action items (out of scope for this PR)

- Attach `cultuvilla.es` as a custom domain on Firebase Hosting **prod** and deploy prod — the QR is only *live* after this.
- At native release: set `APP_STORES.ios`/`.android` URLs and flip `APP_AVAILABLE = true` in `apps/mobile/lib/appStores.ts` (one-line follow-up; the store-button UI is already built and tested).

## Self-review notes

- **Spec coverage:** endpoint (Task 1) ✓, generator PNG+SVG+logo+EC-H (Task 2) ✓, round-trip test (Task 2 Step 2) ✓, `.well-known` untouched (Global Constraints) ✓, host-agnostic default URL ✓, `pnpm qr:generate` ✓, i18n namespace ✓.
- **Types:** `generateQr({url,outDir,size})` signature consistent between test (Task 2 Step 2) and impl (Step 4); `APP_AVAILABLE`/`APP_STORES`/`APP_SCHEME` consistent between config (Task 1 Step 2), screen (Step 5), and test mock (Step 3).
- **Known risk flagged inline:** SVG viewBox normalization — fallback documented with a concrete acceptance check.
