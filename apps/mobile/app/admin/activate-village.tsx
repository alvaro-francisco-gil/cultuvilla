import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getMunicipalities,
  activateCommunity,
} from '@cultuvilla/shared/services/municipalityService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Row = MunicipalityData & { id: string };

export default function ActivateVillageScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const [muns, setMuns] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMunicipalities().then(setMuns);
  }, []);

  const filtered = useMemo(() => {
    if (!muns) return [];
    const q = query.trim().toLowerCase();
    const base = muns.filter((m) => !m.communityActive);
    if (!q) return base.slice(0, 50);
    return base
      .filter((m) =>
        [m.name, m.province, m.codigoINE].some((s) => s.toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [muns, query]);

  async function onSubmit() {
    if (!selected || !user) return;
    setSaving(true);
    try {
      await activateCommunity(selected.id, {
        description,
        coverImages: [],
        adminUserId: user.uid,
      });
      Alert.alert(t('admin.activate.success'));
      router.replace('/admin');
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.activate.title')} />
      <VStack gap={3} className="p-4 flex-1">
        {!selected ? (
          <>
            <Text variant="h3">{t('admin.activate.pickMunicipality')}</Text>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t('admin.activate.searchPlaceholder')}
            />
            <FlatList
              data={filtered}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected(item)}
                  className="py-3 border-b border-subtle"
                >
                  <Text>{item.name}</Text>
                  <Text className="text-muted text-xs">
                    {item.province} · {item.codigoINE}
                  </Text>
                </Pressable>
              )}
            />
          </>
        ) : (
          <>
            <View className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{selected.name}</Text>
              <Text className="text-muted text-sm">
                {selected.province} · {selected.codigoINE}
              </Text>
            </View>
            <Text>{t('admin.activate.description')}</Text>
            <Input value={description} onChangeText={setDescription} multiline />
            <HStack gap={2}>
              <Button variant="ghost" onPress={() => setSelected(null)}>
                {t('common.back')}
              </Button>
              <Button onPress={onSubmit} loading={saving} disabled={!description.trim()}>
                {t('admin.activate.submit')}
              </Button>
            </HStack>
          </>
        )}
      </VStack>
    </Screen>
  );
}
