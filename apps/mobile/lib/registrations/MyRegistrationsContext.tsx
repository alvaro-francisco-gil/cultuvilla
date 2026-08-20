import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { getUserRegistrationTallies } from '@cultuvilla/shared/services/registrationService';
import {
  resolveRegistrationRibbon,
  type RegistrationRibbon,
  type RegistrationTally,
} from '@cultuvilla/shared/models/event/RegistrationRibbonModel';

interface MyRegistrationsValue {
  /** The viewer's ribbon for one event, or null when they have no stake in it. */
  ribbonFor: (eventId: string) => RegistrationRibbon | null;
  /** Re-read the tallies (after a sign-up or cancellation, or on feed focus). */
  refresh: () => void;
}

const Ctx = createContext<MyRegistrationsValue | null>(null);

/**
 * Holds the viewer's own registrations, tallied per event, so feed cards can
 * mark the ones they are signed up for.
 *
 * One collection-group read per session backs the whole feed — cards do a
 * synchronous map lookup, never a query of their own. That is the entire reason
 * this is a context rather than a hook each card calls: N cards must not become
 * N reads.
 */
export function MyRegistrationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tallies, setTallies] = useState<Map<string, RegistrationTally>>(new Map());

  const uid = user?.uid ?? null;

  const load = useCallback(async () => {
    if (!uid) {
      setTallies(new Map());
      return;
    }
    try {
      setTallies(await getUserRegistrationTallies(uid));
    } catch {
      // A failed read means no ribbons, not a broken feed. The cards are a
      // secondary signal; the events themselves still render.
      setTallies(new Map());
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const ribbonFor = useCallback(
    (eventId: string) => {
      const tally = tallies.get(eventId);
      return tally ? resolveRegistrationRibbon(tally) : null;
    },
    [tallies],
  );

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return <Ctx.Provider value={{ ribbonFor, refresh }}>{children}</Ctx.Provider>;
}

export function useMyRegistrations(): MyRegistrationsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMyRegistrations must be used within MyRegistrationsProvider');
  return v;
}
