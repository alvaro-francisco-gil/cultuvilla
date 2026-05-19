import { GeoPoint } from 'firebase/firestore';
import { LocationData } from '../core/LocationDataModel';

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface EventData {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  location: LocationData;
  imageURL: string | null;
  price: number | null;
  maxAttendees: number | null;
  telephoneRequired: boolean;
  status: EventStatus;
  organizationId: string;
  organizationName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Municipality context (denormalized for feed rendering).
  municipalityId: string;
  municipalityName: string;
  municipalityCoverImage: string | null;
  municipalityCoordinates: GeoPoint | null;
  // Registration counters maintained by `registerToEvent` and
  // `onRegistrationDeleted`. Optional because events created before the
  // callable rollout don't carry them yet; readers should fall back to a
  // count query when undefined.
  confirmedCount?: number;
  totalCount?: number;
}

export interface EventDataInput {
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date | null;
  location: LocationData;
  imageURL?: string | null;
  price?: number | null;
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
  municipalityCoordinates: GeoPoint | null;
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
    price: input.price ?? null,
    maxAttendees: input.maxAttendees ?? null,
    telephoneRequired: input.telephoneRequired ?? false,
    status: input.status ?? 'draft',
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
