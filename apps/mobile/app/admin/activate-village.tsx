import { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable, Escudo } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  searchMunicipalities,
  activateCommunity,
} from '@cultuvilla/shared/services/municipalityService';
import {
  escudoFullUrl,
  escudoThumbDisplayUrl,
} from '@cultuvilla/shared/models/municipality';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Row = MunicipalityData & { id: string };

const PAGE_SIZE = 50;

export default function ActivateVillageScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const [results, setResults] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      const list = await searchMunicipalities(query, PAGE_SIZE);
      if (cancelled) return;
      setResults(list.filter((m) => !m.communityActive));
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  async function onSubmit() {
    if (!selected || !user) return;
    setSaving(true);
    try {
      await activateCommunity(selected.id, {
        description,
        coverImages: [],
        adminUserId: user.uid,
      });
      // mobile-web-compat: native-only — admin surface, not exercised on web
      Alert.alert(t('admin.activate.success'));
      router.replace('/admin');
    } catch (e) {
      // mobile-web-compat: native-only — admin surface, not exercised on web
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
              data={results}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected(item)}
                  className="py-3 border-b border-subtle"
                >
                  <HStack gap={3} className="items-center">
                    <Escudo
                      url={escudoThumbDisplayUrl(item)}
                      size={36}
                      fallbackInitial={item.name}
                    />
                    <VStack>
                      <Text>{item.name}</Text>
                      <Text className="text-muted text-xs">
                        {item.province} · {item.codigoINE}
                      </Text>
                    </VStack>
                  </HStack>
                </Pressable>
              )}
            />
          </>
        ) : (
          <>
            <View className="bg-surface border border-subtle rounded-xl p-3">
              <HStack gap={3} className="items-center">
                <Escudo url={escudoFullUrl(selected)} size={64} fallbackInitial={selected.name} />
                <VStack>
                  <Text variant="h3">{selected.name}</Text>
                  <Text className="text-muted text-sm">
                    {selected.province} · {selected.codigoINE}
                  </Text>
                </VStack>
              </HStack>
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
