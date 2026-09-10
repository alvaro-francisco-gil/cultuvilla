import { router } from 'expo-router';
import { Screen } from '../../components/primitives';
import { AppHeader } from '../../components/layout/AppHeader';
import { ProfileView } from '../../components/feature/profile/ProfileView';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { setActiveMunicipality } from '@cultuvilla/shared/services/userService';

export default function ProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useT();
  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  async function selectVillage(municipalityId: string) {
    if (!user) return;
    await setActiveMunicipality(user.uid, municipalityId);
    await refreshProfile();
    router.replace('/(tabs)/village');
  }

  if (!user) return null;

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={t('header.profile')} />
      <ProfileView
        uid={user.uid}
        activeMunicipalityId={activeMunicipalityId}
        variant="self"
        fallbackName={profile?.displayName ?? user.email ?? ''}
        onSelectVillage={selectVillage}
      />
    </Screen>
  );
}
