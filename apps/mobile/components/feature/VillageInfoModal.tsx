import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, ScrollView, Image, Animated, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Escudo } from '../primitives/Escudo';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { useT } from '../../lib/i18n';
import { ACCENT } from './VillageSections';
import {
  escudoFullUrl,
  hasManualEscudo,
} from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality/MunicipalityDataModel';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type VillageInfoModalProps = {
  visible: boolean;
  onClose: () => void;
  village: MunicipalityData & { id: string };
  /** Admins get the "Editar" button into the community edit screen. */
  canManage: boolean;
};

/**
 * Pinterest-style two-column masonry. Each image keeps its natural aspect ratio
 * (resolved lazily via Image.getSize); images are greedily packed into whichever
 * column is currently shorter so the two columns stay roughly balanced.
 */
function MasonryGallery({ uris, columnWidth }: { uris: string[]; columnWidth: number }) {
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    uris.forEach((uri) => {
      Image.getSize(
        uri,
        (w, h) => {
          if (!cancelled && h > 0) setRatios((prev) => ({ ...prev, [uri]: w / h }));
        },
        () => {
          // Unknown size → fall back to a square so it still lays out.
          if (!cancelled) setRatios((prev) => ({ ...prev, [uri]: prev[uri] ?? 1 }));
        },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [uris]);

  const { left, right } = useMemo(() => {
    const cols = {
      left: [] as { uri: string; height: number }[],
      right: [] as { uri: string; height: number }[],
    };
    let leftH = 0;
    let rightH = 0;
    for (const uri of uris) {
      const ratio = ratios[uri] ?? 1;
      const height = columnWidth / ratio;
      if (leftH <= rightH) {
        cols.left.push({ uri, height });
        leftH += height;
      } else {
        cols.right.push({ uri, height });
        rightH += height;
      }
    }
    return cols;
  }, [uris, ratios, columnWidth]);

  const renderColumn = (items: { uri: string; height: number }[]) => (
    <View style={{ width: columnWidth, gap: 8 }}>
      {items.map((it, i) => (
        <Image
          key={`${it.uri}-${i}`}
          source={{ uri: it.uri }}
          style={{ width: columnWidth, height: it.height, borderRadius: 16 }}
          resizeMode="cover"
        />
      ))}
    </View>
  );

  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {renderColumn(left)}
      {renderColumn(right)}
    </View>
  );
}

export function VillageInfoModal({ visible, onClose, village, canManage }: VillageInfoModalProps) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = Dimensions.get('window');

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  function close(after?: () => void) {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      after?.();
    });
  }

  const images = village.community?.coverImages ?? [];
  const description = village.community?.description?.trim();
  // 16px outer padding each side, 8px gutter between the two columns.
  const columnWidth = (screenWidth - 16 * 2 - 8) / 2;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(0, 0, 0, 0.5)', opacity: fadeAnim },
        ]}
      >
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: SCREEN_HEIGHT,
            backgroundColor: '#ffffff',
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View
            className="flex-row items-center justify-between px-4 border-b border-subtle"
            style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
          >
            <Text variant="h2" numberOfLines={1} className="flex-1 pr-2">
              {t('village.info.title')}
            </Text>
            <Pressable
              onPress={() => close()}
              accessibilityLabel={t('menu.close')}
              className="p-2 -mr-2"
            >
              <Ionicons name="close" size={26} color="#0f172a" />
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
          >
            <View className="flex-row items-center gap-3">
              <View
                className={`bg-surface rounded-2xl shadow-sm ${
                  hasManualEscudo(village) ? '' : 'p-2'
                }`}
              >
                <Escudo
                  url={escudoFullUrl(village)}
                  size={72}
                  fill={hasManualEscudo(village)}
                  fallbackInitial={village.name}
                />
              </View>
              <View className="flex-1">
                <Text variant="h1">{village.name}</Text>
                <Text tone="muted" variant="bodySm">
                  {village.province}
                </Text>
              </View>
              {canManage ? (
                <Pressable
                  onPress={() =>
                    close(() => router.push(`/village/${village.id}/admin/community` as never))
                  }
                  accessibilityLabel={t('common.edit')}
                  className="flex-row items-center bg-surface"
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 12,
                    borderRadius: 24,
                    borderWidth: 1.5,
                    borderColor: ACCENT,
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={ACCENT} />
                  <Text style={{ color: ACCENT }} className="font-semibold ml-1">
                    {t('common.edit')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {description ? (
              <Text variant="body">{description}</Text>
            ) : canManage ? (
              <Text tone="muted" variant="bodySm">
                {t('village.admin.overview.noDescription')}
              </Text>
            ) : null}

            {images.length > 0 ? (
              <MasonryGallery uris={images} columnWidth={columnWidth} />
            ) : null}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
