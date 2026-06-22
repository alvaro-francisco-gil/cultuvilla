import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { VStack, Text } from '../primitives';
import { CensoForm } from './CensoForm';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { getVillageMember } from '@cultuvilla/shared/services/villageMemberService';
import type { ProfileFormField, ProfileAnswers } from '@cultuvilla/shared/models/municipality/CensoTypes';
import { useEntityOptions } from './censo/useEntityOptions';

/**
 * Villager census: answer the schema and edit your own answers. Content-only
 * so it embeds in the shared censo screen behind a role check.
 */
export function CensoAnswers({ villageId, userId }: { villageId: string; userId: string }) {
  const [schema, setSchema] = useState<ProfileFormField[] | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<ProfileAnswers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { optionsByField } = useEntityOptions(villageId, schema ?? []);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [municipality, member] = await Promise.all([
          getMunicipality(villageId),
          getVillageMember(villageId, userId),
        ]);
        setSchema(municipality?.community?.profileForm?.fields ?? []);
        setInitialAnswers(member?.profileAnswers ?? {});
      } catch (e) {
        setError(e instanceof Error ? e.message : 'unknown');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [villageId, userId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    return (
      <View className="p-4">
        <Text tone="danger">{error}</Text>
      </View>
    );
  }
  return (
    <VStack gap={4} className="p-4">
      <CensoForm villageId={villageId} userId={userId} schema={schema ?? []} initialAnswers={initialAnswers} entityOptionsByField={optionsByField} />
    </VStack>
  );
}
