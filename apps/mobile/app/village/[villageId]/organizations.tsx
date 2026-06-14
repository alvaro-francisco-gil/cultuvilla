import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { Card } from '../../../components/primitives/Card';
import { Avatar } from '../../../components/primitives/Avatar';
import { HStack } from '../../../components/primitives/HStack';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { getOrganizationsByMunicipality } from '@cultuvilla/shared/services/organizationService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';

type Org = OrganizationData & { id: string };

export default function VillageOrganizations() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!villageId) return;
    getOrganizationsByMunicipality(villageId as string, 'approved')
      .then(setOrgs)
      .catch((e) => setError(e instanceof Error ? e.message : 'unknown'));
  }, [villageId]);

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.organizationsList.title')} />
      {orgs === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="p-4">
          <Text tone="danger">{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerClassName="p-4 gap-3"
          data={orgs ?? []}
          keyExtractor={(o) => o.id}
          ListEmptyComponent={<Text tone="muted">{t('village.organizationsList.empty')}</Text>}
          renderItem={({ item }) => (
            <Card>
              <HStack className="gap-3 items-center">
                <Avatar uri={item.imageURL} size={48} initials={item.name.slice(0, 1)} />
                <View className="flex-1">
                  <Text variant="h3">{item.name}</Text>
                  {item.description ? (
                    <Text tone="muted" className="mt-1">
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </HStack>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
