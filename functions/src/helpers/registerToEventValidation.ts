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
}

export interface ValidRegisterInput {
  eventId: string;
  registrants: RegistrantInput[];
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
  return { eventId: data.eventId, registrants: cleaned };
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
  const { maxAttendees, existingConfirmedCount, existingTotalCount, newCount } = opts;
  const out: AssignedStatus[] = [];
  for (let i = 0; i < newCount; i++) {
    const position = existingTotalCount + i + 1;
    let status: RegistrationStatus;
    if (maxAttendees === null) {
      status = 'confirmed';
    } else {
      status = existingConfirmedCount + i < maxAttendees ? 'confirmed' : 'waitlisted';
    }
    out.push({ status, position });
  }
  return out;
}
