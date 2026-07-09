import { Modal, Pressable as RNPressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, HStack } from '../primitives';
import { ACCENT } from './VillageSections';
import { useT } from '../../lib/i18n';

interface AddContentSheetProps {
  visible: boolean;
  onClose: () => void;
  villageId: string;
  /** When true, prepend the admin-only "Detalles pueblo" row opening the edit stepper. */
  canManage: boolean;
}

interface AddOption {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Route to push (already scoped to the village). */
  href: string;
}

// The seven entities the village home can add, in the same order the sections
// appear on the screen. Each row just fans out to the entity's existing create
// route — no create logic lives here. Peña and agrupación share the org create
// screen; the `type` query preselects its picker (asociación = the non-peña
// default, since "agrupación" is the whole non-peña bucket).
function optionsFor(villageId: string, canManage: boolean): AddOption[] {
  const base = `/village/${villageId}`;
  return [
    // Admin-only: opens the village edit stepper (was formerly the "Editar pueblo" pill).
    ...(canManage
      ? [{ key: 'detalles', icon: 'create-outline' as const, href: `${base}/community` }]
      : []),
    { key: 'evento', icon: 'calendar-outline', href: `/event/new?villageId=${villageId}` },
    { key: 'articulo', icon: 'newspaper-outline', href: `/news/new?villageId=${villageId}` },
    { key: 'agrupacion', icon: 'business-outline', href: `${base}/organizations?type=asociacion` },
    { key: 'pena', icon: 'people-circle-outline', href: `${base}/organizations?type=pena` },
    { key: 'barrio', icon: 'map-outline', href: `${base}/barrios` },
    { key: 'lugar', icon: 'location-outline', href: `${base}/places` },
    { key: 'cartel', icon: 'image-outline', href: `${base}/festival-posters` },
  ];
}

/**
 * Bottom action sheet opened from the village home's "Añadir contenido" button.
 * Uses a fade-in Modal + bottom-anchored card (not an Animated translateY) so it
 * behaves on the web build, where RN-Web translateY springs don't move.
 */
export function AddContentSheet({ visible, onClose, villageId, canManage }: AddContentSheetProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const pick = (href: string) => {
    onClose();
    router.push(href as never);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* absoluteFillObject (not flex-1): RN-Web collapses a flex-1 Modal child to
          zero height, leaving no tappable backdrop to dismiss the sheet. */}
      <RNPressable
        onPress={onClose}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        ]}
      >
        <RNPressable
          onPress={() => {}}
          className="bg-surface-elevated border-t border-subtle"
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: insets.bottom + 12 }}
        >
          {/* Tapping the grab handle also dismisses — the primary close affordance
              on web, where there's no swipe-down gesture. */}
          <RNPressable onPress={onClose} className="items-center pt-3 pb-1 active:opacity-60">
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' }} />
          </RNPressable>
          {/* Olive (tone primary) to match the village name; 1px larger than the
              option rows (body = 16), same semibold weight. */}
          <Text tone="primary" className="px-5 pt-2 pb-1 font-semibold" style={{ fontSize: 17 }}>
            {t('village.addContent.title')}
          </Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {optionsFor(villageId, canManage).map((opt) => (
              <RNPressable
                key={opt.key}
                onPress={() => pick(opt.href)}
                accessibilityLabel={t(`village.addContent.items.${opt.key}`)}
                className="border-b border-subtle active:opacity-70"
              >
                <HStack gap={3} className="items-center px-5 py-4">
                  <Ionicons name={opt.icon} size={24} color={ACCENT} />
                  <Text className="flex-1 font-semibold">
                    {t(`village.addContent.items.${opt.key}`)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                </HStack>
              </RNPressable>
            ))}
          </ScrollView>
        </RNPressable>
      </RNPressable>
    </Modal>
  );
}
