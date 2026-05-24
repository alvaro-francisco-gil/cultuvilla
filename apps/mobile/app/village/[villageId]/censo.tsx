import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Screen } from '../../../components/primitives/Screen';
import { VStack } from '../../../components/primitives/VStack';
import { Text } from '../../../components/primitives/Text';
import { CensoForm } from '../../../components/feature/CensoForm';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useAuth } from '../../../lib/auth/useAuth';
import { useT } from '../../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import type { ProfileFormField, ProfileAnswers } from '@cultuvilla/shared/models/municipality/CensoTypes';

export default function CensoScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user } = useAuth();
  const { t } = useT();
  const [schema, setSchema] = useState<ProfileFormField[] | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<ProfileAnswers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!villageId || !user) return;
    async function load() {
      try {
        setError(null);
        const [municipality, member] = await Promise.all([
          getMunicipality(villageId as string),
          getVillageMember(villageId as string, user!.uid),
        ]);
        // censo schema lives at municipality.community.profileForm.fields
        const fields = municipality?.community?.profileForm?.fields ?? [];
        setSchema(fields);
        setInitialAnswers(member?.profileAnswers ?? {});
      } catch (e) {
        setError(e instanceof Error ? e.message : 'unknown');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [villageId, user]);

  if (!user || !villageId) return null;

  if (loading) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('censo.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('censo.title')} />
        <View className="p-4">
          <Text tone="danger">{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('censo.title')} />
      <VStack gap={4} className="p-4">
        <CensoForm
          villageId={villageId}
          userId={user.uid}
          schema={schema ?? []}
          initialAnswers={initialAnswers}
        />
      </VStack>
    </Screen>
  );
}
