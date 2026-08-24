#!/usr/bin/env node
/**
 * Verify the store-release runbook against live infrastructure.
 *
 * WHY THIS EXISTS. `docs/plans/ongoing/store-release.md` tracks state that lives
 * outside the repo — Play Console, GCP, EAS, GitHub secrets — and that state
 * drifts silently while the doc does not. On 2026-08-24 three of its claims were
 * wrong at once, and each cost real time chasing a non-problem:
 *
 *   1. "Android OAuth client pending" — it had been configured for weeks.
 *   2. "Play Console -> Setup -> API access" — that page is no longer required
 *      and may not exist; Google dropped the Cloud-project link requirement.
 *   3. "the org policy blocks key creation" — true of the org, but
 *      `cultuvilla-prod` has no parent and was never subject to it.
 *
 * A doc cannot notice it has gone stale. This can. Everything here is READ-ONLY
 * and prints no secret material — only whether a thing exists and whether two
 * values agree.
 *
 *   node scripts/check-store-release-claims.mjs
 *
 * Requires `gcloud auth login cultuvilla.app@gmail.com` (the only identity that
 * can see all three projects) and an authenticated `gh`. Missing tooling is
 * reported as SKIP, not failure — this is a drift detector, not a deploy gate.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROD = 'cultuvilla-prod';
const SA = `play-publisher@${PROD}.iam.gserviceaccount.com`;

let pass = 0;
let fail = 0;
let skip = 0;

const ok = (m, d) => { pass++; console.log(`  \x1b[32mPASS\x1b[0m ${m}${d ? ` — ${d}` : ''}`); };
const bad = (m, d) => { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${m}${d ? ` — ${d}` : ''}`); };
const meh = (m, d) => { skip++; console.log(`  \x1b[33mSKIP\x1b[0m ${m}${d ? ` — ${d}` : ''}`); };

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
/** Run a command, returning null instead of throwing when it fails. */
function trySh(cmd, args) {
  try {
    return sh(cmd, args);
  } catch {
    return null;
  }
}

console.log('\n\x1b[1mStore release — claims vs. live infrastructure\x1b[0m');

