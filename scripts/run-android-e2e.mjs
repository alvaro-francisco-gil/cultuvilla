#!/usr/bin/env node
/**
 * Run the native (Maestro) Android E2E suite against a booted AVD.
 *
 * The counterpart of the web suite's Playwright runner. It is deliberately NOT
 * responsible for the Firebase emulators — `pnpm test:e2e:android` wraps it in
 * scripts/run-tests-with-emulators.mjs, exactly as `test:e2e:web` wraps
 * Playwright, so both drivers share one emulator boot and one seeding step.
 *
 * What it does own:
 *   1. proving a device is actually attached (a missing AVD otherwise surfaces
 *      as an opaque Maestro timeout minutes later),
 *   2. installing the APK under test when one is named,
 *   3. running the suite with a JUnit report so CI can render failures.
 *
 * Usage:
 *   node scripts/run-android-e2e.mjs [--apk <path>] [--flow <name>]
 *
 * Env:
 *   E2E_ANDROID_APK   APK to install first (same as --apk). Omit to test
 *                     whatever build is already on the device.
 *   ADB               adb binary (default `adb`). Under WSL2 the emulator runs
 *                     on the Windows host, so this must be the Windows
 *                     adb.exe — see the drive-android-avd skill.
 *   MAESTRO_BIN       maestro binary (default `maestro`).
 *   E2E_NATIVE_FLOW   Single flow file to run (same as --flow). Useful for
 *                     iterating on one flow under `pnpm test:e2e:android`,
 *                     which owns the emulator boot and takes no extra args.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_DIR = path.join(ROOT, 'apps', 'mobile', 'e2e', 'native');
const FLOWS_DIR = path.join(SUITE_DIR, 'flows');
const REPORT_DIR = path.join(SUITE_DIR, 'report');

const ADB = process.env.ADB || 'adb';
const MAESTRO = process.env.MAESTRO_BIN || 'maestro';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const apk = arg('apk') ?? process.env.E2E_ANDROID_APK;
const flow = arg('flow') ?? process.env.E2E_NATIVE_FLOW;

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (res.error) {
    console.error(`[android-e2e] failed to spawn ${cmd}: ${res.error.message}`);
    process.exit(1);
  }
  return res.status ?? 1;
}

// 1. A device must be attached BEFORE anything else — the failure mode we are
//    avoiding is a five-minute Maestro hang that says nothing about the cause.
const devices = spawnSync(ADB, ['devices'], { encoding: 'utf8' });
if (devices.status !== 0) {
  console.error(
    `[android-e2e] \`${ADB} devices\` failed. Set ADB to a working adb binary ` +
      '(under WSL2 that is the Windows-side adb.exe — see the drive-android-avd skill).',
  );
  process.exit(1);
}
const attached = devices.stdout
  .split('\n')
  .slice(1)
  .filter((l) => /\tdevice$/.test(l.trim()));
if (attached.length === 0) {
  console.error('[android-e2e] no Android device/emulator attached. Boot an AVD first.');
  console.error(devices.stdout.trim());
  process.exit(1);
}
console.log(`[android-e2e] device: ${attached[0].split('\t')[0]}`);

// 2. Install the build under test. `-r` so a re-run over an existing install
//    updates in place; `-d` allows a downgrade when re-testing an older commit.
if (apk) {
  const apkPath = path.resolve(ROOT, apk);
  if (!existsSync(apkPath)) {
    console.error(`[android-e2e] APK not found: ${apkPath}`);
    process.exit(1);
  }
  console.log(`[android-e2e] installing ${apkPath}`);
  const code = run(ADB, ['install', '-r', '-d', apkPath]);
  if (code !== 0) process.exit(code);
}

// 3. Run the flows IN FILENAME ORDER, one `maestro test` per flow.
//
//    Maestro's workspace mode does not guarantee the order it discovers flows
//    in, and this suite depends on it: 22 unregisters what 20 registered. A
//    reshuffle would turn a healthy suite red for reasons that have nothing to
//    do with the app. Driving the order here also gives one JUnit report per
//    flow, so a CI failure names the flow instead of the workspace.
//
//    A failing flow does NOT stop the run: the rest of the suite is still worth
//    knowing about, and a cascade (22 failing because 20 did) is itself the
//    diagnosis.
mkdirSync(REPORT_DIR, { recursive: true });
const flows = flow
  ? [flow]
  : readdirSync(FLOWS_DIR)
      .filter((f) => f.endsWith('.yaml'))
      .sort();

const failed = [];
for (const name of flows) {
  console.log(`\n[android-e2e] ─── ${name} ───`);
  const status = run(MAESTRO, [
    'test',
    path.join(FLOWS_DIR, name),
    '--format',
    'junit',
    '--output',
    path.join(REPORT_DIR, `${name.replace(/\.yaml$/, '')}.xml`),
  ]);
  if (status !== 0) failed.push(name);
}

if (failed.length > 0) {
  console.error(`\n[android-e2e] ${failed.length}/${flows.length} flow(s) failed:`);
  for (const name of failed) console.error(`  - ${name}`);
  process.exit(1);
}
console.log(`\n[android-e2e] all ${flows.length} flow(s) passed`);
