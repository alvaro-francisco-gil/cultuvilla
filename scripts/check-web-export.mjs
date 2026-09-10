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
 * The document head
 * -----------------
 * In single-page output (`web.output: 'single'`) Expo builds index.html from
 * apps/mobile/public/index.html and IGNORES app/+html.tsx. Two changes to that
 * file — the `lang="es"` fix and the iOS App Store tag — were therefore dead
 * in production for weeks with every check green. The export is now asserted
 * to carry both, so the head cannot silently go missing again.
 *
 * robots.txt
 * ----------
 * With `--env=<dev|beta|prod>` (the deploy passes it) it also asserts the
 * robots.txt that write-robots.mjs placed matches that env: only prod may be
 * indexed. Without `--env` (PR CI, which never writes one) this is skipped.
 *
 * Usage: node scripts/check-web-export.mjs [--env=<dev|beta|prod>]
 * Exits 0 (OK) or 1 (reject the deploy).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const distDir = join(repoRoot, 'apps', 'mobile', 'dist');
const jsDir = join(distDir, '_expo', 'static', 'js', 'web');

// TurboModuleRegistry.getEnforcing("Name") — the string-literal call a native
// module makes at load. The rn-web stub's own `getEnforcing=function` and its
// `getEnforcing(...)` error string do NOT match `getEnforcing("`.
const NATIVE_CALL = /getEnforcing\("([^"]+)"/g;

/** Problems with the exported document head, as human-readable strings. */
export function checkIndexHtml(html) {
  const problems = [];
  if (!/<html[^>]*\blang="es"/.test(html)) {
    problems.push(
      'index.html is not lang="es" — Chrome offers to translate a Spanish page. The head ' +
        'comes from apps/mobile/public/index.html; app/+html.tsx is ignored in single-page output.',
    );
  }
  if (!/<meta name="apple-itunes-app" content="app-id=\d+"/.test(html)) {
    problems.push(
      'index.html has no apple-itunes-app tag — SmartAppBanner defers to Safari\'s own bar on ' +
        'iOS, so without it iOS Safari visitors get no install offer at all.',
    );
  }
  return problems;
}

/** Problems with the robots.txt placed for `env`, as human-readable strings. */
export function checkRobotsTxt(txt, env) {
  if (txt === null) return [`no robots.txt in the export — run write-robots.mjs ${env} before building.`];
  const blocksAll = /^Disallow: \/$/m.test(txt);
  if (env === 'prod' && blocksAll) return ['prod robots.txt disallows the whole site.'];
  if (env !== 'prod' && !blocksAll) {
    return [`${env} robots.txt does not disallow everything — only prod may be indexed.`];
  }
  return [];
}

async function readOrNull(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function checkDocument(env) {
  const html = await readOrNull(join(distDir, 'index.html'));
  const problems = html === null ? ['no index.html in the export.'] : checkIndexHtml(html);
  if (env) problems.push(...checkRobotsTxt(await readOrNull(join(distDir, 'robots.txt')), env));
  return problems;
}

async function main() {
  const envArg = process.argv.slice(2).find((a) => a.startsWith('--env='));
  const env = envArg ? envArg.slice('--env='.length) : null;
  if (env !== null && !['dev', 'beta', 'prod'].includes(env)) {
    console.error(`check-web-export: unknown --env=${env} (expected dev, beta or prod).`);
    process.exit(2);
  }
  const documentProblems = await checkDocument(env);
  if (documentProblems.length > 0) {
    console.error('check-web-export: the exported document is wrong:\n');
    for (const p of documentProblems) console.error(`  - ${p}`);
    console.error('\nDeploy rejected.');
    process.exit(1);
  }

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
    console.log(
      `check-web-export: OK (${entries.length} bundle(s), no native TurboModule leaked; ` +
        `head ok${env ? `; ${env} robots.txt ok` : ''})`,
    );
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
