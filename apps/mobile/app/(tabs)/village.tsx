import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Screen } from '../../components/primitives';
import { useAuth } from '../../lib/auth/useAuth';
import { getUserMemberships } from '@cultuvilla/shared/services/villageMemberService';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';
import { VillageDiscovery } from '../../components/feature/VillageDiscovery';

export default function VillageTabScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!user || !profile) {
        if (!cancelled) setResolving(false);
        return;
      }
      if (profile.activeMunicipalityId) {
        if (!cancelled) setResolving(false);
        return;
      }
      const memberships = await getUserMemberships(user.uid);
      if (cancelled) return;
      const first = memberships[0];
      if (first) {
        await setActiveMunicipality(user.uid, first.municipalityId);
        await refreshProfile();
      }
      if (!cancelled) setResolving(false);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [user, profile, refreshProfile]);

  if (resolving) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (profile?.activeMunicipalityId) {
    return <Redirect href={`/village/${profile.activeMunicipalityId}`} />;
  }
  return <VillageDiscovery />;
}
