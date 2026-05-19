export type NotificationType =
  | 'waitlist_promoted'
  | 'event_cancelled'
  | 'event_updated'
  | 'org_approved'
  | 'org_rejected';

export interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  eventId: string | null;
  municipalityId: string | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationDataInput {
  type: NotificationType;
  title: string;
  body: string;
  eventId?: string | null;
  municipalityId?: string | null;
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
    read: input.read ?? false,
    createdAt: input.createdAt ?? new Date(),
  };
}
