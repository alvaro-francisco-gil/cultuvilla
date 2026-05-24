import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator, Alert } from 'react-native';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getOccupations,
  createOccupation,
  deleteOccupation,
  getPendingProposals,
  reviewProposal,
} from '@cultuvilla/shared/services/occupationService';
import type { OccupationData, OccupationProposalData } from '@cultuvilla/shared/models/occupation';

type Occ = OccupationData & { id: string };
type Prop = OccupationProposalData & { id: string };

export default function OccupationsScreen() {
  const { t } = useT();
  const { user } = useAuth();
  const [occs, setOccs] = useState<Occ[] | null>(null);
  const [proposals, setProposals] = useState<Prop[] | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, p] = await Promise.all([getOccupations(), getPendingProposals()]);
    setOccs(o);
    setProposals(p);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!newName.trim() || !user) return;
    setAdding(true);
    try {
      await createOccupation({ name: newName.trim(), createdBy: user.uid });
      setNewName('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(o: Occ) {
    Alert.alert(t('common.delete'), o.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(o.id);
          try { await deleteOccupation(o.id); await load(); } finally { setBusyId(null); }
        },
      },
    ]);
  }

  async function review(p: Prop, decision: 'approved' | 'rejected') {
    if (!user) return;
    setBusyId(p.id);
    try {
      await reviewProposal(p.id, decision, user.uid);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.occupations.title')} />
      <VStack gap={3} className="p-4">
        <Text variant="h3">{t('admin.occupations.proposals')}</Text>
        {proposals === null ? (
          <ActivityIndicator />
        ) : proposals.length === 0 ? (
          <Text className="text-muted">{t('admin.occupations.noProposals')}</Text>
        ) : (
          proposals.map((p) => (
            <VStack key={p.id} gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{p.name}</Text>
              <HStack gap={2}>
                <Button onPress={() => review(p, 'approved')} loading={busyId === p.id}>
                  {t('admin.occupations.approve')}
                </Button>
                <Button variant="ghost" onPress={() => review(p, 'rejected')} loading={busyId === p.id}>
                  {t('admin.occupations.reject')}
                </Button>
              </HStack>
            </VStack>
          ))
        )}

        <Text variant="h3" className="mt-4">{t('admin.occupations.catalog')}</Text>
        <HStack gap={2}>
          <View className="flex-1">
            <Input
              value={newName}
              onChangeText={setNewName}
              placeholder={t('admin.occupations.addName')}
            />
          </View>
          <Button onPress={add} loading={adding} disabled={!newName.trim()}>
            {t('admin.occupations.add')}
          </Button>
        </HStack>
        <FlatList
          data={occs ?? []}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => remove(item)} className="py-3 border-b border-subtle">
              <Text>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={occs ? null : <ActivityIndicator />}
        />
      </VStack>
    </Screen>
  );
}
