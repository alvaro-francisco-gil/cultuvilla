import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { setCurrentRoute } from './currentRoute';

/** Mirrors the active route into the module the global error handlers read. */
export function useRouteTracking(): void {
  const pathname = usePathname();
  useEffect(() => {
    setCurrentRoute(pathname);
  }, [pathname]);
}
