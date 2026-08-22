import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// OTA updates exist so a JS-only fix reaches apps that are ALREADY INSTALLED.
// The motivating incident: `DetailInfoCard`'s `h-full` broke every entity detail
// screen on native, the fix merged the same day, and it still could not reach a
// single user — the newest binary was four days old, there was no update
// channel, and `mobile-release` could not submit.
//
// Invariant tests in the spirit of storeRelease.test.ts / conformanceGate.test.ts:
// they fail the build if the arrangement is quietly undone.

const repoRoot = resolve(__dirname, '../../../..');
const appConfig = readFileSync(resolve(repoRoot, 'apps/mobile/app.config.ts'), 'utf8');
const otaWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/mobile-ota.yml'), 'utf8');
const easJson = JSON.parse(
  readFileSync(resolve(repoRoot, 'apps/mobile/eas.json'), 'utf8'),
) as { build: Record<string, { channel?: string } | undefined> };

describe('OTA update wiring', () => {
  // THE load-bearing one. `appVersion` ties an update to the marketing version,
  // and AGENTS.md mandates a MINOR bump on every develop -> beta promotion — so
  // that policy would strand every update against the binaries already out
  // there, silently reproducing the exact problem OTA was added to solve.
  it('uses the fingerprint runtime-version policy, never appVersion', () => {
    expect(appConfig).toMatch(/runtimeVersion:\s*\{\s*policy:\s*'fingerprint'/);
    expect(appConfig).not.toMatch(/policy:\s*'appVersion'/);
    expect(appConfig).not.toMatch(/policy:\s*'sdkVersion'/);
  });

  it('declares an update URL for the EAS project', () => {
    expect(appConfig).toMatch(/updates:\s*\{[\s\S]*?url:\s*'https:\/\/u\.expo\.dev\//);
  });

  // A blocking check would hold the splash screen on a slow network; the update
  // is meant to land on the next launch instead.
  it('never blocks launch waiting for an update', () => {
    expect(appConfig).toMatch(/fallbackToCacheTimeout:\s*0/);
  });

  // Every build profile must name the channel it receives, or a binary silently
  // subscribes to nothing and OTA appears to work while reaching no one.
  it('maps every non-development build profile to a channel', () => {
    for (const profile of ['preview-dev', 'preview-beta', 'production']) {
      expect(easJson.build[profile]?.channel, `${profile} has no channel`).toBeTruthy();
    }
  });

  it('publishes automatically on beta only, never on main', () => {
    expect(otaWorkflow).toMatch(/branches:\s*\[beta\]/);
    expect(otaWorkflow).not.toMatch(/branches:\s*\[[^\]]*main/);
  });
});
