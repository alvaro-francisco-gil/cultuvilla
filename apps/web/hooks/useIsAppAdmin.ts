'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { isAppAdmin } from '@cultuvilla/shared/services/adminService';

export function useIsAppAdmin(): { isAppAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ isAppAdmin: false, loading: true });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ isAppAdmin: false, loading: false });
      return;
    }
    isAppAdmin(user.uid).then((ok) => setState({ isAppAdmin: ok, loading: false }));
  }, [user, authLoading]);

  return state;
}
