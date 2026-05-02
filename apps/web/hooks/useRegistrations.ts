import { useEffect, useState, useCallback } from 'react';
import {
  getEventRegistrations,
  getUserRegistrations,
  getConfirmedCount,
} from '@villa-events/shared/services/registrationService';
import type { RegistrationData } from '@villa-events/shared/models/event';
import { useAuth } from '@/hooks/useAuth';

export function useRegistrations(eventId: string) {
  const { user } = useAuth();
  const [allRegistrations, setAllRegistrations] = useState<(RegistrationData & { id: string })[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<(RegistrationData & { id: string })[]>([]);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [all, confirmed] = await Promise.all([
        getEventRegistrations(eventId),
        getConfirmedCount(eventId),
      ]);
      setAllRegistrations(all);
      setConfirmedCount(confirmed);

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

  return { allRegistrations, myRegistrations, confirmedCount, loading, reload };
}
