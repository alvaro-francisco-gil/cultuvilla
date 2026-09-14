import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Android push registers through the native Firebase config in
// apps/mobile/google-services/<env>/google-services.json. A wrong file fails
// SILENTLY: the build succeeds, the app runs, and no Android device ever gets a
// push token — nothing errors anywhere a human would look. So the pairing of
// file → package → Firebase project is locked here.

const repoRoot = resolve(__dirname, '../../../..');
const dir = resolve(repoRoot, 'apps/mobile/google-services');

const EXPECTED = {
  dev: { packageName: 'com.cultuvilla.app.dev', projectId: 'villa-events' },
  beta: { packageName: 'com.cultuvilla.app.beta', projectId: 'cultuvilla-beta' },
  prod: { packageName: 'com.cultuvilla.app', projectId: 'cultuvilla-prod' },
} as const;

interface GoogleServices {
  project_info: { project_id: string };
  client: { client_info: { android_client_info: { package_name: string } } }[];
}

function load(env: keyof typeof EXPECTED): GoogleServices | null {
  const file = resolve(dir, env, 'google-services.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as GoogleServices) : null;
}

describe('Android google-services.json', () => {
  it('exists for prod — every Play track ships the prod build', () => {
    // docs/decisions/store-tracks-share-prod.md: a store tester IS a prod user,
    // so without this file no store install can receive push at all.
    expect(load('prod')).not.toBeNull();
  });

  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])(
    '%s, when present, belongs to its own Firebase project and package',
    (env) => {
      const config = load(env);
      if (!config) return; // beta builds are sideload-only; the file is optional there
      expect(config.project_info.project_id).toBe(EXPECTED[env].projectId);
      expect(config.client.map((c) => c.client_info.android_client_info.package_name)).toContain(
        EXPECTED[env].packageName,
      );
    },
  );

  it('matches the package ids app.config.ts builds each env with', () => {
    const appConfig = readFileSync(resolve(repoRoot, 'apps/mobile/app.config.ts'), 'utf8');
    for (const { packageName } of Object.values(EXPECTED)) {
      expect(appConfig).toContain(`'${packageName}'`);
    }
  });
});
