import { compareVersions } from './semver';
import type { AppVersionConfig } from '../models/config';

export type GateDecision = 'block' | 'nudge' | 'ok';

/**
 * Decide whether a running client must update. Fails open ('ok') on web, a
 * missing config, or any unparseable version — the gate must never brick the
 * app over a bad read.
 */
export function resolveVersionGate(
  running: string,
  config: AppVersionConfig | null,
  platform: 'ios' | 'android' | 'web',
): GateDecision {
  if (platform === 'web' || !config) return 'ok';
  const { minSupported, latest } = config[platform];
  try {
    if (compareVersions(running, minSupported) < 0) return 'block';
    if (compareVersions(running, latest) < 0) return 'nudge';
    return 'ok';
  } catch {
    return 'ok';
  }
}
