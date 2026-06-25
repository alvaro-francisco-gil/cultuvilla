import { useState } from 'react';
import { ScrollView } from 'react-native';
import { VStack, HStack, Text, Pressable } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { PlacesManager } from './PlacesManager';
import { BarriosManager } from './BarriosManager';
import { OrganizationsManager } from './OrganizationsManager';

type Section = 'places' | 'barrios' | 'organizations';

/**
 * Admin content moderation, mounted as the "Contenido" tab of the community
 * ("Editar pueblo") screen. A row of toggle chips picks which sections show —
 * all start selected; unselect a chip to hide that section. The create forms
 * live on their own screens; this is purely the approve/reject/edit/delete
 * surface.
 */
export function VillageContentManager({ villageId }: { villageId: string }) {
  const { t } = useT();
  const [selected, setSelected] = useState<Set<Section>>(
    () => new Set<Section>(['places', 'barrios', 'organizations']),
  );

  const SECTIONS: { value: Section; label: string }[] = [
    { value: 'places', label: t('village.admin.hub.places') },
    { value: 'barrios', label: t('village.admin.hub.barrios') },
    { value: 'organizations', label: t('village.hub.organizations') },
  ];

  const toggle = (s: Section) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const show = (s: Section) => selected.has(s);

  return (
    <ScrollView contentContainerClassName="pb-10">
      <VStack gap={3} className="pt-3">
      <HStack gap={2} className="flex-wrap px-4">
        {SECTIONS.map((s) => {
          const isOn = selected.has(s.value);
          return (
            <Pressable
              key={s.value}
              testID={`filter-chip-${s.value}`}
              onPress={() => toggle(s.value)}
              className={`px-3 py-1 rounded-full border ${
                isOn ? 'bg-[#f3a64b] border-[#f3a64b]' : 'border-subtle'
              }`}
            >
              <Text className={isOn ? 'text-primary' : undefined}>{s.label}</Text>
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
