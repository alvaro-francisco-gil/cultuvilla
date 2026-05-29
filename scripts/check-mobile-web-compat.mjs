#!/usr/bin/env node
/**
 * Static check for the known apps/mobile/ web-compat anti-patterns codified
 * in .claude/skills/mobile-web-compat/SKILL.md. Runs as part of mobile-ci so
 * the build fails when one of these regressions lands.
 *
 * Detects:
 *   1. `Alert.alert(` calls without a `Platform.OS === 'web'` guard nearby
 *      (RN-Web 0.21 ships Alert.alert as a no-op — silent on web).
 *   2. `className=` on an `Animated.*` JSX element (NativeWind 4 silently
 *      strips className on the web target, so styles must go on `style`).
 *   3. `tabBarStyle:` inside a `screenOptions` block without a `Platform`
 *      guard or `webSpread/webOnly` helper anywhere in the file (a
 *      cross-platform tab-bar override usually means an Android regression
 *      — see commit 69dded8 vs 6168e7d for the post-mortem).
 *
 * Exits 0 with "OK" if clean, 1 with a list of violations otherwise. Each
 * violation cites file:line and a hint pointing back at the skill section.
 *
 * To allowlist a specific call (e.g. an admin-only screen the web build
 * never reaches), add the comment `// mobile-web-compat: native-only`
 * on the line ABOVE the call.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const mobileRoot = join(repoRoot, 'apps', 'mobile');

const ALLOWLIST_COMMENT = 'mobile-web-compat: native-only';

/** Files to scan: every .ts/.tsx under apps/mobile except tests, dist, native. */
function listSourceFiles() {
  const out = execSync(
    `git ls-files -- 'apps/mobile/**/*.ts' 'apps/mobile/**/*.tsx'`,
    { cwd: repoRoot, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !p.includes('__tests__/'))
    .filter((p) => !p.endsWith('.d.ts'))
    .filter((p) => !p.startsWith('apps/mobile/android/'))
    .filter((p) => !p.startsWith('apps/mobile/ios/'))
    .filter((p) => !p.startsWith('apps/mobile/dist/'));
}

/** Did the line immediately above carry the allowlist comment? */
function isAllowlisted(lines, idx) {
  for (let j = idx - 1; j >= Math.max(0, idx - 3); j--) {
    if (lines[j].includes(ALLOWLIST_COMMENT)) return true;
    if (lines[j].trim() === '') continue;
    if (lines[j].trim().startsWith('//')) continue;
    return false;
  }
  return false;
}

/** Is there a Platform.OS check within `window` lines above this line? */
function hasPlatformGuardAbove(lines, idx, window = 8) {
  for (let j = idx - 1; j >= Math.max(0, idx - window); j--) {
    if (/Platform\.OS\s*===\s*['"]web['"]/.test(lines[j])) return true;
    if (/Platform\.OS\s*!==\s*['"]web['"]/.test(lines[j])) return true;
    if (/Platform\.select\s*\(/.test(lines[j])) return true;
  }
  return false;
}

/** Does the file import or use webOnly / webSpread / nativeOnly? */
function fileUsesPlatformHelper(source) {
  return /\b(webOnly|webSpread|nativeOnly|isWeb)\b/.test(source);
}

const violations = [];

for (const path of listSourceFiles()) {
  if (path.endsWith('lib/platform.ts')) continue;
  const abs = join(repoRoot, path);
  const source = await readFile(abs, 'utf8');
  const lines = source.split('\n');
  const usesHelper = fileUsesPlatformHelper(source);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1) Alert.alert without a Platform.OS guard
    if (/\bAlert\.alert\s*\(/.test(line) && !isAllowlisted(lines, i)) {
      if (!hasPlatformGuardAbove(lines, i) && !usesHelper) {
        violations.push({
          path,
          line: i + 1,
          rule: 'Alert.alert',
          excerpt: line.trim(),
          hint: "Alert.alert is a no-op on RN-Web. Branch on Platform.OS === 'web' and use window.confirm/alert, or annotate the call with `// mobile-web-compat: native-only` if the surface isn't exercised on web.",
        });
      }
    }

    // 2) className on an Animated.* JSX element. We catch the opening tag
    // line and assume className lives within ~5 lines of it.
    if (/<Animated\.[A-Z]\w*\b/.test(line)) {
      const tagOpenIdx = i;
      let tagCloseIdx = i;
      for (let j = i; j < Math.min(lines.length, i + 15); j++) {
        if (/\/?>/.test(lines[j].trim().slice(-2))) {
          tagCloseIdx = j;
          break;
        }
      }
      const tag = lines.slice(tagOpenIdx, tagCloseIdx + 1).join('\n');
      if (/\bclassName\s*=/.test(tag) && !isAllowlisted(lines, tagOpenIdx)) {
        violations.push({
          path,
          line: tagOpenIdx + 1,
          rule: 'className on Animated.*',
          excerpt: lines[tagOpenIdx].trim(),
          hint: "NativeWind 4 strips className on Animated.* on web. Move every style to the `style` prop (use raw hex from packages/shared/src/design-system/tokens/colors.ts).",
        });
      }
    }

    // 3) tabBarStyle: in screenOptions without any Platform guard or helper
    // anywhere in the file. Heuristic — gives one violation per file at most.
    if (/\btabBarStyle\s*:/.test(line)) {
      if (
        !hasPlatformGuardAbove(lines, i, 20) &&
        !usesHelper &&
        !isAllowlisted(lines, i)
      ) {
        violations.push({
          path,
          line: i + 1,
          rule: 'tabBarStyle without Platform gate',
          excerpt: line.trim(),
          hint: "tabBarStyle overrides hide the Android bar and crowd the iPhone home indicator. Wrap in webSpread({ ... }) from lib/platform.ts so native keeps the react-navigation defaults.",
        });
        break;
      }
    }
  }
}

if (violations.length === 0) {
  console.log('mobile-web-compat: OK (no violations)');
  process.exit(0);
}

console.error(`mobile-web-compat: ${violations.length} violation(s):\n`);
for (const v of violations) {
  console.error(`  ${v.path}:${v.line}  [${v.rule}]`);
  console.error(`    ${v.excerpt}`);
  console.error(`    hint: ${v.hint}\n`);
}
console.error(
  'See .claude/skills/mobile-web-compat/SKILL.md. To allowlist a specific\n' +
    'call, add `// mobile-web-compat: native-only` on the line above it.',
);
process.exit(1);
