import type { PushPermission } from './pushClient';

/**
 * When the in-app "¿te avisamos?" sheet may appear.
 *
 * The sheet exists because iOS grants exactly ONE system permission dialog per
 * install, ever — a "no" there is only recoverable through a trip to Settings.
 * So the system dialog is only ever shown to someone who has already said yes
 * to the sheet, and the sheet itself only appears at a moment that earns it:
 * right after the user did something push would genuinely help with.
 *
 * Pure so every rule below is unit-tested; the store and the UI just obey it.
 */
export type SoftAskTrigger = 'event_signup' | 'village_join';

export interface SoftAskState {
  askCount: number;
  /** Epoch ms of the last time the sheet was shown, whatever the answer. */
  lastAskedAt: number | null;
}

export const INITIAL_SOFT_ASK_STATE: SoftAskState = { askCount: 0, lastAskedAt: null };

/** Two chances, total. A third ask is nagging, and nagging costs uninstalls. */
export const MAX_SOFT_ASKS = 2;

/** Never twice in the same week, however many things the user signs up to. */
export const MIN_MS_BETWEEN_ASKS = 7 * 24 * 60 * 60 * 1000;

export interface ShouldOfferInput {
  trigger: SoftAskTrigger;
  permission: PushPermission;
  state: SoftAskState;
  now: number;
}

export function shouldOfferSoftAsk({ trigger, permission, state, now }: ShouldOfferInput): boolean {
  // Granted: nothing to ask. Denied: the system dialog will not show again, so
  // a sheet promising one would be a lie — Ajustes → Notificaciones is the way
  // back. Unsupported: web.
  if (permission !== 'undetermined') return false;
  if (state.askCount >= MAX_SOFT_ASKS) return false;
  if (state.lastAskedAt !== null && now - state.lastAskedAt < MIN_MS_BETWEEN_ASKS) return false;
  // Joining a village is the weaker moment — the promise ("things will happen
  // here") is vaguer than a seat someone just booked. It only gets the FIRST
  // ask; the second chance is reserved for a sign-up.
  if (trigger === 'village_join' && state.askCount > 0) return false;
  return true;
}

export function recordSoftAsk(state: SoftAskState, now: number): SoftAskState {
  return { askCount: state.askCount + 1, lastAskedAt: now };
}
