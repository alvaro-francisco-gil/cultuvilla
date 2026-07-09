import { useCallback, useState } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import { getFestivalPoster } from '@cultuvilla/shared/services/festivalPosterService';
import type { FestivalPosterWithId } from '@cultuvilla/shared/services/festivalPosterService';
import { formatFestivalPosterDates } from '@cultuvilla/shared/utils';

export default function FestivalPosterDetailScreen() {
  const { posterId } = useLocalSearchParams<{ villageId: string; posterId: string }>();
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

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !poster}
      imageUri={poster?.imageURL ?? null}
      fallbackIcon="image-outline"
      title={poster ? (poster.title ?? String(poster.year)) : undefined}
    >
      {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
    </EntityDetailScaffold>
  );
}
