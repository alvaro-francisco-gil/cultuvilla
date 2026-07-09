import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../primitives/Screen';
import { VStack } from '../primitives/VStack';
import { Text } from '../primitives/Text';
import { DetailHeroImage } from './DetailHeroImage';
import { EntityDetailHeader, type EntityDetailAction } from './EntityDetailHeader';
import { useT } from '../../lib/i18n';

/**
 * Shared scaffold for every ENTITY detail screen. An "entity" is a
 * village-scoped object shown in a horizontal Section scroll (as a BigCard)
 * that opens a hero-image detail screen: event, festival-poster (cartel),
 * place, barrio, organization, news. (person + village are NOT entities — they
 * open into forms.) The scaffold owns the chrome — solid static header bar,
 * full-bleed flyer, title, and loading / not-found states — so each screen is
 * a thin body: fetch data, pass `actions`, render `{children}` and an optional
 * `fab`.
 */
export type EntityDetailScaffoldProps = {
  loading: boolean;
  notFound?: boolean;
  imageUri: string | null;
  fallbackImageUri?: string | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
  actions?: EntityDetailAction[];
  title?: string;
  children?: ReactNode;
  /** Absolutely-positioned bottom affordance (register / join). Styles must
   * live on `style`, not `className`, to render on RN-Web. */
  fab?: ReactNode;
  scrollContentClassName?: string;
};

export function EntityDetailScaffold({
  loading,
  notFound = false,
  imageUri,
  fallbackImageUri = null,
  fallbackIcon,
  onBack,
  actions = [],
  title,
  children,
  fab,
  scrollContentClassName = 'pb-10',
}: EntityDetailScaffoldProps) {
  const { t } = useT();
  const busy = loading || notFound;
  return (
    <Screen padded={false} topInset={false}>
      <EntityDetailHeader onBack={onBack} actions={busy ? [] : actions} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center">
          <Text>{t('common.notFound')}</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerClassName={scrollContentClassName}>
            <DetailHeroImage
              imageUri={imageUri}
              fallbackImageUri={fallbackImageUri}
              fallbackIcon={fallbackIcon}
            />
            <VStack gap={3} className="p-4">
              {title ? <Text variant="h1">{title}</Text> : null}
              {children}
            </VStack>
          </ScrollView>
          {fab}
        </>
      )}
    </Screen>
  );
}
