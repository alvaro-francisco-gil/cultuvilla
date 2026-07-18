import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'waitlist_promoted',
  'event_cancelled',
  'event_updated',
  'org_approved',
  'org_rejected',
  'organizer_request_created',
  'organizer_request_approved',
  'organizer_request_rejected',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationDataSchema = z.object({
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  eventId: z.string().nullable(),
  municipalityId: z.string().nullable(),
  // Set on request-flow notifications (join_request_*, organizer_request_*);
  // null on the event/org notification types that don't carry a requester.
  requesterUid: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.date(),
});
export type NotificationData = z.infer<typeof NotificationDataSchema>;

export interface NotificationDataInput {
  type: NotificationType;
  title: string;
  body: string;
  eventId?: string | null;
  municipalityId?: string | null;
  requesterUid?: string | null;
  read?: boolean;
  createdAt?: Date;
}

export function buildNotificationData(input: NotificationDataInput): NotificationData {
  return {
    type: input.type,
    title: input.title,
    body: input.body,
    eventId: input.eventId ?? null,
    municipalityId: input.municipalityId ?? null,
    requesterUid: input.requesterUid ?? null,
    read: input.read ?? false,
    createdAt: input.createdAt ?? new Date(),
  };
}
