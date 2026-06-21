import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { VStack, HStack, Text, Button, Input, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { updateCensoSchema } from '@cultuvilla/shared/services/censoService';
import { collectUsedValues } from '@cultuvilla/shared/services/membershipProfileService';
import { getVillageMembers } from '@cultuvilla/shared/services/villageMemberService';
import type { ProfileFormField } from '@cultuvilla/shared/models/municipality/CensoTypes';

/**
 * Organizer-only census authoring: add/remove fields and save the schema.
 * Fields already answered by members are "locked" (cannot be removed).
 * Content-only (no Screen/Header) so it can be embedded in the shared censo
 * screen behind a role check.
 */
export function CensoSchemaEditor({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [fields, setFields] = useState<ProfileFormField[] | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    const [mun, members] = await Promise.all([
      getMunicipality(villageId),
      getVillageMembers(villageId),
    ]);
    const used = collectUsedValues(members);
    setLocked(new Set(Object.entries(used).filter(([, v]) => v.size > 0).map(([k]) => k)));
    setFields(mun?.community?.profileForm?.fields ?? []);
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  function addField() {
    if (!fields) return;
    const key = newKey.trim();
    if (!key || fields.some((f) => f.key === key)) return;
    setFields([
      ...fields,
      { source: 'custom', key, label: newLabel.trim() || key, type: 'text', required: false },
    ]);
    setNewKey('');
    setNewLabel('');
  }

  function removeField(key: string) {
    if (!fields) return;
    if (locked.has(key)) {
      // mobile-web-compat: native-only — Alert is a no-op on web.
      Alert.alert('Locked', `${key} is in use and cannot be removed.`);
      return;
    }
    setFields(fields.filter((f) => f.key !== key));
  }

  async function save() {
    if (!villageId || !fields) return;
    setSaving(true);
    try {
      await updateCensoSchema(villageId, fields);
      // mobile-web-compat: native-only — Alert is a no-op on web.
      Alert.alert(t('village.admin.community.saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack gap={3} className="p-4">
      {fields === null ? (
        <Text>{t('common.loading')}</Text>
      ) : (
        <>
          {fields.map((f) => (
            <HStack key={f.key} gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <View className="flex-1">
                <Text>{f.label ?? f.key}</Text>
                <Text className="text-muted text-xs">
                  {f.key} · {f.source === 'custom' ? f.type : 'predefined'}
                </Text>
              </View>
              {locked.has(f.key) ? (
                <Text className="text-xs text-orange-600">locked</Text>
              ) : (
                <Pressable onPress={() => removeField(f.key)}>
                  <Text className="text-red-600">{t('common.delete')}</Text>
                </Pressable>
              )}
            </HStack>
          ))}
          <VStack gap={2}>
            <Input value={newKey} onChangeText={setNewKey} placeholder="key" />
            <Input value={newLabel} onChangeText={setNewLabel} placeholder="label" />
            <Button variant="ghost" onPress={addField} disabled={!newKey.trim()}>
              {t('common.create')}
            </Button>
          </VStack>
          <Button onPress={save} loading={saving}>{t('common.save')}</Button>
        </>
      )}
    </VStack>
  );
}
