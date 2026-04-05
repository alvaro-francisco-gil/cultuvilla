import { Timestamp } from "firebase/firestore";

export interface Event {
  id?: string;
  title: string;
  description: string;
  date: Timestamp;
  location: string;
  maxAttendees?: number;
  imageUrl?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EventRegistration {
  id?: string;
  eventId: string;
  userId: string;
  userName: string;
  registeredAt: Timestamp;
}
