import { useEffect, useState, useCallback } from 'react';
import { getNotifications, getUnreadCount } from '@villa-events/shared/services/notificationService';
import type { NotificationData } from '@villa-events/shared/models/notification';
import { useAuth } from '@/hooks/useAuth';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<(NotificationData & { id: string })[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        getNotifications(user.uid),
        getUnreadCount(user.uid),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { notifications, unreadCount, loading, reload };
}
