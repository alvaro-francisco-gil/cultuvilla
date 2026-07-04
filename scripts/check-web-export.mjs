#!/usr/bin/env node
/**
 * Post-build gate for the Expo web export (apps/mobile/dist). Runs in the
 * deploy pipeline AFTER `expo export --platform web` and BEFORE
 * `firebase deploy --only hosting`, so a broken web bundle is rejected
 * instead of shipped to Firebase Hosting.
 *
 * What it catches
 * ---------------
 * A native-only module (no web build) that reaches the web bundle calls
 * `TurboModuleRegistry.getEnforcing("<NativeModuleName>")` at module-eval
 * time. On web `TurboModuleRegistry` is a react-native-web stub whose
 * getEnforcing throws — so the *whole* app dies before mount with
 * `Cannot read properties of undefined (reading 'getEnforcing')`. This is
 * exactly how react-native-image-crop-picker crashed villa-events.web.app
 * (see .agents/skills/mobile-web-compat/SKILL.md).
 *
 * A HEALTHY web export contains ZERO real `getEnforcing("...")` CALLS —
 * react-native-web stubs the registry, so the only `getEnforcing` tokens
 * are the stub's own definition (`getEnforcing=function(e){...}`) and its
 * error-string literal (`getEnforcing(...)`), neither of which matches the
 * call pattern `getEnforcing("`. Any `getEnforcing("<Name>")` means a
 * native TurboModule leaked in.
 *
 * It also fails if the export is missing entirely (a build that silently
 * produced nothing).
 *
 * Usage: node scripts/check-web-export.mjs
 * Exits 0 (OK) or 1 (reject the deploy).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const jsDir = join(repoRoot, 'apps', 'mobile', 'dist', '_expo', 'static', 'js', 'web');

// TurboModuleRegistry.getEnforcing("Name") — the string-literal call a native
// module makes at load. The rn-web stub's own `getEnforcing=function` and its
// `getEnforcing(...)` error string do NOT match `getEnforcing("`.
const NATIVE_CALL = /getEnforcing\("([^"]+)"/g;

async function main() {
  let entries;
  try {
    entries = (await readdir(jsDir)).filter((f) => f.endsWith('.js'));
  } catch {
    console.error(
      `check-web-export: no web bundle at ${jsDir}.\n` +
        'The export produced no JS — run `pnpm app:web:build` first, and check that step for errors.',
    );
    process.exit(1);
  }
  if (entries.length === 0) {
    console.error(`check-web-export: ${jsDir} has no .js bundle — the export is empty.`);
    process.exit(1);
  }

  const leaks = [];
  for (const file of entries) {
    const abs = join(jsDir, file);
    if (!(await stat(abs)).isFile()) continue;
    const src = await readFile(abs, 'utf8');
    const names = new Set();
    for (const m of src.matchAll(NATIVE_CALL)) names.add(m[1]);
    if (names.size > 0) leaks.push({ file, names: [...names] });
  }

  if (leaks.length === 0) {
    console.log(`check-web-export: OK (${entries.length} bundle(s), no native TurboModule leaked)`);
    process.exit(0);
  }

  console.error('check-web-export: native-only module(s) leaked into the WEB bundle:\n');
  for (const { file, names } of leaks) {
    for (const n of names) {
      console.error(`  ${file}: TurboModuleRegistry.getEnforcing("${n}")`);
    }
  }
  console.error(
    '\nThis crashes the web app on load (Cannot read properties of undefined ' +
      "(reading 'getEnforcing')). A native-only package reached the web build —\n" +
      'give it a `.web.tsx` override (same base extension as the default file) or\n' +
      'guard its import behind Platform.OS. See .agents/skills/mobile-web-compat/SKILL.md.\n' +
      'Deploy rejected.',
  );
  process.exit(1);
}

main();
