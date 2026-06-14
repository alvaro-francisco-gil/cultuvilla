import type { ReactNode } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack, HStack, Text, Pressable, Avatar } from '../primitives';
import { useT } from '../../lib/i18n';

/**
 * Presentational building blocks for the village overview, shared between the
 * public village tab ((tabs)/village.tsx) and the admin hub
 * (village/[villageId]/admin/index.tsx). The management affordances —
 * `onManage` (Gestionar) and `onAdd` (Añadir card) — are optional so the same
 * sections render read-only for regular villagers and editable for admins.
 */

export const ACCENT = '#bb5d3a';

export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <VStack className="items-center px-5">
      <Text variant="h2">{value}</Text>
      <Text tone="muted" variant="bodySm">
        {label}
      </Text>
    </VStack>
  );
}

export function StatSeparator() {
  return <View className="w-px h-8 bg-subtle" />;
}

export function Section({
  title,
  onManage,
  isEmpty,
  emptyLabel,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  /** When provided, renders the "Gestionar" link (admins only). */
  onManage?: () => void;
  isEmpty: boolean;
  emptyLabel: string;
  /** When provided alongside `addLabel`, renders the trailing add card (admins only). */
  addLabel?: string;
  onAdd?: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <VStack gap={3} className="pt-4">
      <HStack className="items-center justify-between px-4">
        <Text variant="h3">{title}</Text>
        {onManage ? (
          <Pressable onPress={onManage} accessibilityLabel={t('village.admin.overview.manage')}>
            <Text variant="bodySm" style={{ color: ACCENT }} className="font-medium">
              {t('village.admin.overview.manage')}
            </Text>
          </Pressable>
        ) : null}
      </HStack>
      {isEmpty && !onAdd ? (
        <Text tone="muted" variant="bodySm" className="px-4">
          {emptyLabel}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 gap-3"
        >
          {children}
          {onAdd && addLabel ? <AddCard label={addLabel} onPress={onAdd} /> : null}
        </ScrollView>
      )}
    </VStack>
  );
}

export function PersonCard({
  name,
  photoURL,
  badge,
  onPress,
}: {
  name: string;
  photoURL: string | null;
  badge?: string;
  onPress?: () => void;
}) {
  const initials = name.slice(0, 1).toUpperCase();
  // Image-forward card (inspired by ordago's frequent-partners scroll): a
  // full-width photo fills the top, name/badge sit in the body below.
  const body = (
    <View
      className="w-36 rounded-2xl overflow-hidden bg-surface-elevated border border-subtle"
      style={badge ? { borderColor: ACCENT } : undefined}
    >
      <View className="h-32 w-full items-center justify-center bg-subtle">
        {photoURL ? (
          <Image source={{ uri: photoURL }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Text variant="h1" tone="muted">
            {initials}
          </Text>
        )}
      </View>
      <View className="px-3 py-2 gap-0.5">
        <Text variant="body" className="font-medium" numberOfLines={1}>
          {name}
        </Text>
        {badge ? (
          <Text variant="bodySm" style={{ color: ACCENT }} numberOfLines={1}>
            {badge}
          </Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel={name}>
      {body}
    </Pressable>
  );
}

export function EntityCard({
  label,
  sub,
  icon,
  imageUri,
  onPress,
}: {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  onPress?: () => void;
}) {
  const body = (
    <>
      {imageUri ? (
        <Avatar uri={imageUri} size={48} />
      ) : (
        <Ionicons name={icon} size={28} color={ACCENT} />
      )}
      <Text variant="bodySm" className="mt-3 font-medium" numberOfLines={2}>
        {label}
      </Text>
      {sub ? (
        <Text tone="muted" variant="bodySm" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </>
  );
  if (!onPress) {
    return <View className="w-36 bg-surface-elevated rounded-2xl p-4">{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="w-36 bg-surface-elevated rounded-2xl p-4"
    >
      {body}
    </Pressable>
  );
}

export function AddCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="w-36 border border-dashed border-subtle rounded-2xl p-4 items-center justify-center"
    >
      <Ionicons name="add" size={28} color={ACCENT} />
      <Text variant="bodySm" className="mt-3 font-medium text-center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SettingsLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-surface border border-subtle rounded-xl p-3"
    >
      <Ionicons name={icon} size={20} color="#0f172a" />
      <Text className="ml-3 flex-1">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </Pressable>
  );
}
