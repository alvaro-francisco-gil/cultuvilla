import { useEffect, useState, useCallback } from 'react';
import {
  getEventRegistrations,
  getUserRegistrations,
} from '@cultuvilla/shared/services/registrationService';
import type { RegistrationData } from '@cultuvilla/shared/models/event';
import { useAuth } from '@/hooks/useAuth';

// `confirmedCount` is derived from `allRegistrations` rather than calling
// `getCountFromServer`, since this hook already loads the full registration
// list. The event doc also carries denormalized `confirmedCount`/`totalCount`
// (written by `registerToEvent` and `onRegistrationDeleted`); callers that
// only need a count without the full list should read from there.
export function useRegistrations(eventId: string) {
  const { user } = useAuth();
  const [allRegistrations, setAllRegistrations] = useState<(RegistrationData & { id: string })[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<(RegistrationData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getEventRegistrations(eventId);
      setAllRegistrations(all);

      if (user) {
        const mine = await getUserRegistrations(eventId, user.uid);
        setMyRegistrations(mine);
      } else {
        setMyRegistrations([]);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const confirmedCount = allRegistrations.filter((r) => r.status === 'confirmed').length;

  return { allRegistrations, myRegistrations, confirmedCount, loading, reload };
}
