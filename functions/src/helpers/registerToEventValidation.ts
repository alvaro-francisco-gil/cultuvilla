import { HttpsError } from 'firebase-functions/v2/https';

export interface RegistrantInput {
  personId: string;
  name: string;
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
      `No puedes inscribir más de ${MAX_REGISTRANTS_PER_CALL} asistentes a la vez.`,
    );
  }
  const cleaned: RegistrantInput[] = [];
  for (const r of data.registrants) {
    if (!r || typeof r !== 'object') {
      throw new HttpsError('invalid-argument', 'Asistente inválido.');
    }
    if (typeof r.personId !== 'string' || !r.personId.trim()) {
      throw new HttpsError('invalid-argument', 'personId requerido en cada asistente.');
    }
    if (typeof r.name !== 'string' || !r.name.trim()) {
      throw new HttpsError('invalid-argument', 'name requerido en cada asistente.');
    }
    cleaned.push({ personId: r.personId, name: r.name.trim() });
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
