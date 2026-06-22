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
  endDate: z.date().nullable(),
  location: LocationDataSchema,
  imageURL: z.string().nullable(),
  maxAttendees: z.number().int().nullable(),
  telephoneRequired: z.boolean(),
  // Migrate legacy `draft` → `published` on read; genuinely invalid values
  // still fail enum validation (preprocess only rewrites the dropped value).
  status: z.preprocess((v) => (v === 'draft' ? 'published' : v), EventStatusSchema),
  organizationId: z.string(),
  organizationName: z.string(),
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
  endDate?: Date | null;
  location: z.infer<typeof LocationDataSchema>;
  imageURL?: string | null;
  maxAttendees?: number | null;
  telephoneRequired?: boolean;
  status?: EventStatus;
  organizationId: string;
  organizationName: string;
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
    endDate: input.endDate ?? null,
    location: input.location,
    imageURL: input.imageURL ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'published',
    organizationId: input.organizationId,
    organizationName: input.organizationName,
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
