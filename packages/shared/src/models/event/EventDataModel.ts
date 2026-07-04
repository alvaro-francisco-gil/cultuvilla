import { z } from 'zod';
import { LocationDataSchema, LatLngSchema, type LatLng } from '../core/LocationDataModel';

// Events publish on create — there is no `draft` state.
export const EventStatusSchema = z.enum(['published', 'cancelled', 'completed']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  startDate: z.date(),
  // Optional end of a multi-day event. `null` means single-day: the event runs
  // for the rest of its Europe/Madrid start day (see isEventOngoing). When set,
  // it must be >= startDate (enforced in firestore.rules and the create form).
  // `.default(null)`: events created during the single-date era have no endDate
  // field at all, so reads of those legacy docs normalize the absent field to
  // null instead of throwing. New docs always carry it (buildEventData + rules).
  endDate: z.date().nullable().default(null),
  location: LocationDataSchema,
  imageURL: z.string().nullable(),
  maxAttendees: z.number().int().nullable(),
  telephoneRequired: z.boolean(),
  status: EventStatusSchema,
  organizerUserIds: z.array(z.string()),
  organizerOrgIds: z.array(z.string()),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Physical-layer foreign key: which municipality doc this event belongs to.
  municipalityId: z.string(),
  // Community-layer denormalized display fields, copied from the village
  // (the activated municipality) by syncVillageDenormalization for flat feed
  // reads. See docs/architecture/municipality-vs-village.md.
  villageName: z.string(),
  villageCoverImage: z.string().nullable(),
  villageCoordinates: LatLngSchema.nullable(),
  // Denormalized attendee counters, maintained server-side by the
  // registerToEvent / waitlistPromotion functions. Initialized to 0 at create
  // so every event doc carries them — never absent.
  confirmedCount: z.number().int(),
  totalCount: z.number().int(),
  // Derived from `endDate ?? startDate` (see eventEndBoundary): the instant an
  // event stops being current. The Explora feed queries on this — not on
  // `startDate` — so a same-day event that already started, or a multi-day
  // event mid-run, still surfaces (it drops out only once completeExpiredEvents
  // flips its status). Written by buildEventData on create and recomputed in
  // updateEvent whenever the dates change; kept a stored field (not computed at
  // read) because Firestore can only range-filter/order on a persisted field.
  endBoundary: z.date(),
});
export type EventData = z.infer<typeof EventDataSchema>;

export interface EventDataInput {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date | null;
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
  villageName: string;
  villageCoverImage?: string | null;
  villageCoordinates: LatLng | null;
}

export function buildEventData(input: EventDataInput): EventData {
  const now = new Date();
  const endDate = input.endDate ?? null;
  return {
    title: input.title,
    description: input.description,
    startDate: input.startDate,
    endDate,
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
    villageName: input.villageName,
    villageCoverImage: input.villageCoverImage ?? null,
    villageCoordinates: input.villageCoordinates,
    confirmedCount: 0,
    totalCount: 0,
    endBoundary: eventEndBoundary({ startDate: input.startDate, endDate }),
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

/**
 * The day an event stops being "ongoing": its `endDate` for multi-day events,
 * or its `startDate` when single-day (`endDate` null). Both `isEventOngoing`
 * and the completeExpiredEvents scheduler key their day-boundary check off this.
 */
export function eventEndBoundary(event: Pick<EventData, 'startDate' | 'endDate'>): Date {
  return event.endDate ?? event.startDate;
}

export function isEventOngoing(
  event: Pick<EventData, 'status' | 'startDate' | 'endDate'>,
  now: Date,
): boolean {
  if (event.status !== 'published') return false;
  if (event.startDate > now) return false;
  return !isStartDayOver(eventEndBoundary(event), now);
}
