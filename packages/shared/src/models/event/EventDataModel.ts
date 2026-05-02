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
  // Village context (denormalized for feed rendering).
  villageId: string;
  villageName: string;
  villageCoverImage: string | null;
  villageCoordinates: GeoPoint;
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
  villageId: string;
  villageName: string;
  villageCoverImage?: string | null;
  villageCoordinates: GeoPoint;
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
    villageId: input.villageId,
    villageName: input.villageName,
    villageCoverImage: input.villageCoverImage ?? null,
    villageCoordinates: input.villageCoordinates,
  };
}

export function isEventFull(event: EventData, confirmedCount: number): boolean {
  if (event.maxAttendees === null) return false;
  return confirmedCount >= event.maxAttendees;
}

export function isEventSignupOpen(event: EventData): boolean {
  return event.status === 'published';
}
