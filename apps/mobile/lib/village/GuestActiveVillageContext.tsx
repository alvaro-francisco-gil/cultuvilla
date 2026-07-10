import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  clearGuestActiveVillage,
  readGuestActiveVillage,
  setGuestActiveVillage,
} from './guestActiveVillage';

interface GuestActiveVillageValue {
  /** The village a logged-out visitor is viewing, or null. */
  guestVillageId: string | null;
  /** Mark a village as the guest's active one (persists it). */
  activate: (municipalityId: string) => void;
}

const Ctx = createContext<GuestActiveVillageValue | null>(null);

/**
 * Holds the "active village" for a logged-out visitor who arrived via a share
 * link, so the tab shell can render it exactly like a signed-in user's active
 * village. Signed-in users never use this — their profile's
 * activeMunicipalityId wins (see useActiveVillageId), and signing in clears any
 * lingering guest value.
 */
export function GuestActiveVillageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [guestVillageId, setGuestVillageId] = useState<string | null>(null);

  // Hydrate from storage on first mount so a web reload keeps the village.
  useEffect(() => {
    void readGuestActiveVillage().then((id) => {
      if (id) setGuestVillageId((current) => current ?? id);
    });
  }, []);

  // Once a real user is present, the guest value is stale — the profile's
  // active village is authoritative. Drop it so it can't leak into a session.
  useEffect(() => {
    if (!user) return;
    setGuestVillageId(null);
    void clearGuestActiveVillage();
  }, [user]);

  const activate = (municipalityId: string) => {
    setGuestVillageId(municipalityId);
    void setGuestActiveVillage(municipalityId);
  };

  return <Ctx.Provider value={{ guestVillageId, activate }}>{children}</Ctx.Provider>;
}

export function useGuestActiveVillage(): GuestActiveVillageValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGuestActiveVillage must be used within GuestActiveVillageProvider');
  return v;
}
