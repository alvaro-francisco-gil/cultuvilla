'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const PUBLIC_PATHS = ['/login', '/complete-profile', '/invite'];

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileChecked } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!profileChecked) return;
    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
    if (!profile) router.replace('/complete-profile');
  }, [user, profile, loading, profileChecked, pathname, router]);

  return <>{children}</>;
}
