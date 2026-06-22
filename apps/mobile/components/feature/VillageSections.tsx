import type { ReactNode } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack, HStack, Text, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';

/**
 * Presentational building blocks for the village overview on the shared
 * village tab ((tabs)/village.tsx). The management affordances — `onManage`
 * and `onAdd` — route everyone to the shared propose-pending screens; the add
 * label reads "Proponer" for villagers and "Añadir" for organizers.
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
        {/* 1px larger than the card title (body = 16px), kept bold + accent. */}
        <Text variant="h2" style={{ color: ACCENT, fontSize: 17 }}>
          {title}
        </Text>
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

/**
 * The shared image-forward card used for every entry in the village overview
 * (inspired by ordago's frequent-partners scroll): a full-width image fills the
 * top, label + an optional secondary line sit in the body below. `PersonCard`
 * and `EntityCard` are thin adapters over this one card so people, barrios,
 * places, organizations and peñas all share a single "big picture" style.
 */
function BigCard({
  label,
  imageUri,
  fallback,
  secondary,
  accent,
  onPress,
}: {
  label: string;
  imageUri?: string | null;
  /** Shown in the image area when there's no `imageUri` (initials or an icon). */
  fallback: ReactNode;
  /** Optional second line under the label (a badge or a subtitle). */
  secondary?: string;
  /** Tint the border + secondary line with ACCENT (used for the request badge). */
  accent?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      className={`w-[150px] rounded-2xl overflow-hidden bg-surface-elevated${
        accent ? ' border' : ''
      }`}
      style={accent ? { borderColor: ACCENT } : undefined}
    >
      <View className="h-[150px] w-full items-center justify-center bg-subtle">
        {imageUri ? (
          <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
        ) : (
          fallback
        )}
      </View>
      <View className="px-3 py-2 gap-0.5">
        <Text variant="body" className="font-medium" numberOfLines={1}>
          {label}
        </Text>
        {secondary ? (
          <Text
            variant="bodySm"
            tone={accent ? undefined : 'muted'}
            style={accent ? { color: ACCENT } : undefined}
            numberOfLines={1}
          >
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      {body}
    </Pressable>
  );
}

export function PersonCard({
  name,
  photoURL,
  badge,
  subtitle,
  onPress,
}: {
  name: string;
  photoURL: string | null;
  /** Accent-tinted secondary line (e.g. a request badge). Takes precedence over `subtitle`. */
  badge?: string;
  /** Plain (muted) secondary line shown when there's no `badge`. */
  subtitle?: string;
  onPress?: () => void;
}) {
  const initials = name.slice(0, 1).toUpperCase();
  return (
    <BigCard
      label={name}
      imageUri={photoURL}
      fallback={
        <Text variant="h1" tone="muted">
          {initials}
        </Text>
      }
      secondary={badge ?? subtitle}
      accent={Boolean(badge)}
      onPress={onPress}
    />
  );
}

export function EntityCard({
  label,
  sub,
  icon,
  imageUri,
  accent,
  onPress,
}: {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  accent?: boolean;
  onPress?: () => void;
}) {
  return (
    <BigCard
      label={label}
      imageUri={imageUri}
      fallback={<Ionicons name={icon} size={44} color={ACCENT} />}
      secondary={sub}
      accent={accent}
      onPress={onPress}
    />
  );
}

export function AddCard({ label, onPress }: { label: string; onPress: () => void }) {
  // Matches BigCard's footprint (w-[150px] + square h-[150px] image area) so it
  // lines up with the image-forward cards it sits beside in the horizontal scroll.
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="w-[150px] rounded-2xl overflow-hidden border border-dashed border-subtle"
    >
      <View className="h-[150px] w-full items-center justify-center">
        <Ionicons name="add" size={44} color={ACCENT} />
      </View>
      <View className="px-3 py-2">
        <Text variant="bodySm" className="font-medium text-center" numberOfLines={2}>
          {label}
        </Text>
      </View>
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
