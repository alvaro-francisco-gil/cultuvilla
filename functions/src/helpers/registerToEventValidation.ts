import { HttpsError } from 'firebase-functions/v2/https';

export interface RegistrantInput {
  personId: string;
  name: string;
  phone?: string;
  /** Raw answers to the event's custom signupFields. Only shape-checked here —
   * the event isn't loaded in this helper, so validating a value against its
   * declared type happens in registerToEvent, inside the transaction. */
  answers?: Record<string, unknown>;
}

/** Mirrors MAX_SIGNUP_FIELDS; an event can never declare more than this. */
const MAX_ANSWERS_PER_REGISTRANT = 10;

function cleanAnswers(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'Respuestas inválidas.');
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_ANSWERS_PER_REGISTRANT) {
    throw new HttpsError('invalid-argument', 'Demasiadas respuestas.');
  }
  for (const [, value] of entries) {
    const t = typeof value;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Respuestas inválidas.');
    }
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export interface RegisterToEventData {
  eventId?: string;
  registrants?: RegistrantInput[];
  /**
   * Seats in this group that nobody fills yet — each becomes a held open-seat
   * registration plus a single-use claim link. Only meaningful on an event
   * with `signupGroupSize > 1`; `registrants.length + openSeats` must equal
   * that size exactly, which registerToEvent checks once it has read the
   * event.
   */
  openSeats?: number;
}

export interface ValidRegisterInput {
  eventId: string;
  registrants: RegistrantInput[];
  openSeats: number;
}

const MAX_REGISTRANTS_PER_CALL = 50;

export function validateRegisterInput(data: RegisterToEventData | undefined): ValidRegisterInput {
  if (!data) {
    throw new HttpsError('invalid-argument', 'Faltan parámetros.');
  }
  if (typeof data.eventId !== 'string' || !data.eventId.trim()) {
    throw new HttpsError('invalid-argument', 'eventId requerido.');
  }
  if (!Array.isArray(data.registrants) || data.registrants.length === 0) {
    throw new HttpsError('invalid-argument', 'Debe incluir al menos un asistente.');
  }
  if (data.registrants.length > MAX_REGISTRANTS_PER_CALL) {
    throw new HttpsError(
      'invalid-argument',
      `No puedes inscribir más de ${String(MAX_REGISTRANTS_PER_CALL)} asistentes a la vez.`,
    );
  }
  const cleaned: RegistrantInput[] = [];
  for (const r of data.registrants as unknown[]) {
    if (!r || typeof r !== 'object') {
      throw new HttpsError('invalid-argument', 'Asistente inválido.');
    }
    const reg = r as Partial<RegistrantInput>;
    if (typeof reg.personId !== 'string' || !reg.personId.trim()) {
      throw new HttpsError('invalid-argument', 'personId requerido en cada asistente.');
    }
    if (typeof reg.name !== 'string' || !reg.name.trim()) {
      throw new HttpsError('invalid-argument', 'name requerido en cada asistente.');
    }
    const phone = typeof reg.phone === 'string' && reg.phone.trim() ? reg.phone.trim() : undefined;
    const answers = cleanAnswers(reg.answers);
    cleaned.push({
      personId: reg.personId,
      name: reg.name.trim(),
      ...(phone ? { phone } : {}),
      ...(answers ? { answers } : {}),
    });
  }
  const openSeats = data.openSeats ?? 0;
  if (
    typeof openSeats !== 'number' ||
    !Number.isInteger(openSeats) ||
    openSeats < 0 ||
    openSeats > MAX_REGISTRANTS_PER_CALL
  ) {
    throw new HttpsError('invalid-argument', 'openSeats inválido.');
  }

  return { eventId: data.eventId, registrants: cleaned, openSeats };
}

export type RegistrationStatus = 'confirmed' | 'waitlisted';

export interface AssignedStatus {
  status: RegistrationStatus;
  position: number;
}

export function computeStatuses(opts: {
  maxAttendees: number | null;
  existingConfirmedCount: number;
  existingTotalCount: number;
  newCount: number;
}): AssignedStatus[] {
  // An individual sign-up is a run of groups of one, so the two share an
  // implementation: with size 1 "the whole group fits" degenerates to "this
  // seat fits", which is exactly the original per-seat rule.
  return computeGroupStatuses({
    maxAttendees: opts.maxAttendees,
    existingConfirmedCount: opts.existingConfirmedCount,
    existingTotalCount: opts.existingTotalCount,
    groupSizes: Array.from({ length: opts.newCount }, () => 1),
  }).flat();
}

/**
 * Seats whole groups against the cap. A group is **atomic**: either every seat
 * in it is confirmed, or every seat waits. That is the entire point of
 * `signupGroupSize` — a pareja split across the capacity boundary (one in, one
 * on the waitlist) is precisely the outcome the setting exists to prevent.
 *
 * Returns one array of seat assignments per requested group, in order.
 */
export function computeGroupStatuses(opts: {
  maxAttendees: number | null;
  existingConfirmedCount: number;
  existingTotalCount: number;
  groupSizes: number[];
}): AssignedStatus[][] {
  const { maxAttendees, existingConfirmedCount, existingTotalCount, groupSizes } = opts;
  const out: AssignedStatus[][] = [];
  let confirmed = existingConfirmedCount;
  let total = existingTotalCount;

  for (const size of groupSizes) {
    const fits = maxAttendees === null || confirmed + size <= maxAttendees;
    const seats: AssignedStatus[] = [];
    for (let i = 0; i < size; i++) {
      seats.push({ status: fits ? 'confirmed' : 'waitlisted', position: total + i + 1 });
    }
    total += size;
    if (fits) confirmed += size;
    out.push(seats);
  }

  return out;
}

/** One waitlisted registration, as the promotion picker needs to see it. */
export interface WaitlistCandidate {
  id: string;
  position: number;
  groupId: string | null;
}

/**
 * Picks which waitlisted registrations to promote into `freeSeats` freed
 * places. Ungrouped candidates are groups of one, so an event with
 * `signupGroupSize` 1 keeps the old behaviour exactly: the single
 * lowest-position waitlisted registration.
 *
 * Groups are considered in queue order and the first one that *fits* wins. A
 * group too large for the freed space is skipped rather than allowed to block
 * the queue — on a uniform-group-size event (the only kind that produces
 * groups today) every group is the same size, so this never actually reorders
 * anyone; it only stops a single freed seat from stalling promotion forever on
 * an event whose group size was lowered after people had already signed up.
 */
export function selectPromotionGroup(
  candidates: WaitlistCandidate[],
  freeSeats: number,
): WaitlistCandidate[] {
  if (freeSeats <= 0) return [];
  const queue = [...candidates].sort((a, b) => a.position - b.position);

  const seen = new Set<string>();
  for (const head of queue) {
    // Ungrouped registrations are their own group of one; keying them by doc
    // id keeps them from colliding with each other in `seen`.
    const key = head.groupId ?? `solo:${head.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const group = head.groupId
      ? queue.filter((c) => c.groupId === head.groupId)
      : [head];
    if (group.length <= freeSeats) return group;
  }

  return [];
}
