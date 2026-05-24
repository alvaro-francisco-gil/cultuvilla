import { useEffect, useState } from 'react';
import { isAppAdmin as isAppAdminService } from '@cultuvilla/shared/services/adminService';
import { useAuth } from './useAuth';

export interface IsAppAdminState {
  isAppAdmin: boolean;
  loading: boolean;
}

export function useIsAppAdmin(): IsAppAdminState {
  const { user } = useAuth();
  const [state, setState] = useState<IsAppAdminState>({ isAppAdmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setState({ isAppAdmin: false, loading: true });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    isAppAdminService(user.uid).then((ok) => {
      if (!cancelled) setState({ isAppAdmin: ok, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
