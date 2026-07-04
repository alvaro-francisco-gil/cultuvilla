/**
 * Per-environment admin-SDK credentials.
 *
 * The single place that maps an environment alias (dev/beta/prod) to its
 * Firebase project and a credential, then initializes firebase-admin against it.
 * Any ad-hoc admin-SDK script (grants, backfills, one-off cleanups) that targets
 * a specific environment goes through here rather than re-resolving credentials.
 *
 * CREDENTIAL STORE — everything lives OUTSIDE the repo, under ~/.config/cultuvilla
 * (dir chmod 700, each file chmod 600). Resolution order per env:
 *
 *   1. GOOGLE_APPLICATION_CREDENTIALS override (a file path; any credential type).
 *   2. ~/.config/cultuvilla/<env>-sa.json   — a service-account KEY for that env.
 *   3. ~/.config/cultuvilla/adc.json        — a stored user/ADC credential that
 *                                             covers every env its principal can
 *                                             access (dev/beta/prod).
 *   4. The system default ADC (~/.config/gcloud/application_default_credentials.json).
 *
 * WHY adc.json — beta/prod enforce `iam.disableServiceAccountKeyCreation` (Google
 * secure-by-default since May 2024), so downloaded SA keys can't be created there.
 * The keyless path is user ADC from a project Owner. But the SYSTEM default ADC is
 * a single global file that every `gcloud auth application-default login` (for any
 * project) overwrites — so we capture the cultuvilla login into a dedicated,
 * persistent adc.json that other projects' logins never clobber. One login, ever.
 *
 * One-time setup (see docs/ENVIRONMENTS.md):
 *   gcloud auth application-default login            # sign in as a cultuvilla Owner
 *   gcloud auth application-default set-quota-project cultuvilla-beta
 *   cp ~/.config/gcloud/application_default_credentials.json ~/.config/cultuvilla/adc.json
 *   chmod 600 ~/.config/cultuvilla/adc.json
 *
 * The projectId is always pinned in code, so the same adc.json serves all envs.
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

export const ENVS = {
  dev: { project: 'villa-events' },
  beta: { project: 'cultuvilla-beta' },
  prod: { project: 'cultuvilla-prod' },
};

export const CRED_DIR = path.join(os.homedir(), '.config', 'cultuvilla');
export const ADC_PATH = path.join(CRED_DIR, 'adc.json');

/** dev|beta|prod, given either the alias or the full project id. Throws if unknown. */
export function resolveEnv(aliasOrProject) {
  if (!aliasOrProject) throw new Error('Missing env. One of: ' + Object.keys(ENVS).join(', '));
  if (ENVS[aliasOrProject]) return aliasOrProject;
  const byProject = Object.keys(ENVS).find((e) => ENVS[e].project === aliasOrProject);
  if (byProject) return byProject;
  throw new Error(
    `Unknown env/project "${aliasOrProject}". Envs: ${Object.keys(ENVS).join(', ')}; ` +
      `projects: ${Object.values(ENVS).map((v) => v.project).join(', ')}.`,
  );
}

export function keyPathForEnv(env) {
  return path.join(CRED_DIR, `${env}-sa.json`);
}

/** Pick the credential file for this env, or null to use the system default ADC. */
function resolveCredentialPath(env) {
  const override = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (override) return override;
  const saKey = keyPathForEnv(env);
  if (existsSync(saKey)) return saKey;
  if (existsSync(ADC_PATH)) return ADC_PATH;
  return null;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read credentials at ${file}: ${err.message}`);
  }
}

/**
 * Initialize firebase-admin for the given env (alias or project id) and return
 * { app, env, projectId, credPath, auth }. `auth` is 'service-account-key',
 * 'adc-file', or 'adc-default'.
 */
export function initAdminForEnv(aliasOrProject) {
  const env = resolveEnv(aliasOrProject);
  const { project } = ENVS[env];
  const credPath = resolveCredentialPath(env);

  // System default ADC — no explicit credential file.
  if (!credPath) {
    const app = admin.initializeApp({ projectId: project });
    return { app, env, projectId: project, credPath: null, auth: 'adc-default' };
  }

  const cred = readJson(credPath);

  // A service-account KEY: use cert() and verify it targets the right project.
  if (cred.type === 'service_account') {
    if (cred.project_id !== project) {
      throw new Error(
        `Key at ${credPath} is for project "${cred.project_id}" but env "${env}" expects "${project}".\n` +
          `       Refusing to run to avoid touching the wrong environment.`,
      );
    }
    const app = admin.initializeApp({ credential: admin.credential.cert(cred), projectId: project });
    return { app, env, projectId: project, credPath, auth: 'service-account-key' };
  }

  // Any other credential type (authorized_user, impersonated, external_account):
  // route it through Application Default Credentials by pointing at the file.
  // User/ADC creds carry no project_id — projectId is pinned here instead.
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  const app = admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: project });
  return { app, env, projectId: project, credPath, auth: 'adc-file' };
}
