import { useLocalSearchParams, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { CommunitySettingsEditor } from '../../../components/feature/CommunitySettingsEditor';
import { VillageContentManager } from '../../../components/feature/proposable/VillageContentManager';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { useT } from '../../../lib/i18n';

// Role-mode community: villagers view the header on the village tab; organizers
// edit it here. Non-organizers are redirected back to the village (the header
// is their read view). Single edit entry point for the community settings.
export default function CommunityScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { canManage, loading } = useEntityCapabilities(villageId);
  const { t } = useT();

  if (!villageId) return null;
  if (loading) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('village.admin.community.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}`} />;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.community.title')} />
      <CommunitySettingsEditor
        villageId={villageId}
        footer={<VillageContentManager villageId={villageId} />}
      />
    </Screen>
  );
}
