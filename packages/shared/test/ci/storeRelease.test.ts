import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Google Play's "12 testers for 14 continuous days before production" rule is
// scoped to a PACKAGE NAME. Submitting the `com.cultuvilla.app.beta` build to a
// closed track would burn two weeks and earn nothing toward releasing
// `com.cultuvilla.app`. The release pipeline therefore builds ONE artifact from
// the `production` profile and promotes it across tracks.
//
// These are invariant tests in the spirit of conformanceGate.test.ts: they fail
// the build if that arrangement is quietly undone. See
// docs/plans/ongoing/store-release.md.

// Only the fields these invariants actually assert on — this is a lens over
// eas.json, not a mirror of its schema.
interface EasConfig {
  cli: { appVersionSource: string };
  build: Record<
    string,
    {
      environment?: string;
      autoIncrement?: boolean;
      distribution?: string;
      developmentClient?: boolean;
      channel?: string;
      env?: Record<string, string>;
      android?: { buildType?: string };
    }
  >;
  submit: Record<
    string,
    { android: { track: string; applicationId: string; serviceAccountKeyPath: string } }
  >;
}

interface AssetLinks {
  target: { package_name: string; sha256_cert_fingerprints: string[] };
}

interface AppleAppSiteAssociation {
  applinks: { details: { appID: string }[] };
}

const repoRoot = resolve(__dirname, '../../../..');
const easJson = JSON.parse(
  readFileSync(resolve(repoRoot, 'apps/mobile/eas.json'), 'utf-8'),
) as EasConfig;
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/mobile-release.yml'), 'utf-8');

const PROD_PACKAGE = 'com.cultuvilla.app';
const appConfig = readFileSync(resolve(repoRoot, 'apps/mobile/app.config.ts'), 'utf-8');

describe('Play submit profiles', () => {
  const submitProfiles = ['internal', 'closed', 'production'] as const;

  it.each(submitProfiles)('%s targets the production package, not a per-env one', (profile) => {
    expect(easJson.submit[profile].android.applicationId).toBe(PROD_PACKAGE);
  });

  it('maps each profile to the Play track its name implies', () => {
    // `alpha` is the Play API's name for the closed-testing track — the one the
    // 14-day clock runs on.
    expect(easJson.submit.internal.android.track).toBe('internal');
    expect(easJson.submit.closed.android.track).toBe('alpha');
    expect(easJson.submit.production.android.track).toBe('production');
  });

  it.each(submitProfiles)('%s reads the gitignored service-account key path', (profile) => {
    // Must stay matched by the repo-wide *service-account*.json gitignore rule,
    // and by the filename mobile-release.yml writes the secret to.
    expect(easJson.submit[profile].android.serviceAccountKeyPath).toBe(
      './google-play-service-account.json',
    );
    expect(workflow).toContain('apps/mobile/google-play-service-account.json');
  });
});

describe('non-prod builds never reach a store', () => {
  // The load-bearing invariant, and the reason the release pipeline looks the
  // way it does: a separate package is a separate INSTALL, so a tester moving
  // from a `.beta` store build to the prod one gets a second app rather than an
  // update — new FCM token, new Google Sign-In Android OAuth client, unverified
  // App Links, two icons. Every Play track ships the same com.cultuvilla.app
  // artifact precisely so that migration never has to exist.
  // See docs/decisions/store-tracks-share-prod.md.
  const nonProdBuildProfiles = Object.entries(easJson.build).filter(
    ([, profile]) => profile.env?.APP_ENV !== undefined && profile.env.APP_ENV !== 'prod',
  );

  it('has non-prod build profiles at all (otherwise the checks below are vacuous)', () => {
    expect(nonProdBuildProfiles.length).toBeGreaterThan(0);
  });

  it('submits nothing but the production package', () => {
    const submitted = new Set(
      Object.values(easJson.submit).map((profile) => profile.android.applicationId),
    );
    expect(submitted).toEqual(new Set([PROD_PACKAGE]));
  });

  it.each(nonProdBuildProfiles.map(([name]) => name))(
    '%s is internal-distribution — it cannot be handed to a store',
    (name) => {
      expect(easJson.build[name].distribution).toBe('internal');
    },
  );

  it('keeps every non-prod APP_ENV off the release workflow', () => {
    // mobile-release.yml builds --profile production only; if a second profile
    // ever appears there, the build-invocation test above catches it. This one
    // catches the subtler version: the workflow overriding APP_ENV directly.
    expect(workflow).not.toMatch(/APP_ENV:\s*(dev|beta)\b/);
  });
});

describe('per-env application identity', () => {
  it('gives each env its own identifier, prod bare', () => {
    // The `.dev` / `.beta` identifiers exist for sideloading — installing a
    // non-prod build alongside the store app. They are only safe because
    // nothing submits them (asserted above).
    expect(appConfig).toContain("dev: 'com.cultuvilla.app.dev'");
    expect(appConfig).toContain("beta: 'com.cultuvilla.app.beta'");
    expect(appConfig).toContain(`prod: '${PROD_PACKAGE}'`);
  });

  it('labels non-prod builds so a sideloaded icon is identifiable', () => {
    expect(appConfig).toContain("dev: 'Cultuvilla Dev'");
    expect(appConfig).toContain("beta: 'Cultuvilla Beta'");
  });
});

