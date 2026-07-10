import { useCallback, useState } from 'react';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../../../lib/entities/registry';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { useT } from '../../../../lib/i18n';
import { getFestivalPoster } from '@cultuvilla/shared/services/festivalPosterService';
import type { FestivalPosterWithId } from '@cultuvilla/shared/services/festivalPosterService';
import { formatFestivalPosterDates } from '@cultuvilla/shared/utils';

export default function FestivalPosterDetailScreen() {
  const { villageId, posterId } = useLocalSearchParams<{ villageId: string; posterId: string }>();
  const { t } = useT();
  const { canManage } = useEntityCapabilities(villageId);
  const [poster, setPoster] = useState<FestivalPosterWithId | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!posterId) return;
    try {
      setPoster(await getFestivalPoster(posterId));
    } finally {
      setLoading(false);
    }
  }, [posterId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dateLabel = poster ? formatFestivalPosterDates(poster) : '';
  const subtitle = poster
    ? [poster.title ? String(poster.year) : null, dateLabel].filter(Boolean).join(' · ')
    : '';

  const actions: EntityDetailAction[] =
    poster && canManage
      ? [
          {
            icon: 'create-outline',
            accessibilityLabel: t('common.edit'),
            onPress: () =>
              router.push(`/village/${villageId}/festival-poster/${poster.id}/edit` as never),
          },
        ]
      : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !poster}
      imageUri={poster?.imageURL ?? null}
      fallbackIcon={ENTITY_FALLBACK_ICON.festivalPoster}
      actions={actions}
      title={poster ? (poster.title ?? String(poster.year)) : undefined}
    >
      {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
    </EntityDetailScaffold>
  );
}
