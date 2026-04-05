'use client';

import type { NotificationData } from '@villa-events/shared/models/notification';
import { Bell } from 'lucide-react';

interface NotificationItemProps {
  notification: NotificationData & { id: string };
}

const typeLabel: Record<NotificationData['type'], string> = {
  waitlist_promoted: 'Lista de espera',
  event_cancelled: 'Evento cancelado',
  event_updated: 'Evento actualizado',
  org_approved: 'Organización aprobada',
  org_rejected: 'Organización rechazada',
};

export function NotificationItem({ notification }: NotificationItemProps) {
  const timeStr = notification.createdAt.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${notification.read ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
      <div className={`mt-0.5 shrink-0 p-1.5 rounded-full ${notification.read ? 'bg-gray-100' : 'bg-blue-100'}`}>
        <Bell size={14} className={notification.read ? 'text-gray-400' : 'text-blue-600'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{typeLabel[notification.type]}</p>
        <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
        <p className="text-xs text-gray-400 mt-1.5">{timeStr}</p>
      </div>
    </div>
  );
}