// ── GitHub secrets ────────────────────────────────────────────────────────
console.log('\nGitHub secrets');
const secrets = trySh('gh', ['secret', 'list']);
if (secrets === null) {
  meh('gh not authenticated', 'run `gh auth login`');
} else {
  for (const name of ['EXPO_TOKEN', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON']) {
    if (secrets.includes(name)) ok(`${name} is set`);
    else bad(`${name} is MISSING`, 'beta-build-and-submit will stop at its guard');
  }
}

// ── GCP / Play publisher ──────────────────────────────────────────────────
console.log('\nGoogle Cloud');
const account = trySh('gcloud', ['config', 'get-value', 'account']);
if (!account) {
  meh('gcloud not authenticated');
} else if (account !== 'cultuvilla.app@gmail.com') {
  meh(`active gcloud account is ${account}`, 'only cultuvilla.app@gmail.com sees all three projects');
} else {
  const saOk = trySh('gcloud', ['iam', 'service-accounts', 'describe', SA, `--project=${PROD}`, '--format=value(email)']);
  if (saOk === SA) ok('Play publisher service account exists', SA);
  else bad('Play publisher service account missing', SA);

  const api = trySh('gcloud', ['services', 'list', '--enabled', `--project=${PROD}`,
    '--filter=config.name:androidpublisher', '--format=value(config.name)']);
  if (api && api.includes('androidpublisher')) ok('Play Developer API enabled on ' + PROD);
  else bad('androidpublisher.googleapis.com NOT enabled on ' + PROD);

  // The claim that burned us: the org-wide key ban does not reach a project
  // that has no parent. Report the EFFECTIVE policy, not the org's.
  const parent = trySh('gcloud', ['projects', 'describe', PROD, '--format=value(parent.id)']);
  const enforced = trySh('gcloud', ['resource-manager', 'org-policies', 'describe',
    'iam.disableServiceAccountKeyCreation', `--project=${PROD}`, '--effective',
    '--format=value(booleanPolicy.enforced)']);
  ok(`${PROD} key-creation ban effective = ${enforced || 'unset'}`,
    parent ? `parent org ${parent}` : 'no parent org — outside any organization');
}

// ── App-signing fingerprints ──────────────────────────────────────────────
console.log('\nAndroid signing / Google Sign-In');
const assetlinksPath = resolve(ROOT, 'apps/mobile/public/.well-known/prod/assetlinks.json');
let committed = null;
try {
  const entries = JSON.parse(readFileSync(assetlinksPath, 'utf8'));
  committed = entries[0]?.target?.sha256_cert_fingerprints?.[0]?.toUpperCase() ?? null;
} catch {
  bad('cannot read prod/assetlinks.json', assetlinksPath);
}

const token = account === 'cultuvilla.app@gmail.com' ? trySh('gcloud', ['auth', 'print-access-token']) : null;
if (!token) {
  meh('skipping Firebase fingerprint check', 'needs gcloud auth as cultuvilla.app@gmail.com');
} else if (committed) {
  const appsRaw = trySh('curl', ['-s', '-H', `Authorization: Bearer ${token}`,
    '-H', `x-goog-user-project: ${PROD}`,
    `https://firebase.googleapis.com/v1beta1/projects/${PROD}/androidApps`]);
  const appId = appsRaw ? (JSON.parse(appsRaw).apps ?? [])[0]?.appId : null;
  if (!appId) {
    bad('no Android app registered in ' + PROD);
  } else {
    const shaRaw = trySh('curl', ['-s', '-H', `Authorization: Bearer ${token}`,
      '-H', `x-goog-user-project: ${PROD}`,
      `https://firebase.googleapis.com/v1beta1/projects/${PROD}/androidApps/${appId}/sha`]);
    const certs = shaRaw ? (JSON.parse(shaRaw).certificates ?? []) : [];
    const has1 = certs.some((c) => c.certType === 'SHA_1');
    const sha256 = certs.find((c) => c.certType === 'SHA_256')?.shaHash?.toUpperCase() ?? null;
    const colonised = sha256 ? sha256.match(/../g).join(':') : null;

    // A registered SHA-1 is what auto-creates the Android OAuth client, so
    // Google Sign-In working is equivalent to this being present.
    if (has1) ok('SHA-1 registered (this is what creates the Android OAuth client)');
    else bad('no SHA-1 registered', 'Google Sign-In will fail in store builds');

    if (colonised && colonised === committed) {
      ok('registered SHA-256 matches the Play app-signing key in assetlinks.json');
    } else {
      bad('SHA-256 MISMATCH — deep links or sign-in will break',
        `firebase=${colonised ?? 'none'} assetlinks=${committed}`);
    }
  }
}

// ── EAS production environment ────────────────────────────────────────────
console.log('\nEAS production environment');
const easEnv = trySh('bash', ['-lc',
  'cd apps/mobile && npx --yes eas-cli@latest env:list production 2>/dev/null | sed "s/\\x1b\\[[0-9;]*m//g"']);
if (!easEnv) {
  meh('could not read EAS env', 'needs EXPO_TOKEN in the environment');
} else {
  // app.config.ts is evaluated on the EAS build server, so a value missing here
  // silently disables the feature in the shipped binary.
  for (const key of ['GOOGLE_WEB_CLIENT_ID_PROD', 'FIREBASE_PROJECT_ID_PROD', 'FIREBASE_API_KEY_PROD']) {
    if (easEnv.includes(key)) ok(`${key} present`);
    else bad(`${key} MISSING from the EAS production environment`);
  }
}

console.log(`\n\x1b[1m${pass} pass · ${fail} fail · ${skip} skipped\x1b[0m`);
if (fail > 0) {
  console.log('\nA FAIL means docs/plans/ongoing/store-release.md may be out of date.');
  console.log('Fix the infrastructure or the doc — do not leave them disagreeing.\n');
}
process.exit(fail > 0 ? 1 : 0);
