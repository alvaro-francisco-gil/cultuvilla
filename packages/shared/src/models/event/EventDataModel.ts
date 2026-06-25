import { z } from 'zod';
import { LocationDataSchema, LatLngSchema, type LatLng } from '../core/LocationDataModel';

// `draft` was dropped — events publish on create. Legacy `draft` docs coerce to
// `published` on read via the `.catch` on the status field below (no migration).
export const EventStatusSchema = z.enum(['published', 'cancelled', 'completed']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.date(),
  location: LocationDataSchema,
  imageURL: z.string().nullable(),
  maxAttendees: z.number().int().nullable(),
  telephoneRequired: z.boolean(),
  // Migrate legacy `draft` → `published` on read; genuinely invalid values
  // still fail enum validation (preprocess only rewrites the dropped value).
  status: z.preprocess((v) => (v === 'draft' ? 'published' : v), EventStatusSchema),
  organizerUserIds: z.array(z.string()),
  organizerOrgIds: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  municipalityId: z.string(),
  municipalityName: z.string(),
  municipalityCoverImage: z.string().nullable(),
  municipalityCoordinates: LatLngSchema.nullable(),
  confirmedCount: z.number().int().optional(),
  totalCount: z.number().int().optional(),
});
export type EventData = z.infer<typeof EventDataSchema>;

export interface EventDataInput {
  title: string;
  description: string;
  startDate: Date;
  location: z.infer<typeof LocationDataSchema>;
  imageURL?: string | null;
  maxAttendees?: number | null;
  telephoneRequired?: boolean;
  status?: EventStatus;
  organizerUserIds: string[];
  organizerOrgIds: string[];
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  municipalityId: string;
  municipalityName: string;
  municipalityCoverImage?: string | null;
  municipalityCoordinates: LatLng | null;
}

export function buildEventData(input: EventDataInput): EventData {
  const now = new Date();
  return {
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    location: input.location,
    imageURL: input.imageURL ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'published',
    organizerUserIds: input.organizerUserIds,
    organizerOrgIds: input.organizerOrgIds,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    municipalityId: input.municipalityId,
    municipalityName: input.municipalityName,
    municipalityCoverImage: input.municipalityCoverImage ?? null,
    municipalityCoordinates: input.municipalityCoordinates,
  };
}

export function isEventFull(event: EventData, confirmedCount: number): boolean {
  if (event.maxAttendees === null) return false;
  return confirmedCount >= event.maxAttendees;
}

export function isEventSignupOpen(event: EventData): boolean {
  return event.status === 'published';
}

const EVENT_TZ = 'Europe/Madrid';
function madridDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** True once `now` is a later Europe/Madrid calendar day than `start`. */
export function isStartDayOver(start: Date, now: Date): boolean {
  return madridDayKey(now) > madridDayKey(start);
}

export function isEventOngoing(event: Pick<EventData, 'status' | 'startDate'>, now: Date): boolean {
  if (event.status !== 'published') return false;
  if (event.startDate > now) return false;
  return !isStartDayOver(event.startDate, now);
}
