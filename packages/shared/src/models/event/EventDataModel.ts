import { z } from 'zod';
import { LocationDataSchema, LatLngSchema, type LatLng } from '../core/LocationDataModel';
import { SignupFieldsSchema, type SignupFieldSpec } from './SignupFieldModel';

/**
 * Upper bound on `signupGroupSize`. Groups are seated atomically, so a large
 * group would make the capacity edge of a popular event mostly unusable (a
 * group of 8 needs 8 free seats or it waits); 4 covers parejas, tríos and
 * coches/mesas, which is the whole of the observed demand.
 * Re-checked in firestore.rules — keep the two in step.
 */
export const MAX_SIGNUP_GROUP_SIZE = 4;

// Events publish on create — there is no `draft` state.
export const EventStatusSchema = z.enum(['published', 'cancelled', 'completed']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Who may read the event's attendee roster. `members` = anyone who has joined
// the event's pueblo (the default: seeing who is going is what drives sign-ups
// in a village); `organizers` = only the organizer set + village/app admins,
// for events where a visible list would be inappropriate. Never world-readable
// — a roster names real people, and a guest-readable one would put dependent
// personas (typically children) on an open URL.
export const AttendeesVisibilitySchema = z.enum(['members', 'organizers']);
export type AttendeesVisibility = z.infer<typeof AttendeesVisibilitySchema>;

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
  // True when money is collected for the event; the organizer marks who paid
  // per-attendee via registration.paidAt. `.default(false)` so reads of event
  // docs created before this field parse instead of throwing the strict
  // converter (existing dev docs are backfilled to false in this same change).
  requiresPayment: z.boolean().default(false),
  // Creator-defined per-attendee questions asked at sign-up (t-shirt size, DNI,
  // …). Answers never land here or on the public registration doc — they go to
  // the organizer-gated registrationPrivate doc. `.default([])` so events
  // created before this field parse through the strict converter (existing dev
  // docs are backfilled to [] in this same change).
  signupFields: SignupFieldsSchema,
  // False for events that simply happen — a verbena you walk into, or one whose
  // sign-up is run off-app (at the ayuntamiento, by phone, on a paper list).
  // The detail screen then hides the sign-up FAB and registerToEvent refuses,
  // so the roster stays empty except for organizer-added walk-ins. `.default(true)`
  // so events created before this field parse through the strict converter
  // (existing docs are backfilled in this same change).
  signupEnabled: z.boolean().default(true),
  // Free-text line shown in place of the sign-up button when signupEnabled is
  // false ("Entrada libre", "Inscripciones en el bar Paco", a URL). Null means
  // the UI falls back to a generic "no requiere inscripción" string.
  signupInfo: z.string().nullable().default(null),
  // `.default('members')` so events created before this field parse through
  // the strict converter (existing docs are backfilled in this same change).
  // firestore.rules reads the same default via `data.get(...)`, so the stored
  // and enforced meaning of an absent field agree.
  attendeesVisibility: AttendeesVisibilitySchema.default('members'),
  // How many people must sign up together: 1 = ordinary individual sign-up,
  // 2 = parejas, 3-4 = small teams. A group is seated atomically — every seat
  // is confirmed or every seat waits — so capacity can never split a pareja.
  // A seat the creator does not fill with a persona of their own is an *open
  // seat*: a real, held registration carrying a single-use claim token, which
  // a friend turns into their own registration by following the link.
  // `.default(1)` so events created before this field parse instead of
  // throwing the strict converter (existing docs are backfilled to 1 in this
  // same change).
  signupGroupSize: z.number().int().min(1).max(MAX_SIGNUP_GROUP_SIZE).default(1),
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
  // Denormalized interaction counters, maintained server-side by the comments
  // Cloud Function trigger / the detail-screen view tracker. Initialized to 0
  // at create.
  commentCount: z.number().int(),
  readCount: z.number().int(),
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
  requiresPayment?: boolean;
  signupFields?: SignupFieldSpec[];
  signupEnabled?: boolean;
  signupInfo?: string | null;
  attendeesVisibility?: AttendeesVisibility;
  signupGroupSize?: number;
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
    requiresPayment: input.requiresPayment ?? false,
    signupFields: input.signupFields ?? [],
    signupEnabled: input.signupEnabled ?? true,
    signupInfo: input.signupInfo ?? null,
    attendeesVisibility: input.attendeesVisibility ?? 'members',
    signupGroupSize: input.signupGroupSize ?? 1,
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
    commentCount: 0,
    readCount: 0,
    endBoundary: eventEndBoundary({ startDate: input.startDate, endDate }),
  };
}

/** True when the event seats people in groups rather than one by one. */
export function isGroupSignupEvent(event: Pick<EventData, 'signupGroupSize'>): boolean {
  return event.signupGroupSize > 1;
}

export function isEventFull(event: EventData, confirmedCount: number): boolean {
  if (event.maxAttendees === null) return false;
  return confirmedCount >= event.maxAttendees;
}

export function isEventSignupOpen(
  event: Pick<EventData, 'status' | 'signupEnabled'>,
): boolean {
  return event.status === 'published' && event.signupEnabled;
}

/** The wall clock every event date is authored and displayed in. */
export const EVENT_TZ = 'Europe/Madrid';
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
