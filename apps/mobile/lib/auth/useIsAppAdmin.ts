import { useEffect, useState } from 'react';
import { isAppAdmin as isAppAdminService } from '@cultuvilla/shared/services/adminService';
import { useAuth } from './useAuth';

export interface IsAppAdminState {
  isAppAdmin: boolean;
  loading: boolean;
}

export function useIsAppAdmin(): IsAppAdminState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<IsAppAdminState>({ isAppAdmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    // Signed out is a settled answer, not a pending one: there is no uid to ask
    // about, so nothing will ever resolve this. Reporting it as loading left
    // every gate downstream waiting forever -- the Wrapped screen spins on
    // `capsLoading`, so an anonymous visitor never even reached the redirect.
    if (!user) {
      setState({ isAppAdmin: false, loading: authLoading });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    isAppAdminService(user.uid).then((ok) => {
      if (!cancelled) setState({ isAppAdmin: ok, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
