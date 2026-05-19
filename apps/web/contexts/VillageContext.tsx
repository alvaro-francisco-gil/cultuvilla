'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import { useAuth } from './AuthContext';
import type { MunicipalityData, VillageMemberData } from '@cultuvilla/shared/models/municipality';

interface VillageContextValue {
  municipality: (MunicipalityData & { id: string }) | null;
  membership: (VillageMemberData & { id: string }) | null;
  isMember: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const VillageContext = createContext<VillageContextValue | null>(null);

export function VillageProvider({ municipalityId, children }: { municipalityId: string; children: ReactNode }) {
  const { user } = useAuth();
  const [municipality, setMunicipality] = useState<(MunicipalityData & { id: string }) | null>(null);
  const [membership, setMembership] = useState<(VillageMemberData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [v, m] = await Promise.all([
        getMunicipality(municipalityId),
        user ? getVillageMember(municipalityId, user.uid) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setMunicipality(v);
        setMembership(m);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [municipalityId, user]);

  return (
    <VillageContext.Provider value={{ municipality, membership, isMember: membership !== null, isAdmin: membership?.role === 'admin', loading }}>
      {children}
    </VillageContext.Provider>
  );
}

export function useVillage(): VillageContextValue {
  const ctx = useContext(VillageContext);
  if (!ctx) throw new Error('useVillage must be used within VillageProvider');
  return ctx;
}
