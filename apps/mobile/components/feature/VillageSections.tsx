import type { ReactNode } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VStack, HStack, Text, Pressable, TopCropImage } from '../primitives';
import { useT } from '../../lib/i18n';

/**
 * Presentational building blocks for the village overview on the shared
 * village tab ((tabs)/village.tsx). The management affordances — `onManage`
 * and `onAdd` — route everyone to the shared propose-pending screens; the add
 * label reads "Proponer" for villagers and "Añadir" for organizers.
 */

export const ACCENT = '#bb5d3a';
const PLACEHOLDER_BG = '#dcab93'; // palette.peach — keeps the white scrim text legible over the fallback
const CREST_BG = '#f9f0e8'; // palette.cream — matches the screen's bg-surface so the crest card reads as an outline
const CARD_W = 175;
const CARD_H = 175; // square — same width and height

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
        {/* Matches the profile screen's section header (h3, bold, default tone). */}
        <Text variant="h3" className="font-bold">
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
 * (inspired by ordago's frequent-partners scroll). A fully rectangular,
 * full-bleed image fills the whole card; the label + an optional secondary line
 * sit over a dark scrim pinned to the bottom (the same treatment as the news
 * `FeedCard`) so the picture stays as large as possible. `PersonCard` and
 * `EntityCard` are thin adapters over this one card so people, barrios, places,
 * organizations and peñas all share a single "big picture" style.
 */
function BigCard({
  label,
  imageUri,
  fallback,
  secondary,
  accent,
  crest,
  onPress,
}: {
  label: string;
  imageUri?: string | null;
  /** Shown in the image area when there's no `imageUri` (initials or an icon). */
  fallback: ReactNode;
  /** Optional second line under the label (a badge or a subtitle). */
  secondary?: string;
  /** Tint the border with ACCENT (used for the request badge). */
  accent?: boolean;
  /**
   * Crest treatment: the image (a village escudo) is small + `contain`ed and
   * centred on the cream screen background, with an ACCENT outline as the only
   * colour — so a low-res escudo no longer pixelates from being stretched
   * full-bleed. The label sits as plain dark text below it instead of over a
   * dark photo scrim.
   */
  crest?: boolean;
  onPress?: () => void;
}) {
  const body = crest ? (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: CREST_BG,
        borderWidth: accent ? 2 : 1,
        borderColor: ACCENT,
      }}
    >
      <View
        style={{
          flex: 1,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 4,
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        ) : (
          fallback
        )}
      </View>
      <View style={{ alignSelf: 'stretch', paddingHorizontal: 12, paddingBottom: 12 }}>
        <Text variant="body" className="font-medium" numberOfLines={2}>
          {label}
        </Text>
        {secondary ? (
          <Text variant="bodySm" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  ) : (
    <View
      className="rounded-2xl overflow-hidden"
      style={{
        width: CARD_W,
        height: CARD_H,
        backgroundColor: PLACEHOLDER_BG,
        ...(accent ? { borderWidth: 1, borderColor: ACCENT } : {}),
      }}
    >
      {imageUri ? (
        <TopCropImage uri={imageUri} />
      ) : (
        <View className="w-full h-full items-center justify-center">{fallback}</View>
      )}

      {/* Bottom scrim keeps the overlaid text legible against any photo. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <Text variant="body" className="font-medium" numberOfLines={2} style={{ color: '#ffffff' }}>
          {label}
        </Text>
        {secondary ? (
          <Text
            variant="bodySm"
            numberOfLines={1}
            style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}
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
  crest,
  onPress,
}: {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  accent?: boolean;
  /** Render the image as a small, centred escudo on the cream bg (villages). */
  crest?: boolean;
  onPress?: () => void;
}) {
  return (
    <BigCard
      label={label}
      imageUri={imageUri}
      fallback={<Ionicons name={icon} size={44} color={ACCENT} />}
      secondary={sub}
      accent={accent}
      crest={crest}
      onPress={onPress}
    />
  );
}

export function AddCard({ label, onPress }: { label: string; onPress: () => void }) {
  // Matches BigCard's rectangular footprint (CARD_W × CARD_H) so it lines up
  // with the image-forward cards it sits beside in the horizontal scroll.
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="rounded-2xl overflow-hidden border border-dashed border-subtle items-center justify-center gap-2"
      style={{ width: CARD_W, height: CARD_H }}
    >
      <Ionicons name="add" size={44} color={ACCENT} />
      <Text variant="bodySm" className="font-medium text-center px-3" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const POSTER_W = 140;
const POSTER_H = 198; // portrait, ~√2 (A-series) ratio

/**
 * Portrait poster card for the village festival-posters section — the same
 * full-bleed image + bottom scrim treatment as `BigCard`, but taller/narrower
 * to match a poster's aspect ratio instead of the square event-card shape.
 */
export function PosterCard({
  year,
  title,
  dateLabel,
  imageUri,
  onPress,
}: {
  year: number;
  title?: string | null;
  dateLabel?: string | null;
  imageUri?: string | null;
  onPress?: () => void;
}) {
  const body = (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ width: POSTER_W, height: POSTER_H, backgroundColor: PLACEHOLDER_BG }}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View className="w-full h-full items-center justify-center">
          <Ionicons name="image" size={44} color={ACCENT} />
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <Text variant="h2" className="font-bold" style={{ color: '#ffffff' }}>
          {String(year)}
        </Text>
        {title ? (
          <Text variant="bodySm" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.9)' }}>
            {title}
          </Text>
        ) : null}
        {dateLabel ? (
          <Text
            variant="bodySm"
            numberOfLines={1}
            style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}
          >
            {dateLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityLabel={`${title ? `${title} ` : ''}${String(year)}`}>
      {body}
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
