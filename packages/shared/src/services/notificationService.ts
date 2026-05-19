import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import type { NotificationData, NotificationDataInput } from '../models/notification/NotificationDataModel';

function notificationsCol(userId: string) {
  return collection(getDb(), 'users', userId, 'notifications');
}

function mapNotificationDoc(
  d: { id: string; data: () => Record<string, unknown> }
): NotificationData & { id: string } {
  const data = d.data();
  return {
    id: d.id,
    type: data['type'] as NotificationData['type'],
    title: data['title'] as string,
    body: data['body'] as string,
    eventId: (data['eventId'] as string | null) ?? null,
    municipalityId: (data['municipalityId'] as string | null) ?? null,
    read: (data['read'] as boolean) ?? false,
    createdAt: (data['createdAt'] as Timestamp).toDate(),
  };
}

export async function getNotifications(
  userId: string,
  maxResults = 50
): Promise<(NotificationData & { id: string })[]> {
  const q = query(
    notificationsCol(userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapNotificationDoc(d as Parameters<typeof mapNotificationDoc>[0]));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(notificationsCol(userId), where('read', '==', false));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function createNotification(
  userId: string,
  input: NotificationDataInput
): Promise<string> {
  const newRef = doc(notificationsCol(userId));
  await setDoc(newRef, {
    type: input.type,
    title: input.title,
    body: input.body,
    eventId: input.eventId ?? null,
    municipalityId: input.municipalityId ?? null,
    read: input.read ?? false,
    createdAt: serverTimestamp(),
  });
  return newRef.id;
}

export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  await updateDoc(doc(notificationsCol(userId), notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(notificationsCol(userId), where('read', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(getDb());
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}
