import { useState } from 'react';
import { ScrollView } from 'react-native';
import { VStack, HStack, Text, Pressable } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from './PlacesManager';
import { BarriosManager } from './BarriosManager';
import { OrganizationsManager } from './OrganizationsManager';

type Filter = 'all' | 'places' | 'barrios' | 'organizations';

/**
 * Admin content moderation, mounted as the "Contenido" tab of the community
 * ("Editar pueblo") screen. A filter chip row picks which entity's manage list
 * shows — "Todos" stacks all three. The create forms live on their own screens;
 * this is purely the approve/reject/edit/delete surface.
 */
export function VillageContentManager({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('all');

  const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'places', label: t('village.admin.hub.places') },
    { value: 'barrios', label: t('village.admin.hub.barrios') },
    { value: 'organizations', label: t('village.hub.organizations') },
  ];

  const show = (f: Filter) => filter === 'all' || filter === f;

  return (
    <ScrollView contentContainerClassName="pb-10">
      <VStack gap={3} className="pt-3">
      <HStack gap={2} className="flex-wrap px-4">
        {FILTERS.map((f) => {
          const selected = filter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full border ${
                selected ? 'bg-[#f3a64b] border-[#f3a64b]' : 'border-subtle'
              }`}
            >
              <Text className={selected ? 'text-primary' : undefined}>{f.label}</Text>
            </Pressable>
          );
        })}
      </HStack>

      {show('places') ? (
        <VStack gap={1}>
          <Text variant="h3" className="px-4 font-bold">{t('village.admin.hub.places')}</Text>
          <PlacesManager villageId={villageId} mode="manage" />
        </VStack>
      ) : null}

      {show('barrios') ? (
        <VStack gap={1}>
          <Text variant="h3" className="px-4 font-bold">{t('village.admin.hub.barrios')}</Text>
          <BarriosManager villageId={villageId} mode="manage" />
        </VStack>
      ) : null}

      {show('organizations') ? (
        <VStack gap={1}>
          <Text variant="h3" className="px-4 font-bold">{t('village.hub.organizations')}</Text>
          <OrganizationsManager villageId={villageId} mode="manage" />
        </VStack>
      ) : null}
      </VStack>
    </ScrollView>
  );
}
