import { useEffect, useState } from 'react';
import { getPersonas } from '@villa-events/shared/services/personaService';
import type { PersonaData } from '@villa-events/shared/models/user';
import { useAuth } from '@/hooks/useAuth';

export function usePersonas() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<(PersonaData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!user) {
      setPersonas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPersonas(user.uid)
      .then(setPersonas)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { personas, loading, reload };
}
