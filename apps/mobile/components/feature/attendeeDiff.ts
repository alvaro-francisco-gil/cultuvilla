import type { RegistrationStatus } from '@cultuvilla/shared/models/event/RegistrationDataModel';

/** A persona's existing registration on the event: the doc id + its status. */
export interface AttendeeRegistration {
  regId: string;
  status: RegistrationStatus;
}

export interface AttendeeDiff {
  /** Personas to register now — newly selected and not yet registered. */
  toAdd: { personId: string; name: string }[];
  /** Registration doc ids to cancel — previously registered, now deselected. */
  toCancelRegIds: string[];
}

/**
 * Diff the user's ticked personas against who is already registered, so the
 * caller can issue one `registerToEvent` for the additions and a
 * `cancelRegistration` per removal. Personas that are both selected and already
 * registered are left untouched.
 */
export function computeRegistrationDiff(
  selectedIds: Set<string>,
  registered: Map<string, AttendeeRegistration>,
  names: Map<string, string>,
): AttendeeDiff {
  const toAdd: AttendeeDiff['toAdd'] = [];
  for (const id of selectedIds) {
    if (!registered.has(id)) toAdd.push({ personId: id, name: names.get(id) ?? '' });
  }
  const toCancelRegIds: string[] = [];
  for (const [id, reg] of registered) {
    if (!selectedIds.has(id)) toCancelRegIds.push(reg.regId);
  }
  return { toAdd, toCancelRegIds };
}