describe('production build profile', () => {
  it('emits an app bundle — Play rejects APKs for new applications', () => {
    expect(easJson.build.production.android.buildType).toBe('app-bundle');
  });

  it('sources its Firebase config from the EAS production environment', () => {
    // app.config.ts is evaluated on the EAS build server, where neither .env nor
    // GitHub Environment vars exist. Without this the prod bundle would ship
    // empty Firebase credentials and fail at runtime, not at build time.
    expect(easJson.build.production.environment).toBe('production');
    expect(easJson.build.production.env.APP_ENV).toBe('prod');
  });

  it('auto-increments the remote version counter', () => {
    expect(easJson.build.production.autoIncrement).toBe(true);
    expect(easJson.cli.appVersionSource).toBe('remote');
  });
});

describe('mobile-release workflow', () => {
  it('builds every track from the single production profile', () => {
    const buildInvocations = [...workflow.matchAll(/eas build \\?\s*\n?\s*--profile (\S+)/g)].map(
      (m) => m[1],
    );
    expect(buildInvocations.length).toBeGreaterThan(0);
    expect(new Set(buildInvocations)).toEqual(new Set(['production']));
  });

  it('routes the chosen track into the submit profile', () => {
    expect(workflow).toContain('--auto-submit-with-profile {0}');
    expect(workflow).toContain('inputs.track');
  });

  it('never triggers automatically — publishing is an explicit decision', () => {
    const triggers = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\njobs:'));
    expect(triggers).toContain('workflow_dispatch');
    expect(triggers).not.toContain('push:');
    expect(triggers).not.toContain('pull_request:');
  });
});

describe('prod deep-link association files', () => {
  // Signing identities are public — they ship in world-readable files — so they
  // are committed rather than substituted at deploy time. What can silently
  // break is drift: if these stop naming the same app the submit profiles push
  // to, a shared link stops opening the app with no error message anywhere.
  const wellKnown = resolve(repoRoot, 'apps/mobile/public/.well-known/prod');
  const [assetLink] = JSON.parse(
    readFileSync(resolve(wellKnown, 'assetlinks.json'), 'utf-8'),
  ) as AssetLinks[];
  const association = JSON.parse(
    readFileSync(resolve(wellKnown, 'apple-app-site-association'), 'utf-8'),
  ) as AppleAppSiteAssociation;

  it('delegates to the same package the submit profiles target', () => {
    expect(assetLink.target.package_name).toBe(PROD_PACKAGE);
  });

  it('carries a real app signing fingerprint, not a placeholder', () => {
    // Play re-signs every AAB, so the certificate reaching a device is the app
    // signing key from Play Console — never the upload key EAS signed with.
    expect(assetLink.target.sha256_cert_fingerprints).toHaveLength(1);
    expect(assetLink.target.sha256_cert_fingerprints[0]).toMatch(
      /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/,
    );
  });

  it('pairs a real Apple Team ID with the same bundle identifier', () => {
    expect(association.applinks.details[0].appID).toMatch(
      new RegExp(`^[A-Z0-9]{10}\\.${PROD_PACKAGE.replace(/\./g, '\\.')}$`),
    );
  });
});

// The beta branch auto-builds and submits to the CLOSED track
// (.github/workflows/beta-build-and-submit.yml). Closed testing is not a public
// release, and Play's "12 testers for 14 continuous days" clock only advances
// while testers actually have builds — so this one step is automated while
// production stays an explicit decision.
describe('beta auto-submit workflow', () => {
  const wf = readFileSync(
    resolve(__dirname, '../../../..', '.github/workflows/beta-build-and-submit.yml'),
    'utf8',
  );

  it('triggers on beta and never on main', () => {
    expect(wf).toMatch(/branches:\s*\[beta\]/);
    expect(wf).not.toMatch(/branches:\s*\[[^\]]*main/);
  });

  // Play's closed-testing requirement is per package name, so a
  // com.cultuvilla.app.beta build earns nothing toward com.cultuvilla.app.
  it('builds the production profile, not a beta-package profile', () => {
    expect(wf).toMatch(/--profile production/);
    expect(wf).not.toMatch(/--profile preview-beta/);
  });

  it('submits to the closed track by default', () => {
    expect(wf).toMatch(/--auto-submit-with-profile/);
    expect(wf).toMatch(/inputs\.track \|\| 'closed'/);
  });

  // A GitHub `environment` here would be rejected outright: the Production
  // environment's branch policy allows only `main`.
  it('does not scope itself to a GitHub environment', () => {
    expect(wf).not.toMatch(/^\s*environment:/m);
  });

  it('deletes the service account key even when the build fails', () => {
    expect(wf).toMatch(/if: always\(\)[\s\S]*rm -f apps\/mobile\/google-play-service-account\.json/);
  });
});
