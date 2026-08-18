import { readFileSync } from 'fs';
import { join } from 'path';

import config from '../app.config';

// The EAS account + project this repo builds into. Pinned as literals rather
// than read from the environment: EAS_PROJECT_ID would be machine-global, and
// the dev machines also check out ordago-apps (owner `ordago-apps`). A stray
// export in a shell profile would have silently pointed one repo's builds at
// the other's EAS project — `owner` + `projectId` in the file make the routing
// per-repo by construction.
const EAS_OWNER = 'cultuvilla.app';
const EAS_PROJECT_ID = '53188e5f-c5a1-4b1c-a009-44108826d54d';

// The Apple team the app ships under. Not a secret — it is served publicly in
// every app's apple-app-site-association.
const APPLE_TEAM_ID = '78RB67NT38';

describe('app.config EAS identity', () => {
  it('pins the owning EAS account', () => {
    expect(config.owner).toBe(EAS_OWNER);
  });

  it('pins the EAS project id as a literal, not from the environment', () => {
    expect(config.extra?.['eas']).toMatchObject({ projectId: EAS_PROJECT_ID });

    // Matches env *usage*, not the prose in the comment above the pin.
    const source = readFileSync(join(__dirname, '..', 'app.config.ts'), 'utf8');
    expect(source).not.toMatch(/process\.env\[?['"`]EAS_PROJECT_ID/);
  });
});

describe('apple-app-site-association', () => {
  const envs = ['dev', 'beta', 'prod'] as const;
  const bundleIdPerEnv = {
    dev: 'com.cultuvilla.app.dev',
    beta: 'com.cultuvilla.app.beta',
    prod: 'com.cultuvilla.app',
  } as const;

  it.each(envs)('carries the real Apple Team ID for %s', (env) => {
    const path = join(__dirname, '..', 'public', '.well-known', env, 'apple-app-site-association');
    const aasa = JSON.parse(readFileSync(path, 'utf8'));

    const appIDs = aasa.applinks.details.map((d: { appID: string }) => d.appID);
    expect(appIDs).toContain(`${APPLE_TEAM_ID}.${bundleIdPerEnv[env]}`);
  });
});
