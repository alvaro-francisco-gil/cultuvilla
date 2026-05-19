#!/usr/bin/env node
/**
 * Starts the Firebase emulator suite in the background, waits for ports,
 * runs the requested test command, then shuts the emulators down.
 *
 * Usage:
 *   node scripts/run-tests-with-emulators.mjs <command...>
 *
 * Examples:
 *   node scripts/run-tests-with-emulators.mjs pnpm --filter @cultuvilla/shared test:integration
 *   node scripts/run-tests-with-emulators.mjs pnpm --filter @cultuvilla/shared test:rules
 *   node scripts/run-tests-with-emulators.mjs pnpm test:functions
 *
 * Env:
 *   TEST_PROJECT_ID   Project id passed to the emulator (default: cultuvilla-test)
 *   ONLY              Comma list passed to `firebase emulators:start --only`
 *                     (default: auth,firestore,functions,storage)
 *   WAIT_TIMEOUT_MS   Per-port wait timeout (default: 180000)
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || 'cultuvilla-test';
const ONLY = process.env.ONLY || 'auth,firestore,functions,storage';
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 180_000);
const WAIT_INTERVAL_MS = 500;

const PORTS_BY_SERVICE = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  storage: 9199,
};
const portsToWaitFor = ONLY.split(',').map((s) => PORTS_BY_SERVICE[s.trim()]).filter(Boolean);

const testArgs = process.argv.slice(2);
if (testArgs.length === 0) {
  console.error('Usage: run-tests-with-emulators.mjs <test command...>');
  process.exit(2);
}

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryOnce = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        return;
      }
      const sock = new net.Socket();
      sock.setTimeout(2000);
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => { sock.destroy(); setTimeout(tryOnce, WAIT_INTERVAL_MS); });
      sock.once('timeout', () => { sock.destroy(); setTimeout(tryOnce, WAIT_INTERVAL_MS); });
      sock.connect(port, '127.0.0.1');
    };
    tryOnce();
  });
}

const emulatorEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001',
  GCLOUD_PROJECT: TEST_PROJECT_ID,
  TEST_PROJECT_ID,
};

console.log(`[emulators] starting (project=${TEST_PROJECT_ID}, only=${ONLY})`);
const emu = spawn(
  'firebase',
  ['emulators:start', '--project', TEST_PROJECT_ID, '--only', ONLY],
  { cwd: ROOT, env: emulatorEnv, stdio: ['ignore', 'inherit', 'inherit'] },
);

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!emu.killed) {
    emu.kill('SIGINT');
  }
  // Give the emulator a moment to flush, then exit.
  setTimeout(() => process.exit(code ?? 0), 1500);
}
process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

emu.once('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[emulators] exited unexpectedly (code=${code})`);
    process.exit(code ?? 1);
  }
});

try {
  await Promise.all(portsToWaitFor.map((p) => waitForPort(p, WAIT_TIMEOUT_MS)));
  console.log(`[emulators] ready on ports ${portsToWaitFor.join(', ')}`);
} catch (err) {
  console.error('[emulators] failed to start:', err.message);
  shutdown(1);
  process.exit(1);
}

const [cmd, ...rest] = testArgs;
console.log(`[tests] running: ${cmd} ${rest.join(' ')}`);
const tests = spawn(cmd, rest, { cwd: ROOT, env: emulatorEnv, stdio: 'inherit' });
tests.once('exit', (code) => shutdown(code ?? 0));
