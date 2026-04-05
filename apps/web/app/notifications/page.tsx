'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { markAllAsRead } from '@villa-events/shared/services/notificationService';
import { NotificationItem } from '@/components/notification/NotificationItem';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, loading, reload } = useNotifications();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllAsRead(user.uid);
    reload();
  };

  if (authLoading || loading) {
    return (
      <div className="px-4 py-6 space-y-4">
        <SkeletonLoader className="h-8 w-40" />
        {[1, 2, 3].map((i) => <SkeletonLoader key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <CheckCheck size={16} />
            Marcar todo leído
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-sm">No tienes notificaciones.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
