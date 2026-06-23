import { useState } from 'react';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { SegmentedToggle } from '../../../components/feature/SegmentedToggle';
import { CommunitySettingsEditor } from '../../../components/feature/CommunitySettingsEditor';
import { VillageContentManager } from '../../../components/feature/proposable/VillageContentManager';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { useT } from '../../../lib/i18n';

type EditTab = 'details' | 'content';

// Role-mode community editor (organizers only; non-organizers are redirected
// back to the village, where the header is their read view). Two parallel
// sections behind a segmented toggle: "Detalles" (escudo/description/location)
// and "Contenido" (moderate lugares/barrios/agrupaciones).
export default function CommunityScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { canManage, loading } = useEntityCapabilities(villageId);
  const { t } = useT();
  const [tab, setTab] = useState<EditTab>('details');

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
      <ScreenHeader title={t('village.edit.title')} />
      <View className="px-4 pt-3">
        <SegmentedToggle<EditTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'details', label: t('village.edit.tabDetails') },
            { value: 'content', label: t('village.edit.tabContent') },
          ]}
        />
      </View>
      {tab === 'details' ? (
        <CommunitySettingsEditor villageId={villageId} />
      ) : (
        <VillageContentManager villageId={villageId} />
      )}
    </Screen>
  );
}
