'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getVillage } from '@villa-events/shared/services/villageService';
import { getVillageMember } from '@villa-events/shared/services/villageMemberService';
import { useAuth } from './AuthContext';
import type { VillageData } from '@villa-events/shared/models/village';
import type { VillageMemberData } from '@villa-events/shared/models/village';

interface VillageContextValue {
  village: (VillageData & { id: string }) | null;
  membership: (VillageMemberData & { id: string }) | null;
  isMember: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const VillageContext = createContext<VillageContextValue | null>(null);

export function VillageProvider({ villageId, children }: { villageId: string; children: ReactNode }) {
  const { user } = useAuth();
  const [village, setVillage] = useState<(VillageData & { id: string }) | null>(null);
  const [membership, setMembership] = useState<(VillageMemberData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [v, m] = await Promise.all([
        getVillage(villageId),
        user ? getVillageMember(villageId, user.uid) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setVillage(v);
        setMembership(m);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [villageId, user]);

  return (
    <VillageContext.Provider value={{ village, membership, isMember: membership !== null, isAdmin: membership?.role === 'admin', loading }}>
      {children}
    </VillageContext.Provider>
  );
}

export function useVillage(): VillageContextValue {
  const ctx = useContext(VillageContext);
  if (!ctx) throw new Error('useVillage must be used within VillageProvider');
  return ctx;
}
