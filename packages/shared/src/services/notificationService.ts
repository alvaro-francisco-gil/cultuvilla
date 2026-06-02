import {
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
  getCountFromServer,
  updateDoc,
} from 'firebase/firestore';
import { getDb } from '../firebase';
import {
  userNotificationsCollection,
  userNotificationDoc,
} from '../firebase/refs/client';
import {
  buildNotificationData,
  type NotificationData,
  type NotificationDataInput,
} from '../models/notification';

export async function getNotifications(
  userId: string,
  maxResults = 50,
): Promise<(NotificationData & { id: string })[]> {
  const q = query(
    userNotificationsCollection(getDb(), userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(userNotificationsCollection(getDb(), userId), where('read', '==', false));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function createNotification(
  userId: string,
  input: NotificationDataInput,
): Promise<string> {
  // addDoc routes through the typed converter, so createdAt must be a plain
  // Date (serverTimestamp sentinels are rejected by the schema). The converter
  // re-marshals the Date to a Firestore Timestamp on write.
  const ref = await addDoc(
    userNotificationsCollection(getDb(), userId),
    buildNotificationData(input),
  );
  return ref.id;
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  // updateDoc accepts partial shapes against the typed ref for trivial fields.
  await updateDoc(userNotificationDoc(getDb(), userId, notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(userNotificationsCollection(getDb(), userId), where('read', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(getDb());
  snap.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}
