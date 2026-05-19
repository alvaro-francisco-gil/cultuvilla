'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, Bell, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { getUnreadCount } from '@cultuvilla/shared/services/notificationService';

const navItems = [
  { href: '/', icon: Home, label: 'Inicio' },
  { href: '/my-signups', icon: CalendarCheck, label: 'Eventos', requiresAuth: true },
  { href: '/notifications', icon: Bell, label: 'Notificaciones', requiresAuth: true },
  { href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    getUnreadCount(user.uid).then(setUnreadCount);
  }, [user]);

  // Always render all items on server and before mount to avoid hydration mismatch.
  // After mount, filter based on auth state.
  const visibleItems = mounted
    ? navItems.filter((item) => !item.requiresAuth || user)
    : navItems.filter((item) => !item.requiresAuth);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {visibleItems.map((item) => {
          const isActive = mounted && pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={mounted && user ? item.href : item.requiresAuth ? '/login' : item.href} className={`flex flex-col items-center gap-1 px-3 py-2 text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
              <div className="relative">
                <Icon size={22} />
                {item.href === '/notifications' && mounted && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
