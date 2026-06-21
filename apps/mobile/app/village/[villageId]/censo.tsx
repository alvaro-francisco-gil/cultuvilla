import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { CensoSchemaEditor } from '../../../components/feature/CensoSchemaEditor';
import { CensoAnswers } from '../../../components/feature/CensoAnswers';
import { useAuth } from '../../../lib/auth/useAuth';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { useT } from '../../../lib/i18n';

// Role-mode censo: one shared screen. An organizer authors the schema; a
// villager answers (and edits their own answers). No proposals.
export default function CensoScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user } = useAuth();
  const { t } = useT();
  const { canManage, loading } = useEntityCapabilities(villageId);

  if (!villageId || !user) return null;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('censo.title')} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : canManage ? (
        <CensoSchemaEditor villageId={villageId} />
      ) : (
        <CensoAnswers villageId={villageId} userId={user.uid} />
      )}
    </Screen>
  );
}
