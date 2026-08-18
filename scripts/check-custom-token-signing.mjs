#!/usr/bin/env node
/**
 * check-custom-token-signing.mjs
 *
 * Read-only preflight: asserts the Cloud Functions runtime service account of
 * the target env can mint custom tokens — i.e. it holds
 * `roles/iam.serviceAccountTokenCreator` on ITSELF.
 *
 * WHY THIS EXISTS
 *   `getAuth().createCustomToken(uid)` does not sign locally. The admin SDK asks
 *   the IAM Credentials API to sign the JWT *as the caller's own identity*, which
 *   requires `iam.serviceAccounts.signBlob` on the caller. The Firebase CLI does
 *   NOT grant that at deploy time (unlike secret accessor bindings, which it
 *   does auto-grant), so a project whose functions run as the compute default SA
 *   can deploy perfectly and still fail every custom-token call at runtime with:
 *
 *     FirebaseAuthError: Permission 'iam.serviceAccounts.signBlob' denied
 *     errorInfo: { code: 'auth/insufficient-permission' }
 *
 *   That is exactly how email-code sign-in (`verifyAuthOtpCode`) shipped broken
 *   to production: the OTP email sent fine, the code matched fine, and then the
 *   final `createCustomToken` threw a 500 on every single attempt. No test could
 *   catch it — the Auth emulator signs custom tokens with a stub and never
 *   touches IAM, so the emulator-backed suites pass against a broken project.
 *   The failure only exists in real deployed infrastructure, which is why this
 *   is a deploy-time infrastructure gate and not a unit test.
 *
 * USAGE
 *   node scripts/check-custom-token-signing.mjs --env dev|beta|prod
 *   (or: pnpm check:custom-token-signing -- --env prod)
 *
 * Exits non-zero when the binding is missing, printing the exact remediation
 * command, so it is CI-wireable as a pre-deploy gate.
 *
 * PERMISSIONS
 *   Needs `iam.serviceAccounts.getIamPolicy` on the runtime SA and
 *   `resourcemanager.projects.get` on the project. In CI the WIF deployer SA
 *   (`gha-deployer@<project>`) gets these via `roles/iam.serviceAccountViewer`,
 *   granted by scripts/setup-ci-deploy-wif.sh.
 */

import { pathToFileURL } from 'node:url';
import admin from 'firebase-admin';
import { ENVS, resolveEnv } from './lib/env-credentials.mjs';

export const ROLE = 'roles/iam.serviceAccountTokenCreator';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

/**
 * Deliberately not initAdminForEnv: this check talks to the IAM and Resource
 * Manager REST APIs, not Firestore, so it needs a raw access token rather than an
 * initialized app. Application Default Credentials cover both callers — the WIF
 * auth action in CI and the operator's stored adc.json (see env-credentials.mjs).
 */
async function accessToken() {
  const { access_token: token } = await admin.credential.applicationDefault().getAccessToken();
  return token;
}

async function apiFetch(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message ?? `HTTP ${res.status} from ${url}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function projectNumber(token, projectId) {
  const body = await apiFetch(
    token,
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`,
  );
  if (!body.projectNumber) {
    throw new Error(`No projectNumber in Resource Manager response for ${projectId}`);
  }
  return body.projectNumber;
}

async function saIamPolicy(token, projectId, saEmail) {
  return apiFetch(
    token,
    `https://iam.googleapis.com/v1/projects/${projectId}` +
      `/serviceAccounts/${encodeURIComponent(saEmail)}:getIamPolicy`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  );
}

export function selfSignBindingExists(policy, saEmail) {
  const member = `serviceAccount:${saEmail}`;
  return (policy.bindings ?? []).some(
    (b) => b.role === ROLE && (b.members ?? []).includes(member),
  );
}

function remediation(projectId, saEmail) {
  return [
    'gcloud iam service-accounts add-iam-policy-binding \\',
    `  ${saEmail} \\`,
    `  --member="serviceAccount:${saEmail}" \\`,
    `  --role="${ROLE}" --project=${projectId}`,
  ].join('\n');
}

async function main() {
  const env = resolveEnv(argValue('--env') ?? 'dev');
  const projectId = ENVS[env].project;

  const token = await accessToken();
  const number = await projectNumber(token, projectId);
  // Functions declare no custom `serviceAccount`, so they run as the Compute
  // Engine default SA. If that ever changes, resolve the SA from the deployed
  // service instead of assuming this default.
  const saEmail = `${number}-compute@developer.gserviceaccount.com`;

  console.log(`Custom-token signing check: ${env} (${projectId})`);
  console.log(`  runtime service account: ${saEmail}`);

  const policy = await saIamPolicy(token, projectId, saEmail);

  if (!selfSignBindingExists(policy, saEmail)) {
    console.error(
      `\n✖ ${saEmail} is MISSING ${ROLE} on itself.\n\n` +
        `  Every getAuth().createCustomToken() call in ${projectId} will fail at\n` +
        `  runtime with auth/insufficient-permission (signBlob denied). Sign-in\n` +
        `  paths that mint custom tokens — e.g. verifyAuthOtpCode — will 500.\n\n` +
        `  Fix:\n\n${remediation(projectId, saEmail)}\n`,
    );
    process.exit(1);
  }

  console.log(`  ✔ holds ${ROLE} on itself — createCustomToken can sign.`);
}

function reportAndExit(err) {
  if (err?.status === 403 || err?.status === 401) {
    console.error(
      `\n✖ Denied reading IAM state (HTTP ${err.status}).\n\n` +
        `  This check needs iam.serviceAccounts.getIamPolicy and\n` +
        `  resourcemanager.projects.get. Grant the calling principal\n` +
        `  roles/iam.serviceAccountViewer on the project.\n\n` +
        `  If you are authenticating with a ~/.config/cultuvilla/<env>-sa.json\n` +
        `  service-account KEY, try again with it unset — firebase-admin scopes\n` +
        `  key credentials narrowly, whereas the stored adc.json covers these APIs.\n\n` +
        `  Details: ${err.message}\n`,
    );
  } else {
    console.error(`\n✖ Check failed: ${err.message}\n`);
  }
  process.exit(1);
}

// Only run when invoked as a script — the predicate above is imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(reportAndExit);
}
