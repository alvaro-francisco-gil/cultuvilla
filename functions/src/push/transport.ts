import type { ApnsEnvironment } from '@cultuvilla/shared/models';

/** One device, as a transport needs to see it. */
export interface TransportTarget {
  token: string;
  apnsEnvironment: ApnsEnvironment | null;
  apnsTopic: string | null;
}

/**
 * What every transport reports back. `deadTokens` are the ones the platform
 * says will never work again; the caller prunes them. A transient failure
 * counts in `failed` but never in `deadTokens` — pruning on a blip silently
 * unsubscribes a real device, and its owner has no way to notice.
 */
export interface TransportResult {
  delivered: number;
  failed: number;
  deadTokens: string[];
}
