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
