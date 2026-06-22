import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { useAuth } from './useAuth';
import { readPendingIntent, setPendingIntent, clearPendingIntent } from './pendingIntent';
import { RegisterSheet } from '../../components/feature/RegisterSheet';

interface RegisterGateValue {
  requireAuth: (intentHref: string, reason?: string) => boolean;
  pendingIntent: string | null;
  clearPending: () => void;
}

const Ctx = createContext<RegisterGateValue | null>(null);

export function RegisterGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [intent, setIntent] = useState<string | null>(null);
  const [pendingIntent, setPending] = useState<string | null>(null);

  useEffect(() => {
    void readPendingIntent().then(setPending);
  }, []);

  const requireAuth = useCallback(
    (intentHref: string, r?: string) => {
      if (user) return true;
      setIntent(intentHref);
      setReason(r);
      setVisible(true);
      return false;
    },
    [user],
  );

  const onRegister = useCallback(() => {
    // Persist only on commit, so dismissing leaves no stale intent.
    if (intent) {
      void setPendingIntent(intent);
      setPending(intent);
    }
    setVisible(false);
    router.push('/(auth)/login');
  }, [intent]);

  const clearPending = useCallback(() => {
    setPending(null);
    void clearPendingIntent();
  }, []);

  const value = useMemo<RegisterGateValue>(
    () => ({ requireAuth, pendingIntent, clearPending }),
    [requireAuth, pendingIntent, clearPending],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <RegisterSheet visible={visible} reason={reason} onRegister={onRegister} onDismiss={() => setVisible(false)} />
    </Ctx.Provider>
  );
}

export function useRegisterGate(): RegisterGateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRegisterGate must be used within RegisterGateProvider');
  return v;
}
